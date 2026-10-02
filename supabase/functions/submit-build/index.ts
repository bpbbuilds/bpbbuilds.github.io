/**
 * Create publish — Discord JWT (sets author_id) or break-glass secret.
 * Authorization: Bearer <user JWT>  OR  x-bpb-submit-secret = BPB_SUBMIT_SECRET
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, BPB_SUBMIT_SECRET
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import galleryOpens from './event-gallery.json' with { type: 'json' };
import { syncPlanRoles } from '../_shared/discord.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-bpb-submit-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AuthorCtx = {
  mode: 'jwt' | 'secret';
  author_id: string | null;
  author_name: string;
  discord_id?: string | null;
};

const YT_RE =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{6,})/;

/** Playable hero classes (Neutral is item affinity, not a hero). */
const HERO_CLASSES = new Set([
  'Ranger',
  'Reaper',
  'Pyromancer',
  'Berserker',
  'Mage',
  'Adventurer',
  'Engineer',
]);

/** Mirror js/shared/starting-bags.js — keep in sync. */
const CLASS_STARTING_BAG_IDS: Record<string, string[]> = {
  Adventurer: ['bag_of_giving', 'sewing_case'],
  Berserker: ['berserker_bag', 'toolbox'],
  Engineer: ['engineer_box', 'engineer_bag_2'],
  Mage: ['scholar_bag', 'puzzlebox'],
  Pyromancer: ['fire_pit', 'portable_altar'],
  Ranger: ['ranger_bag', 'vineweave_basket'],
  Reaper: ['storage_coffin', 'relic_case'],
};

/** Mirror js/shared/item-access.js ACCESS_CLASS_BITS. */
const CLASS_BITS: Record<string, number> = {
  None: 0,
  Ranger: 1,
  Reaper: 2,
  Berserker: 4,
  Pyromancer: 8,
  Mage: 16,
  Adventurer: 32,
  Engineer: 64,
  Neutral: 127,
};

/** Dual-shop Unique skills — DB class is only the first shop name. */
const STUFFED_CLASS_MASK_OVERRIDES: Record<string, number> = {
  critical_poison: 3,
  burning_spikes: 12,
  hogus_bogus: 48,
  spin_to_win: 96,
  energy_conversion: 72,
  inner_power: 5,
  bewitchment: 18,
};

/** Treasure Uniques from assets/data/item-origins.json — not Class Uniques. */
const TREASURE_IDS = new Set([
  'angel_crystal',
  'artifact_stone_cold',
  'artifact_stone_death',
  'artifact_stone_heat',
  'bomb',
  'cog_badge',
  'cthulhu',
  'cubert',
  'dancing_dragon',
  'flame_badge',
  'furcifer_prime',
  'ghost',
  'gingerbread_man',
  'leaf_badge',
  'lightning_potion',
  'little_mimic',
  'magic_badge',
  'pop',
  'present',
  'pumpkin',
  'puzzle_badge',
  'rainbow_badge',
  'repeater',
  'skull',
  'skull_badge',
  'sloth',
  'snowcake',
  'stable_recombobulator',
  'stone_badge',
  'thorn_elemental',
  'time_dilator',
  'twine_badge',
  'vampiric_scythe',
  'villain_sword',
  'wolf_badge',
]);

type BoardItem = {
  id: string;
  type?: string | null;
  rarity?: string | null;
  class?: string | null;
};

type Priority = 'needed' | 'nice' | 'optional' | null;

type Placement = {
  id: string;
  x: number;
  y: number;
  r?: number;
  gems?: string[];
  priority?: Priority;
};

type HistoryRound = {
  round: number;
  result: 'win' | 'loss';
  placements: Placement[];
};

type BuildHistory = {
  runId: number;
  rounds: HistoryRound[];
};

type DraftBody = {
  title?: string;
  notes?: string;
  hero_class?: string;
  build_tag?: string | null;
  is_op?: boolean;
  youtube_url?: string | null;
  gold_count?: number | null;
  rank?: string | null;
  route_r3_item_id?: string | null;
  route_r10_item_id?: string | null;
  starting_bag_id?: string | null;
  placements?: Placement[];
  history?: unknown;
  board_still_path?: string | null;
  event_slug?: string | null;
};

