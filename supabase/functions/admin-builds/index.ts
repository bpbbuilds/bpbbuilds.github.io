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
const COSMETIC_SLOTS = new Set(['hat', 'face', 'neck', 'head', 'body', 'hand']);
const COSMETIC_GRANTS = new Set(['starter', 'premium', 'founding', 'event']);
const COSMETIC_RARITIES = new Set(['Common', 'Rare', 'Epic', 'Legendary', 'Godly', 'Unique']);

type Filter = 'all' | 'pending_op' | 'featured' | 'hidden';

type Body = {
  action?: string;
  slug?: string;
  filter?: Filter;
  eventSlug?: string;
  buildId?: number | string;
  cosmetic?: Record<string, unknown>;
  asset?: Record<string, unknown>;
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
  let actorId: string | null = null;
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
        if (authorized) actorId = userData.user.id;
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
  if (secretOk && !(await recordEmergencyUse(supabase, 'admin-builds', action))) {
    return json({ error: 'Emergency access rate limit reached' }, 429);
  }

  if (action === 'list') {
    return listBuilds(supabase, body.filter);
  }
  if (action === 'event_entries') {
    return listEventEntries(supabase, body.eventSlug);
  }
  if (action === 'set_event_winner') {
    return setEventWinner(supabase, body.eventSlug, body.buildId, actorId);
  }
  if (action === 'clear_event_winner') {
    return clearEventWinner(supabase, body.eventSlug);
  }
  if (action === 'members') {
    return listMembers(supabase);
  }
  if (action === 'cosmetics') {
    const { data, error } = await supabase
      .from('cosmetic_drops')
      .select('id')
      .eq('published', true)
      .order('id');
    if (error) return json({ error: 'Could not load published cosmetics' }, 500);
    return json({ ids: (data || []).map((row) => String(row.id || '')).filter(Boolean) });
  }
  if (action === 'cosmetics_catalog') {
    return listCosmeticCatalog(supabase);
  }
  if (action === 'upload_cosmetic') {
    return uploadCosmetic(supabase, body.cosmetic);
  }
  if (action === 'event_upload_url') return createEventUploadUrl(supabase, body.asset);
  if (action === 'update_cosmetic') {
    return updateCosmetic(supabase, body.cosmetic);
  }
  if (action === 'publish_cosmetic') {
    return publishCosmetic(supabase, body.cosmetic);
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
 * Public creator face for the build tooltip. Snapshot author_name stays if the profile is gone.
 * @param {Record<string, unknown>} row
 */
function authorFace(row: Record<string, unknown>) {
  const raw = row.profile;
  const profile = Array.isArray(raw) ? raw[0] : raw;
  const face =
    profile && typeof profile === 'object'
      ? (profile as Record<string, unknown>)
      : null;
  const avatar = String(face?.avatar_url || '').trim();
  const equipped = face?.equipped_avatar != null ? String(face.equipped_avatar) : null;
  const liveName = String(face?.display_name || '').trim();
  const { profile: _profile, ...rest } = row;
  return {
    ...rest,
    author_avatar_url: avatar || null,
    author_equipped_avatar: equipped,
    author_name: liveName || rest.author_name,
  };
}

async function publishCosmetic(supabase: ReturnType<typeof createClient>, raw: Record<string, unknown> | undefined) {
  const id = String(raw?.id || '').trim();
  const name = String(raw?.name || '').trim();
  const slot = String(raw?.slot || '').trim().toLowerCase();
  const grant = String(raw?.grant || '').trim().toLowerCase();
  const rarity = String(raw?.rarity || '').trim();
  if (
    !/^[a-z0-9][a-z0-9_-]{1,80}$/i.test(id) ||
    !name ||
    name.length > 120 ||
    !COSMETIC_SLOTS.has(slot) ||
    !COSMETIC_GRANTS.has(grant) ||
    !COSMETIC_RARITIES.has(rarity)
  ) {
    return json({ error: 'Invalid cosmetic.' }, 400);
  }
  const { data: existing, error: existingError } = await supabase
    .from('cosmetic_drops')
    .select('published')
    .eq('id', id)
    .maybeSingle();
  if (existingError) return json({ error: 'Could not check cosmetic draft.', detail: existingError.message }, 500);
  if (!existing) return json({ error: 'Cosmetic draft not found.' }, 404);
  if (existing.published === true) return json({ error: 'Cosmetic is already published.' }, 409);

  const cost =
    raw?.cost == null || raw?.cost === '' || !Number.isFinite(Number(raw.cost))
      ? null
      : Math.max(0, Math.min(999999, Math.round(Number(raw.cost))));
  const row = {
    id,
    name,
    slot,
    rarity,
    grant,
    description: String(raw?.description || '').trim().slice(0, 500),
    image: String(raw?.image || '').trim().slice(0, 500),
    artist: String(raw?.artist || '').trim().slice(0, 120),
    owner: String(raw?.owner || '').trim().slice(0, 120),
    kind: String(raw?.kind || 'part').trim().slice(0, 30) || 'part',
    starter: grant === 'starter',
    swatch: String(raw?.swatch || '#8a5a2b').trim().slice(0, 32) || '#8a5a2b',
    cost,
    added: String(raw?.added || '').trim() || new Date().toISOString().slice(0, 10),
    published: true,
  };
  const { error } = await supabase.from('cosmetic_drops').upsert(row, { onConflict: 'id' });
  if (error) return json({ error: 'Could not publish cosmetic', detail: error.message }, 500);
  return json({ ok: true, cosmetic: row });
}

/** Update an owner-visible draft without making it public. */
async function updateCosmetic(
  supabase: ReturnType<typeof createClient>,
  raw: Record<string, unknown> | undefined,
) {
  const id = String(raw?.id || '').trim();
  const name = String(raw?.name || '').trim();
  const slot = String(raw?.slot || '').trim().toLowerCase();
  const grant = String(raw?.grant || '').trim().toLowerCase();
  const rarity = String(raw?.rarity || '').trim();
  if (
    !/^[a-z0-9][a-z0-9_-]{1,80}$/i.test(id) ||
    !name ||
    name.length > 120 ||
    !COSMETIC_SLOTS.has(slot) ||
    !COSMETIC_GRANTS.has(grant) ||
    !COSMETIC_RARITIES.has(rarity)
  ) {
    return json({ error: 'Invalid cosmetic draft.' }, 400);
  }

  const { data: existing, error: existingError } = await supabase
    .from('cosmetic_drops')
    .select('published,image,added')
    .eq('id', id)
    .maybeSingle();
  if (existingError) return json({ error: 'Could not load cosmetic draft.', detail: existingError.message }, 500);
  if (!existing) return json({ error: 'Cosmetic draft not found.' }, 404);
  if (existing.published === true) return json({ error: 'Published cosmetics cannot be edited here.' }, 409);

  let image = String(existing.image || '').trim();
  const dataUrl = String(raw?.imageData || '').trim();
  if (dataUrl) {
    const match = /^data:(image\/(?:png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
    if (!match) return json({ error: 'Choose a PNG or WebP image.' }, 400);
    const mime = match[1].toLowerCase();
    const encoded = match[2].replace(/\s+/g, '');
    if (encoded.length > 4 * 1024 * 1024) return json({ error: 'Cosmetic image is too large.' }, 413);
    let bytes: Uint8Array;
    try {
      const binary = atob(encoded);
      bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    } catch {
      return json({ error: 'Cosmetic image data is invalid.' }, 400);
    }
    if (!bytes.length || bytes.length > 2 * 1024 * 1024) {
      return json({ error: 'Cosmetic image must be 2 MB or smaller.' }, 413);
    }
    const png =
      bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
    const webp =
      bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if ((mime === 'image/png' && !png) || (mime === 'image/webp' && !webp)) {
      return json({ error: 'Cosmetic image data is invalid.' }, 400);
    }
    const extension = mime === 'image/webp' ? 'webp' : 'png';
    const objectPath = `cosmetic-drops/${id}.${extension}`;
    const { error: storageError } = await supabase.storage.from('cosmetic-assets').upload(objectPath, bytes, {
      contentType: mime,
      cacheControl: '31536000',
      upsert: true,
    });
    if (storageError) return json({ error: 'Could not save cosmetic image.', detail: storageError.message }, 500);
    image = `${Deno.env.get('SUPABASE_URL') || ''}/storage/v1/object/public/cosmetic-assets/${objectPath}`;
  }

  const cost =
    raw?.cost == null || raw?.cost === '' || !Number.isFinite(Number(raw.cost))
      ? null
      : Math.max(0, Math.min(999999, Math.round(Number(raw.cost))));
  const row = {
    name,
    slot,
    rarity,
    grant,
    description: String(raw?.description || '').trim().slice(0, 500),
    image,
    artist: String(raw?.artist || '').trim().slice(0, 120),
    owner: String(raw?.owner || '').trim().slice(0, 120),
    kind: String(raw?.kind || 'part').trim().slice(0, 30) || 'part',
    starter: grant === 'starter',
    swatch: String(raw?.swatch || '#8a5a2b').trim().slice(0, 32) || '#8a5a2b',
    cost,
    added: String(raw?.added || existing.added || '').trim() || new Date().toISOString().slice(0, 10),
    published: false,
  };
  const { data, error } = await supabase
    .from('cosmetic_drops')
    .update(row)
    .eq('id', id)
    .eq('published', false)
    .select('id,name,slot,rarity,grant,description,image,artist,owner,kind,starter,swatch,cost,added,published')
    .maybeSingle();
  if (error) return json({ error: 'Could not update cosmetic draft.', detail: error.message }, 500);
  if (!data) return json({ error: 'Cosmetic draft was changed or published already.' }, 409);
  return json({ ok: true, cosmetic: data });
}

async function listCosmeticCatalog(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from('cosmetic_drops')
    .select('id,name,slot,rarity,grant,description,image,artist,owner,kind,starter,swatch,cost,added,published')
    .order('name', { ascending: true });
  if (error) return json({ error: 'Could not load cosmetic catalog', detail: error.message }, 500);
  return json({ items: data || [] });
}

/**
 * Save an owner-uploaded image and catalog metadata as an unpublished draft.
 * The browser sends a bounded data URL so the service role never reaches the client.
 */
async function createEventUploadUrl(supabase: ReturnType<typeof createClient>, raw: Record<string, unknown> | undefined) {
  const slug = String(raw?.slug || '').trim();
  const kind = String(raw?.kind || '').trim();
  const mime = String(raw?.mime || '').toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !['banner', 'icon'].includes(kind) || !['image/png', 'image/webp', 'image/jpeg'].includes(mime)) return json({ error: 'Invalid event image.' }, 400);
  const ext = mime === 'image/jpeg' ? 'jpg' : mime.slice(6);
  const path = `event-assets/${slug}/${kind}-${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from('discord-builds').createSignedUploadUrl(path);
  if (error || !data?.token) return json({ error: 'Could not prepare event image upload.', detail: error?.message }, 500);
  return json({ path, token: data.token, url: `${Deno.env.get('SUPABASE_URL') || ''}/storage/v1/object/public/discord-builds/${path}` });
}

async function uploadCosmetic(
  supabase: ReturnType<typeof createClient>,
  raw: Record<string, unknown> | undefined,
) {
  const id = String(raw?.id || '').trim();
  const name = String(raw?.name || '').trim();
  const slot = String(raw?.slot || '').trim();
  const grant = String(raw?.grant || 'starter').trim().toLowerCase() || 'starter';
  const rarity = String(raw?.rarity || 'Common').trim();
  const dataUrl = String(raw?.imageData || '').trim();
  const match = /^data:(image\/(?:png|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (
    !/^[a-z0-9][a-z0-9_-]{1,80}$/i.test(id) ||
    !name ||
    name.length > 120 ||
    !COSMETIC_SLOTS.has(slot.toLowerCase()) ||
    !COSMETIC_GRANTS.has(grant) ||
    !COSMETIC_RARITIES.has(rarity) ||
    !match
  ) {
    return json({ error: 'Invalid cosmetic upload.' }, 400);
  }
  const mime = match[1].toLowerCase();
  const encoded = match[2].replace(/\s+/g, '');
  if (encoded.length > 4 * 1024 * 1024) return json({ error: 'Cosmetic image is too large.' }, 413);
  let bytes: Uint8Array;
  try {
    const binary = atob(encoded);
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return json({ error: 'Cosmetic image data is invalid.' }, 400);
  }
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) {
    return json({ error: 'Cosmetic image must be 2 MB or smaller.' }, 413);
  }

  const bucket = 'cosmetic-assets';
  const extension = mime === 'image/webp' ? 'webp' : 'png';
  const objectPath = `cosmetic-drops/${id}.${extension}`;
  const { data: existing, error: existingError } = await supabase
    .from('cosmetic_drops')
    .select('published')
    .eq('id', id)
    .maybeSingle();
  if (existingError) return json({ error: 'Could not check cosmetic id', detail: existingError.message }, 500);
  if (existing?.published === true) {
    return json({ error: 'That cosmetic is already published. Choose a new id.' }, 409);
  }
  const { error: storageError } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType: mime,
    cacheControl: '31536000',
    upsert: true,
  });
  if (storageError) return json({ error: 'Could not save cosmetic image', detail: storageError.message }, 500);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const row = {
    id,
    name,
    slot: slot.slice(0, 40),
    rarity,
    grant,
    description: String(raw?.description || '').trim().slice(0, 500),
    image: `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`,
    artist: String(raw?.artist || '').trim().slice(0, 120),
    owner: String(raw?.owner || '').trim().slice(0, 120),
    kind: 'part',
    starter: String(raw?.grant || '').trim().toLowerCase() === 'starter',
    swatch: '#8a5a2b',
    cost: null,
    added: new Date().toISOString().slice(0, 10),
    published: false,
  };
  const { error: rowError } = await supabase.from('cosmetic_drops').upsert(row, { onConflict: 'id' });
  if (rowError) {
    await supabase.storage.from(bucket).remove([objectPath]);
    return json({ error: 'Could not save cosmetic catalog row', detail: rowError.message }, 500);
  }
  return json({ ok: true, cosmetic: row });
}

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
    .select(
      `${BUILD_COLS}, author_id, profile:profiles!builds_author_id_fkey(discord_id, display_name, avatar_url, equipped_avatar)`,
    )
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
    ...authorFace(b),
    placements: byBuild.get(Number(b.id)) || [],
  }));
  return json({ builds: out }, 200);
}

const ENTRY_COLS =
  'id, slug, title, hero_class, author_name, rank, gold_count, created_at, notes, youtube_url, is_public, event_slug, board_still_path, history, starting_bag_id, route_r3_item_id, route_r10_item_id';

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
  const ids = (data || []).map((build) => build.id);
  const { data: placements, error: placementError } = ids.length
    ? await supabase
      .from('build_placements')
      .select(PLACEMENT_SELECT)
      .in('build_id', ids)
    : { data: [], error: null };
  if (placementError) {
    console.error(placementError);
    return json({ error: 'List placements failed', detail: placementError.message }, 500);
  }

  /** @type {Map<number, object[]>} */
  const byBuild = new Map();
  for (const placement of placements || []) {
    const buildId = Number(placement.build_id);
    const row = {
      id: placement.id,
      x: placement.x,
      y: placement.y,
      r: placement.r,
      gems: placement.gems,
      item: placement.item,
    };
    const list = byBuild.get(buildId);
    if (list) list.push(row);
    else byBuild.set(buildId, [row]);
  }
  const { data: winner, error: winnerError } = await supabase
    .from('event_winners')
    .select('event_slug,build_id,selected_at')
    .eq('event_slug', slug)
    .maybeSingle();
  if (winnerError) {
    console.error(winnerError);
    return json({ error: 'Could not load selected winner', detail: winnerError.message }, 500);
  }
  return json({
    builds: (data || []).map((build) => ({
      ...build,
      placements: byBuild.get(Number(build.id)) || [],
    })),
    winner: winner || null,
  }, 200);
}

/** @param {string | undefined} eventSlug */
function eventSlug(eventSlug: string | undefined) {
  const slug = String(eventSlug || '').trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : '';
}

/**
 * Persist a manual winner only after proving the submitted build belongs to
 * the same event. The UI exposes this only for no-vote events; ownership and
 * the build/event relationship are enforced here rather than in the browser.
 */
async function setEventWinner(
  supabase: ReturnType<typeof createClient>,
  eventSlugRaw: string | undefined,
  buildIdRaw: number | string | undefined,
  actorId: string | null,
) {
  const slug = eventSlug(eventSlugRaw);
  const buildId = Number(buildIdRaw);
  if (!slug) return json({ error: 'Valid eventSlug is required' }, 400);
  if (!Number.isSafeInteger(buildId) || buildId < 1) {
    return json({ error: 'Valid buildId is required' }, 400);
  }

  const { data: build, error: buildError } = await supabase
    .from('builds')
    .select('id,event_slug')
    .eq('id', buildId)
    .maybeSingle();
  if (buildError) return json({ error: 'Could not validate event entry', detail: buildError.message }, 500);
  if (!build || String(build.event_slug || '').trim().toLowerCase() !== slug) {
    return json({ error: 'Build is not an entry for this event' }, 400);
  }

  const { data: winner, error } = await supabase
    .from('event_winners')
    .upsert(
      {
        event_slug: slug,
        build_id: buildId,
        selected_at: new Date().toISOString(),
        selected_by: actorId,
      },
      { onConflict: 'event_slug' },
    )
    .select('event_slug,build_id,selected_at')
    .maybeSingle();
  if (error) return json({ error: 'Could not select winner', detail: error.message }, 500);
  return json({ winner }, 200);
}

async function clearEventWinner(
  supabase: ReturnType<typeof createClient>,
  eventSlugRaw: string | undefined,
) {
  const slug = eventSlug(eventSlugRaw);
  if (!slug) return json({ error: 'Valid eventSlug is required' }, 400);
  const { error } = await supabase.from('event_winners').delete().eq('event_slug', slug);
  if (error) return json({ error: 'Could not clear winner', detail: error.message }, 500);
  return json({ ok: true }, 200);
}

/** Owner-only merge of website profiles and Discord guild members. */
async function listMembers(supabase: ReturnType<typeof createClient>) {
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, discord_id, display_name, avatar_url, plan, premium_until, created_at')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (profileErr) return json({ error: 'Could not load website members' }, 500);

  const { data: builds, error: buildErr } = await supabase
    .from('builds')
    .select('author_id')
    .not('author_id', 'is', null)
    .limit(10000);
  if (buildErr) return json({ error: 'Could not count member builds' }, 500);
  const buildCounts = new Map<string, number>();
  for (const build of builds || []) {
    const id = String(build.author_id || '');
    if (id) buildCounts.set(id, (buildCounts.get(id) || 0) + 1);
  }

  const token = Deno.env.get('DISCORD_BOT_TOKEN') || '';
  const guildId = Deno.env.get('DISCORD_GUILD_ID') || '';
  const discordMembers: Record<string, { name: string; avatar_url: string | null; joined_at: string | null }> = {};
  if (token && guildId) {
    let after = '';
    for (let page = 0; page < 20; page += 1) {
      const url = new URL(`https://discord.com/api/v10/guilds/${guildId}/members`);
      url.searchParams.set('limit', '1000');
      if (after) url.searchParams.set('after', after);
      const res = await fetch(url, { headers: { Authorization: `Bot ${token}` } });
      if (!res.ok) return json({ error: 'Could not load Discord members' }, 502);
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) break;
      for (const member of rows) {
        const id = String(member?.user?.id || '');
        if (!id) continue;
        const user = member.user || {};
        const avatarHash = String(member?.avatar || user?.avatar || '');
        discordMembers[id] = {
          name: String(member?.nick || user?.global_name || user?.username || 'Discord member'),
          avatar_url: avatarHash ? `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.png?size=64` : null,
          joined_at: member?.joined_at ? String(member.joined_at) : null,
        };
        after = id;
      }
      if (rows.length < 1000) break;
    }
  }

  const rows = new Map<string, Record<string, unknown>>();
  for (const profile of profiles || []) {
    const discordId = String(profile.discord_id || '');
    const discord = discordMembers[discordId];
    rows.set(discordId || `site:${profile.id}`, {
      id: profile.id,
      discord_id: discordId || null,
      name: String(profile.display_name || discord?.name || 'Website member'),
      avatar_url: profile.avatar_url || discord?.avatar_url || null,
      website_joined_at: profile.created_at || null,
      discord_joined_at: discord?.joined_at || null,
      website: true,
      discord: Boolean(discord),
      premium: profile.plan === 'premium' || profile.plan === 'founding',
      plan: profile.plan || 'free',
      premium_since: premiumStartedAt(profile),
      build_count: buildCounts.get(String(profile.id)) || 0,
    });
  }
  for (const [discordId, discord] of Object.entries(discordMembers)) {
    if (rows.has(discordId)) continue;
    rows.set(discordId, {
      id: null, discord_id: discordId, name: discord.name, avatar_url: discord.avatar_url,
      website_joined_at: null, discord_joined_at: discord.joined_at,
      website: false, discord: true, premium: false, plan: 'free', premium_since: null, build_count: 0,
    });
  }
  return json({ members: [...rows.values()].sort((a, b) => String(a.name).localeCompare(String(b.name))) });
}

function premiumStartedAt(profile: Record<string, unknown>) {
  if (profile.plan === 'founding') return profile.created_at || null;
  const until = Date.parse(String(profile.premium_until || ''));
  if (!Number.isFinite(until)) return null;
  return new Date(until - 30 * 24 * 60 * 60 * 1000).toISOString();
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
