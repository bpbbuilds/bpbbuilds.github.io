/**
 * Owner-gated sim issue reports (list + stats + status).
 * Prefer Authorization: Bearer <owner JWT> (profiles.is_owner).
 * Break-glass: x-bpb-submit-secret = BPB_SUBMIT_SECRET
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, BPB_SUBMIT_SECRET
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-bpb-submit-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REPORT_COLS =
  'id, created_at, status, reporter_id, reporter_label, description, seed, you_title, you_slug, you_round, foe_mode, foe_label, permalink, coverage_pct, session';

const LIST_LIMIT = 100;
const STATUSES = new Set(['open', 'fixed', 'wontfix']);

type Filter = 'all' | 'open' | 'fixed' | 'wontfix';

type Body = {
  action?: string;
  id?: string;
  status?: string;
  filter?: Filter;
  q?: string;
  since?: string;
  hero_class?: string;
  foe_mode?: string;
  reporter?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  const secret = Deno.env.get('BPB_SUBMIT_SECRET') || '';
  const secretHeader = req.headers.get('x-bpb-submit-secret') || '';
  const secretOk = Boolean(secret && secretHeader === secret);

  let authorized = secretOk;
  if (!authorized) {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (jwt && anonKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (userData?.user) {
        const admin = createClient(supabaseUrl, serviceKey);
        const { data: profile } = await admin
          .from('profiles')
          .select('is_owner')
          .eq('id', userData.user.id)
          .maybeSingle();
        authorized = profile?.is_owner === true;
      }
    }
  }

  if (!authorized) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const action = String(body.action || '').trim();
  const supabase = createClient(supabaseUrl, serviceKey);
  if (secretOk && !(await recordEmergencyUse(supabase, 'admin-reports', action))) {
    return json({ error: 'Emergency access rate limit reached' }, 429);
  }

  if (action === 'list') {
    return listReports(supabase, body);
  }

  if (action === 'stats') {
    return reportStats(supabase);
  }

  if (action === 'set_status') {
    const id = String(body.id || '').trim();
    const status = String(body.status || '').trim();
    if (!id) return json({ error: 'id is required' }, 400);
    if (!STATUSES.has(status)) {
      return json({ error: 'status must be open, fixed, or wontfix' }, 400);
    }
    const { data, error } = await supabase
      .from('sim_reports')
      .update({ status })
      .eq('id', id)
      .select(REPORT_COLS)
      .maybeSingle();
    if (error) {
      console.error(error);
      return json({ error: 'Update failed', detail: error.message }, 500);
    }
    if (!data) return json({ error: 'Report not found' }, 404);
    return json({ report: data }, 200);
  }

  return json({ error: 'Unknown action' }, 400);
});

async function listReports(
  supabase: ReturnType<typeof createClient>,
  body: Body,
) {
  let q = supabase
    .from('sim_reports')
    .select(REPORT_COLS)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);

  const f = body.filter || 'open';
  if (f !== 'all' && STATUSES.has(f)) {
    q = q.eq('status', f);
  }

  const since = String(body.since || '').trim();
  if (since && !Number.isNaN(Date.parse(since))) {
    q = q.gte('created_at', new Date(since).toISOString());
  }

  const { data: reports, error } = await q;
  if (error) {
    console.error(error);
    return json({ error: 'List failed', detail: error.message }, 500);
  }
  const decorated = await decorateReports(supabase, reports || []);
  return json({ reports: applyListFilters(decorated, body) }, 200);
}

async function decorateReports(
  supabase: ReturnType<typeof createClient>,
  reports: any[],
) {
  const ids = [
    ...new Set(reports.map((r) => String(r.reporter_id || '').trim()).filter(Boolean)),
  ];
  const slugs = [
    ...new Set(reports.map((r) => String(r.you_slug || '').trim()).filter(Boolean)),
  ];

  const [profs, builds] = await Promise.all([
    ids.length
      ? supabase
          .from('profiles')
          .select('id, avatar_url, equipped_avatar, discord_id')
          .in('id', ids)
      : Promise.resolve({ data: [] as any[] }),
    slugs.length
      ? supabase.from('builds').select('slug, hero_class').in('slug', slugs)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const byId: Record<string, any> = {};
  for (const p of profs.data || []) byId[p.id] = p;
  const bySlug: Record<string, string> = {};
  for (const b of builds.data || []) {
    const cls = String(b.hero_class || '').trim();
    if (b.slug && cls) bySlug[String(b.slug)] = cls;
  }

  return reports.map((r) => {
    const p = r.reporter_id ? byId[String(r.reporter_id)] : null;
    const equipped = String(p?.equipped_avatar || '').trim();
    const discord = String(p?.avatar_url || '').trim();
    const avatar = /^https?:\/\//i.test(equipped) ? equipped : discord || null;
    const session = r.session && typeof r.session === 'object' ? r.session : {};
    const fromSession = String(session.youHeroClass || '').trim();
    const fromBuild = r.you_slug ? bySlug[String(r.you_slug)] || '' : '';
    const { session: _session, ...rest } = r;
    return {
      ...rest,
      reporter_avatar_url: avatar,
      reporter_discord_id: p?.discord_id || null,
      you_hero_class: fromSession || fromBuild || null,
    };
  });
}

function applyListFilters(reports: any[], body: Body) {
  const q = String(body.q || '')
    .trim()
    .toLowerCase()
    .slice(0, 80);
  const hero = String(body.hero_class || '').trim();
  const foes = String(body.foe_mode || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const reporter = String(body.reporter || '').trim();

  return reports.filter((r) => {
    if (q) {
      const hay = [r.description, r.reporter_label, r.seed, r.you_title, r.foe_label]
        .map((v) => String(v || '').toLowerCase())
        .join('\n');
      if (!hay.includes(q)) return false;
    }
    if (hero && String(r.you_hero_class || '') !== hero) return false;
    if (foes.length && !foes.includes(String(r.foe_mode || ''))) return false;
    if (reporter === 'signed' && !r.reporter_id) return false;
    if (reporter === 'guest' && r.reporter_id) return false;
    return true;
  });
}

async function reportStats(supabase: ReturnType<typeof createClient>) {
  const now = new Date();
  const startUtcDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
  const start30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [total, open, fixed, wontfix, today, last30d, oldestOpen] = await Promise.all([
    countRows(supabase),
    countRows(supabase, (q) => q.eq('status', 'open')),
    countRows(supabase, (q) => q.eq('status', 'fixed')),
    countRows(supabase, (q) => q.eq('status', 'wontfix')),
    countRows(supabase, (q) => q.gte('created_at', startUtcDay)),
    countRows(supabase, (q) => q.gte('created_at', start30d)),
    supabase
      .from('sim_reports')
      .select('created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (
    total.error ||
    open.error ||
    fixed.error ||
    wontfix.error ||
    today.error ||
    last30d.error ||
    oldestOpen.error
  ) {
    const detail =
      total.error?.message ||
      open.error?.message ||
      fixed.error?.message ||
      wontfix.error?.message ||
      today.error?.message ||
      last30d.error?.message ||
      oldestOpen.error?.message;
    console.error(detail);
    return json({ error: 'Stats failed', detail }, 500);
  }

  return json({
    stats: {
      total: total.count,
      open: open.count,
      fixed: fixed.count,
      wontfix: wontfix.count,
      today: today.count,
      last_30d: last30d.count,
      oldest_open_at: oldestOpen.data?.created_at ?? null,
    },
  });
}

async function countRows(
  supabase: ReturnType<typeof createClient>,
  apply?: (q: any) => any,
) {
  let q = supabase.from('sim_reports').select('id', { count: 'exact', head: true });
  if (apply) q = apply(q);
  const { count, error } = await q;
  return { count: Number(count) || 0, error };
}

async function recordEmergencyUse(
  supabase: ReturnType<typeof createClient>,
  endpoint: string,
  action: string,
) {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('admin_emergency_access_log')
    .select('id', { count: 'exact', head: true })
    .eq('endpoint', endpoint)
    .gte('used_at', since);
  if (error || (count || 0) >= 5) return false;
  const { error: insertError } = await supabase
    .from('admin_emergency_access_log')
    .insert({ endpoint, action: action.slice(0, 80) });
  return !insertError;
}