const HISTORY_MAX_ROUNDS = 40;
const HISTORY_MAX_JSON_CHARS = 500_000;

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

  let author: AuthorCtx | null = null;

  if (secretOk) {
    author = { mode: 'secret', author_id: null, author_name: 'Smojo' };
  } else {
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt || !anonKey) {
      return json({ error: 'Sign in with Discord to submit.' }, 401);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: 'Sign in with Discord to submit.' }, 401);
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('id, display_name, discord_id')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (profileErr || !profile?.id) {
      console.error(profileErr);
      return json({ error: 'Profile missing — sign out and sign in again.' }, 403);
    }
    const name =
      String(profile.display_name || '').trim() ||
      String(profile.discord_id || '').trim() ||
      'Adventurer';
    author = {
      mode: 'jwt',
      author_id: String(profile.id),
      author_name: name,
      discord_id: String(profile.discord_id || '').trim() || null,
    };
  }

  let body: DraftBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const err = validateDraft(body);
  if (err) return json({ error: err }, 400);

  const title = String(body.title).trim();
  const notes = String(body.notes || '').trim();
  const blurb = notes.slice(0, 160);
  const hero_class = String(body.hero_class).trim();
  const historyNorm = normalizeHistory(body.history);
  if (body.history != null && historyNorm.error) {
    return json({ error: historyNorm.error }, 400);
  }
  const history = historyNorm.history;

  let build_tag =
    body.build_tag === 'feasible' ||
      body.build_tag === 'theory' ||
      body.build_tag === 'real' ||
      body.build_tag === 'theorycraft'
      ? body.build_tag === 'theorycraft'
        ? 'theory'
        : body.build_tag
      : null;
  if (history) build_tag = 'real';
  else if (build_tag === 'real') {
    return json({ error: 'Real requires attached run history.' }, 400);
  }
  const op_requested = body.is_op === true;
  const youtube_url = body.youtube_url ? String(body.youtube_url).trim() : null;
  const gold_count = Math.max(0, Math.round(Number(body.gold_count) || 0));
  const rank = String(body.rank).trim();
  const route_r3_item_id = String(body.route_r3_item_id).trim();
  const route_r10_item_id = String(body.route_r10_item_id).trim();
  const starting_bag_id = String(body.starting_bag_id).trim();

  let board_still_path: string | null = null;
  const stillRaw = body.board_still_path != null ? String(body.board_still_path).trim() : '';
  if (stillRaw) {
    if (stillRaw.includes('..') || stillRaw.startsWith('/')) {
      return json({ error: 'Invalid board_still_path.' }, 400);
    }
    if (author!.mode === 'jwt' && author!.author_id) {
      const prefix = `${author!.author_id}/`;
      if (!stillRaw.startsWith(prefix)) {
        return json({ error: 'board_still_path must be under your user folder.' }, 400);
      }
    }
    if (!/\.(webp|png)$/i.test(stillRaw)) {
      return json({ error: 'board_still_path must end in .webp or .png.' }, 400);
    }
    board_still_path = stillRaw;
  }

  let event_slug: string | null = null;
  const eventRaw = body.event_slug != null ? String(body.event_slug).trim() : '';
  if (eventRaw) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(eventRaw) || eventRaw.length > 64) {
      return json({ error: 'Invalid event_slug.' }, 400);
    }
    event_slug = eventRaw.toLowerCase();
  }

  let placements = body.placements!;
  if (history) {
    const last = history.rounds[history.rounds.length - 1];
    placements = mergePriorities(last.placements, body.placements || []);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const historyItemIds = history
    ? history.rounds.flatMap((r) =>
      r.placements.flatMap((p) => [
        String(p.id),
        ...(Array.isArray(p.gems) ? p.gems.map(String).filter(Boolean) : []),
      ]),
    )
    : [];

  const itemIds = [
    ...new Set([
      ...placements.map((p) => String(p.id)),
      ...placements.flatMap((p) =>
        Array.isArray(p.gems) ? p.gems.map(String).filter(Boolean) : [],
      ),
      ...historyItemIds,
      starting_bag_id,
      route_r3_item_id,
      route_r10_item_id,
    ]),
  ];

  // Supabase .in() has practical limits; chunk if needed
  const byId = new Map<string, BoardItem>();
  for (let i = 0; i < itemIds.length; i += 80) {
    const chunk = itemIds.slice(i, i + 80);
    const { data: boardItems, error: itemsErr } = await supabase
      .from('items')
      .select('id, type, rarity, class')
      .in('id', chunk);
    if (itemsErr) {
      console.error(itemsErr);
      return json({ error: 'Could not validate board items' }, 500);
    }
    for (const row of (boardItems || []) as BoardItem[]) {
      byId.set(String(row.id), row);
    }
  }

  const requiredIds = [
    ...placements.map((p) => String(p.id)),
    starting_bag_id,
    route_r3_item_id,
    route_r10_item_id,
  ];
  for (const id of requiredIds) {
    if (!byId.has(id)) {
      return json({ error: 'Board has unknown items.' }, 400);
    }
  }

  // Soft-skip unknown ids inside history rounds (catalog gaps)
  const historyClean = history
    ? filterHistoryUnknown(history, byId)
    : null;
  if (history && (!historyClean || !historyClean.rounds.length)) {
    return json({ error: 'History rounds have no known catalog items.' }, 400);
  }

  const starterRow = byId.get(starting_bag_id);
  if (!starterRow || String(starterRow.type || '') !== 'Bag') {
    return json({ error: 'Starting bag must be a Bag item.' }, 400);
  }
  const r3 = byId.get(route_r3_item_id);
  const r10 = byId.get(route_r10_item_id);
  if (!r3 || String(r3.type || '') !== 'Skill') {
    return json({ error: 'Round 3 skill must be a Skill item.' }, 400);
  }
  if (!r10 || String(r10.type || '') !== 'Skill') {
    return json({ error: 'Round 10 skill must be a Skill item.' }, 400);
  }
  const accessErr = validateItemAccess(hero_class, byId, [
    ...placements.map((p) => String(p.id)),
    route_r3_item_id,
    route_r10_item_id,
  ]);
  if (accessErr) return json({ error: accessErr }, 400);

  let slug = makeSlug(title);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = attempt === 0 ? slug : `${slug}-${randSuffix()}`;
    const insertRow: Record<string, unknown> = {
      slug: candidate,
      title,
      blurb: blurb || null,
      notes: notes || null,
      hero_class,
      build_tag,
      youtube_url,
      author_id: author!.author_id,
      author_name: author!.author_name,
      is_op: false,
      op_requested,
      is_featured: false,
      is_public: !eventEntryHeld(event_slug),
      event_held: eventEntryHeld(event_slug),
      gold_count,
      rank,
      route_r3_item_id,
      route_r10_item_id,
      starting_bag_id,
    };
    if (historyClean) insertRow.history = historyClean;
    if (board_still_path) insertRow.board_still_path = board_still_path;
    if (event_slug) insertRow.event_slug = event_slug;

    const { data: build, error: buildErr } = await supabase
      .from('builds')
      .insert(insertRow)
      .select('id, slug')
      .single();

    if (buildErr) {
      if (buildErr.code === '23505') continue; // unique slug
      console.error(buildErr);
      return json({ error: 'Could not create build', detail: buildErr.message }, 500);
    }

    const rows = placements.map((p) => ({
      build_id: build.id,
      item_id: String(p.id),
      x: Number(p.x),
      y: Number(p.y),
      r: Number.isFinite(Number(p.r)) ? Math.round(Number(p.r)) : 0,
      gems: Array.isArray(p.gems) ? p.gems.map(String) : [],
      priority:
        p.priority === 'needed' || p.priority === 'nice' || p.priority === 'optional'
          ? p.priority
          : null,
    }));

    const { error: placeErr } = await supabase.from('build_placements').insert(rows);
    if (placeErr) {
      console.error(placeErr);
      await supabase.from('builds').delete().eq('id', build.id);
      return json({ error: 'Could not save placements', detail: placeErr.message }, 500);
    }

    if (author!.discord_id && author!.author_id) {
      const { count } = await supabase
        .from('builds')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', author!.author_id);
      const { data: planRow } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', author!.author_id)
        .maybeSingle();
      try {
        await syncPlanRoles(
          author!.discord_id,
          String(planRow?.plan || 'free'),
          count || 0,
        );
      } catch (err) {
        console.error('discord nick', err);
      }
    }

    return json({ id: build.id, slug: build.slug }, 200);
  }

  return json({ error: 'Could not allocate a unique slug' }, 500);
});

