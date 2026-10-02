/**
 * Owner-gated build curation (OP / featured / hide).
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

const BUILD_COLS =
  'id, slug, title, hero_class, author_name, build_tag, is_op, op_requested, is_featured, is_public, created_at, youtube_url, rank, gold_count';

const PLACEMENT_SELECT = `
  id, build_id, x, y, r, gems,
  item:items (
    id, gid, name, rarity, type, class, extra_types, tags, cost, effect,
    image, shape, sockets, accuracy, cooldown, stamina_cost,
    damage_min, damage_max, block, chance, chance_tag, params
  )
`;

const LIST_LIMIT = 100;

type Filter = 'all' | 'pending_op' | 'featured' | 'hidden';

type Body = {
  action?: string;
  slug?: string;
  filter?: Filter;
  eventSlug?: string;
};

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

  if (action === 'list') {
    return listBuilds(supabase, body.filter);
  }
  if (action === 'event_entries') {
    return listEventEntries(supabase, body.eventSlug);
  }

  const slug = String(body.slug || '').trim();
  if (!slug) return json({ error: 'slug is required' }, 400);

  const patch = patchForAction(action);
  if (!patch) return json({ error: 'Unknown action' }, 400);

  const { data, error } = await supabase
    .from('builds')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('slug', slug)
    .select(BUILD_COLS)
    .maybeSingle();

  if (error) {
    console.error(error);
    return json({ error: 'Update failed', detail: error.message }, 500);
  }
  if (!data) return json({ error: 'Build not found' }, 404);

  return json({ build: data }, 200);
});

/**
 * @param {import('https://esm.sh/@supabase/supabase-js@2.49.1').SupabaseClient} supabase
 * @param {Filter | undefined} filter
 */
async function listBuilds(
  supabase: ReturnType<typeof createClient>,
  filter: Filter | undefined,
) {
  let q = supabase
    .from('builds')
    .select(BUILD_COLS)
    .order('created_at', { ascending: false })
    .limit(LIST_LIMIT);

  const f = filter || 'all';
  if (f === 'pending_op') {
    q = q.eq('op_requested', true).eq('is_op', false);
  } else if (f === 'featured') {
    q = q.eq('is_featured', true);
  } else if (f === 'hidden') {
    q = q.eq('is_public', false);
  }

  const { data: builds, error } = await q;
  if (error) {
    console.error(error);
    return json({ error: 'List failed', detail: error.message }, 500);
  }
  if (!builds?.length) return json({ builds: [] }, 200);

  const ids = builds.map((b) => b.id);
  const { data: places, error: placeErr } = await supabase
    .from('build_placements')
    .select(PLACEMENT_SELECT)
    .in('build_id', ids);
  if (placeErr) {
    console.error(placeErr);
    return json({ error: 'List placements failed', detail: placeErr.message }, 500);
  }

  /** @type {Map<number, object[]>} */
  const byBuild = new Map();
  for (const p of places || []) {
    const bid = Number(p.build_id);
    const row = {
      id: p.id,
      x: p.x,
      y: p.y,
      r: p.r,
      gems: p.gems,
      item: p.item,
    };
    const list = byBuild.get(bid);
    if (list) list.push(row);
    else byBuild.set(bid, [row]);
  }

  const out = builds.map((b) => ({
    ...b,
    placements: byBuild.get(Number(b.id)) || [],
  }));
  return json({ builds: out }, 200);
}

const ENTRY_COLS =
  'id, slug, title, hero_class, author_name, rank, gold_count, created_at, notes, youtube_url, is_public, event_slug, history, starting_bag_id, route_r3_item_id, route_r10_item_id';

/**
 * Submitted builds for one event, including the stored run history for the judging file.
 * @param {import('https://esm.sh/@supabase/supabase-js@2.49.1').SupabaseClient} supabase
 * @param {string | undefined} eventSlug
 */
async function listEventEntries(
  supabase: ReturnType<typeof createClient>,
  eventSlug: string | undefined,
) {
  const slug = String(eventSlug || '').trim().toLowerCase();
  if (!slug) return json({ error: 'eventSlug is required' }, 400);

  const { data, error } = await supabase
    .from('builds')
    .select(ENTRY_COLS)
    .eq('event_slug', slug)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error(error);
    return json({ error: 'List failed', detail: error.message }, 500);
  }
  return json({ builds: data || [] }, 200);
}

/** @returns {Record<string, boolean> | null} */
function patchForAction(action: string): Record<string, boolean> | null {
  switch (action) {
    case 'approve_op':
      return { is_op: true, op_requested: false };
    case 'deny_op':
      return { op_requested: false };
    case 'set_featured':
      return { is_featured: true };
    case 'unset_featured':
      return { is_featured: false };
    case 'hide':
      return { is_public: false };
    case 'restore':
      return { is_public: true };
    default:
      return null;
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
