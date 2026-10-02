/**
 * Combat sandbox issue reports.
 * POST JSON: description + frozen session fields.
 * Optional Authorization: Bearer <user JWT> binds reporter_id.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function clip(s: unknown, max: number) {
  return String(s ?? '').trim().slice(0, max);
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const description = clip(body.description, 4000);
  if (!description) {
    return json({ error: 'Description is required' }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let reporter_id: string | null = null;
  let reporter_label = clip(body.reporterLabel, 80) || 'Guest';

  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (jwt && anonKey) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (userData?.user) {
      reporter_id = userData.user.id;
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userData.user.id)
        .maybeSingle();
      const name = String(profile?.display_name || '').trim();
      if (name) reporter_label = name.slice(0, 80);
      else if (reporter_label === 'Guest') reporter_label = 'Signed in';
    }
  }

  const youRoundRaw = body.youRound;
  const you_round =
    youRoundRaw != null && Number.isFinite(Number(youRoundRaw))
      ? Math.round(Number(youRoundRaw))
      : null;
  const covRaw = body.coveragePct;
  const coverage_pct =
    covRaw != null && Number.isFinite(Number(covRaw))
      ? Math.round(Number(covRaw))
      : null;

  const session =
    body.session && typeof body.session === 'object' && !Array.isArray(body.session)
      ? body.session
      : {};

  const row = {
    reporter_id,
    reporter_label,
    description,
    seed: clip(body.seed, 64) || null,
    you_title: clip(body.youTitle, 120) || null,
    you_slug: clip(body.youSlug, 80) || null,
    you_round,
    foe_mode: clip(body.foeMode, 24) || null,
    foe_label: clip(body.foeLabel, 200) || null,
    permalink: clip(body.permalink, 1500) || null,
    coverage_pct,
    session,
  };

  const { data, error } = await supabase
    .from('sim_reports')
    .insert(row)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[report-sim] insert', error);
    return json({ error: 'Could not save report' }, 500);
  }

  return json({ ok: true, id: data?.id || null });
});