function isLegalStartingBag(hero: string, itemId: string): boolean {
  const ids = CLASS_STARTING_BAG_IDS[hero];
  return Array.isArray(ids) && ids.includes(itemId);
}

function heroBit(hero: string): number {
  const bit = CLASS_BITS[hero];
  return typeof bit === 'number' && bit > 0 && bit !== CLASS_BITS.Neutral
    ? bit
    : 0;
}

function itemMask(item: BoardItem): number {
  const stuffed = STUFFED_CLASS_MASK_OVERRIDES[String(item.id || '')];
  if (typeof stuffed === 'number') return stuffed;
  const parts = String(item.class || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  if (parts.length === 1 && parts[0] === 'Neutral') return CLASS_BITS.Neutral;
  let bits = 0;
  for (const c of parts) {
    if (c === 'Neutral') continue;
    bits |= CLASS_BITS[c] || 0;
  }
  return bits || CLASS_BITS.None;
}

function itemMatchesHero(hero: string, item: BoardItem): boolean {
  const mask = itemMask(item);
  if (mask === CLASS_BITS.Neutral || mask === CLASS_BITS.None) return true;
  const bit = heroBit(hero);
  if (!bit) return true;
  return (mask & bit) > 0;
}

/** Mirror js/shared/item-access.js hard verdicts only. */
function validateItemAccess(
  hero: string,
  byId: Map<string, BoardItem>,
  ids: string[],
): string | null {
  for (const id of ids) {
    const item = byId.get(id);
    if (!item || itemMatchesHero(hero, item)) continue;
    const type = String(item.type || '');
    if (type === 'Skill') {
      return `Skill “${id}” doesn’t match this hero.`;
    }
    const rarity = String(item.rarity || '');
    const isClassUnique = rarity === 'Unique' && !TREASURE_IDS.has(id);
    if (isClassUnique) {
      return `Class Unique “${id}” doesn’t match this hero.`;
    }
  }
  return null;
}

function normalizePlacement(raw: unknown): Placement | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const id = String(p.id || '').trim();
  if (!id) return null;
  const x = Number(p.x);
  const y = Number(p.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const out: Placement = {
    id,
    x,
    y,
    r: Number.isFinite(Number(p.r)) ? Math.round(Number(p.r)) : 0,
  };
  if (Array.isArray(p.gems)) {
    out.gems = p.gems.map((g) => (g == null || g === '' ? '' : String(g)));
  }
  if (p.priority === 'needed' || p.priority === 'nice' || p.priority === 'optional') {
    out.priority = p.priority;
  }
  return out;
}

function normalizeHistory(
  raw: unknown,
): { history: BuildHistory | null; error?: string } {
  if (raw == null) return { history: null };
  let encoded = '';
  try {
    encoded = JSON.stringify(raw);
  } catch {
    return { history: null, error: 'Invalid history payload.' };
  }
  if (encoded.length > HISTORY_MAX_JSON_CHARS) {
    return { history: null, error: 'History payload is too large.' };
  }
  if (!raw || typeof raw !== 'object') {
    return { history: null, error: 'Invalid history payload.' };
  }
  const o = raw as Record<string, unknown>;
  const roundsIn = Array.isArray(o.rounds) ? o.rounds : [];
  if (!roundsIn.length) {
    return { history: null, error: 'History has no rounds.' };
  }
  if (roundsIn.length > HISTORY_MAX_ROUNDS) {
    return { history: null, error: `History exceeds ${HISTORY_MAX_ROUNDS} rounds.` };
  }
  const rounds: HistoryRound[] = [];
  for (const row of roundsIn) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const roundNum = Number(r.round);
    if (!Number.isFinite(roundNum)) continue;
    const result = r.result === 'win' ? 'win' : r.result === 'loss' ? 'loss' : null;
    if (!result) continue;
    const placements = (Array.isArray(r.placements) ? r.placements : [])
      .map(normalizePlacement)
      .filter((p): p is Placement => Boolean(p));
    rounds.push({ round: Math.round(roundNum), result, placements });
  }
  if (!rounds.length) {
    return { history: null, error: 'History has no usable rounds.' };
  }
  const runIdNum = Number(o.runId);
  return {
    history: {
      runId: Number.isFinite(runIdNum) ? Math.round(runIdNum) : 0,
      rounds,
    },
  };
}

function mergePriorities(
  lastRound: Placement[],
  draftPlacements: Placement[],
): Placement[] {
  const prio = new Map<string, Priority>();
  for (const p of draftPlacements) {
    if (!p?.id || p.priority == null) continue;
    const r = Number.isFinite(Number(p.r)) ? Math.round(Number(p.r)) : 0;
    prio.set(`${p.id}|${p.x}|${p.y}|${r}`, p.priority);
  }
  return lastRound.map((p) => {
    const r = Number.isFinite(Number(p.r)) ? Math.round(Number(p.r)) : 0;
    const key = `${p.id}|${p.x}|${p.y}|${r}`;
    const priority = prio.get(key) ?? p.priority ?? null;
    return { ...p, r, priority };
  });
}

function filterHistoryUnknown(
  history: BuildHistory,
  byId: Map<string, BoardItem>,
): BuildHistory | null {
  const rounds: HistoryRound[] = [];
  for (const row of history.rounds) {
    const placements = row.placements
      .filter((p) => byId.has(String(p.id)))
      .map((p) => {
        const next: Placement = { ...p };
        if (Array.isArray(p.gems)) {
          next.gems = p.gems.map((g) => {
            if (g == null || g === '') return '';
            const id = String(g);
            return byId.has(id) ? id : '';
          });
        }
        return next;
      });
    rounds.push({ ...row, placements });
  }
  if (!rounds.some((r) => r.placements.length)) return null;
  return { runId: history.runId, rounds };
}

function validateDraft(d: DraftBody): string | null {
  if (!String(d.title || '').trim()) return 'Title is required.';
  const hero = String(d.hero_class || '').trim();
  if (!hero || !HERO_CLASSES.has(hero)) return 'Pick a class.';
  const starting_bag_id = String(d.starting_bag_id || '').trim();
  if (!starting_bag_id || !isLegalStartingBag(hero, starting_bag_id)) {
    return 'Pick a starting bag for this class.';
  }
  const tag =
    d.build_tag === 'theorycraft'
      ? 'theory'
      : d.build_tag === 'theory' ||
          d.build_tag === 'feasible' ||
          d.build_tag === 'real'
        ? d.build_tag
        : null;
  const hasHistory =
    d.history != null &&
    typeof d.history === 'object' &&
    Array.isArray((d.history as { rounds?: unknown }).rounds) &&
    ((d.history as { rounds: unknown[] }).rounds.length > 0);
  const hasTag = d.is_op === true || tag === 'feasible' || tag === 'theory' || tag === 'real';
  if (!hasTag) return 'Pick a tag (Theory, Feasible, Real, or OP).';
  if (tag === 'real' && !hasHistory) return 'Real requires attached run history.';
  if (hasHistory && tag !== 'real' && d.is_op !== true) {
    /* history forces real later; allow op-only without explicit tag */
  }
  if (!String(d.rank || '').trim()) return 'Pick a league rank.';
  if (!Array.isArray(d.placements) || !d.placements.length) {
    return 'Place at least one item on the board.';
  }
  if (!String(d.route_r3_item_id || '').trim()) return 'Round 3 skill is required.';
  if (!String(d.route_r10_item_id || '').trim()) return 'Round 10 skill is required.';
  if (d.youtube_url && !YT_RE.test(String(d.youtube_url))) {
    return 'Fix or clear the YouTube link.';
  }
  if (d.is_op && (tag === 'theory' || d.build_tag === 'theorycraft')) {
    return 'OP can’t be combined with Theory.';
  }
  if (d.is_op === true) {
    const placements = Array.isArray(d.placements) ? d.placements : [];
    const hasNeeds = placements.some((p) => p.priority === 'needed');
    const hasWants = placements.some((p) => p.priority === 'nice');
    const hasGood = placements.some((p) => p.priority === 'optional');
    if (!hasNeeds || !hasWants || !hasGood) {
      return 'OP review needs at least one item in Needs, Wants, and Good to have.';
    }
    const notesLen = String(d.notes || '').trim().length;
    if (notesLen < 30) {
      return 'OP review needs a “Why it works” description of at least 30 characters.';
    }
  }
  for (const p of d.placements) {
    if (!p?.id || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) {
      return 'Invalid placement.';
    }
  }
  return null;
}

/** Contest boards stay hidden until the gallery clock in event-gallery.json. */
function eventEntryHeld(slug: string | null): boolean {
  if (!slug) return false;
  const opens = (galleryOpens as Record<string, string>)[slug];
  if (!opens) return false;
  const t = Date.parse(opens);
  return Number.isFinite(t) && Date.now() < t;
}

function makeSlug(title: string): string {
  const base = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `bpbb-${base || 'build'}-${randSuffix()}`;
}

function randSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
