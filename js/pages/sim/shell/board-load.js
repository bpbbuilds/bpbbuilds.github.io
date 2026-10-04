/**
 * Load a sim board from ?slug= (published build or the signed-in author's
 * held event build) or create draft localStorage.
 */

import { getProfile } from '../../../shared/auth.js';
import { getSupabase } from '../../../shared/supabase.js';
import { loadDraft } from '../../create/draft-io.js';
import {
  mapItem,
  makeSpriteUrl,
  applyShapes,
  applySocketOffsets,
} from '../../build/map-item.js';
import { readSimQuery } from './sim-permalink.js';
import { framesFromHistoryRun } from '../../build/round-scrubber.js';
import { bakeBlobFaceUrl } from '../../../shared/blob-face.js';
import { resolveEquippedAvatarUrl, resolveIdentityMode } from '../../../shared/profile-avatar.js';

const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

/**
 * @typedef {{
 *   source: 'slug' | 'draft' | 'empty',
 *   title: string,
 *   authorName: string | null,
 *   authorAvatarUrl?: string | null,
 *   authorAvatarKind?: 'blob' | 'profile' | null,
 *   heroClass: string | null,
 *   slug: string | null,
 *   round: number | null,
 *   placements: { id: string, x: number, y: number, r: number, key: string, gems?: string[], instance?: import('../../engine/placement-instance.js').PlacementInstance }[],
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   rounds?: number[],
 *   publishedPlacements?: SimBoardLoad['placements'],
 *   historyFrames?: {
 *     round: number,
 *     result: 'win' | 'loss',
 *     placements: object[],
 *     playerMaxHp?: number | null,
 *     playerMaxStamina?: number | null,
 *   }[],
 *   youtubeUrl?: string | null,
 *   playerMaxHp?: number | null,
 *   playerMaxStamina?: number | null,
 *   error?: string,
 * }} SimBoardLoad
 */

function rootPrefix() {
  const raw = document.body?.dataset?.root ?? '../';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** @returns {string | null} */
export function slugFromQuery() {
  const q = new URLSearchParams(location.search).get('slug');
  if (q && String(q).trim()) return String(q).trim();
  return null;
}

/**
 * @param {string} path
 * @param {number} [ms]
 */
async function fetchJson(path, ms = 15000) {
  try {
    const res = await fetch(path, { signal: AbortSignal.timeout(ms) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * @param {string} root
 */
async function loadGridMeta(root) {
  const [shapes, sockets, spriteDisplay] = await Promise.all([
    fetchJson(`${root}assets/data/item-shapes.json`),
    fetchJson(`${root}assets/data/socket-offsets.json`),
    fetchJson(`${root}assets/data/sprite-display.json`),
  ]);
  return { shapes, sockets, spriteDisplay };
}

/**
 * @param {object[]} rows
 * @param {{ shapes?: object | null, sockets?: object | null }} meta
 */
function itemsMapFromRows(rows, meta) {
  const items = (rows || []).map(mapItem).filter(Boolean);
  applyShapes(items, meta.shapes || null);
  applySocketOffsets(items, meta.sockets || null);
  return new Map(items.map((it) => [it.id, it]));
}

/**
 * @param {string} slug
 * @param {string} root
 */
async function fetchBuildBySlug(slug) {
  try {
    const { syncEventBuildVisibility } = await import('../../events/event-gallery-sync.js');
    await syncEventBuildVisibility();
    const supabase = getSupabase();
    const viewer = await getProfile().catch(() => null);
    const select = `
      id, slug, title, hero_class, author_id, author_name, history, youtube_url,
      event_held,
      profile:profiles!builds_author_id_fkey ( avatar_url, equipped_avatar ),
      placements:build_placements (
        id, x, y, r, gems,
        item:items ( ${ITEM_SELECT} )
      )
    `;
    let { data, error } = await supabase
      .from('builds')
      .select(select)
      .eq('slug', slug)
      .eq('is_public', true)
      .maybeSingle();
    if (error) throw error;
    if (!data && viewer?.id) {
      const own = await supabase
        .from('builds')
        .select(select)
        .eq('slug', slug)
        .eq('author_id', viewer.id)
        .maybeSingle();
      if (own.error) throw own.error;
      data = own.data;
    }
    return data || null;
  } catch {
    return null;
  }
}

/**
 * @param {string[]} ids
 */
async function fetchItemsByIds(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('items')
    .select(ITEM_SELECT)
    .in('id', unique);
  if (error) throw error;
  return data || [];
}

/**
 * @param {{ gems?: string[] }[]} placements
 * @returns {string[]}
 */
function gemIdsFromPlacements(placements) {
  /** @type {string[]} */
  const ids = [];
  for (const p of placements || []) {
    if (!Array.isArray(p.gems)) continue;
    for (const g of p.gems) {
      if (g) ids.push(String(g));
    }
  }
  return ids;
}

/**
 * @param {{
 *   profile?: { avatar_url?: string | null, equipped_avatar?: string | null } | null,
 *   author_avatar_url?: string | null,
 * } | null | undefined} build
 * @param {string} root
 * @returns {Promise<{ url: string | null, kind: 'blob' | 'profile' | null }>}
 */
async function authorAvatarFromBuild(build, root) {
  const profile = build?.profile || null;
  if (resolveIdentityMode(profile) === 'blob') {
    const url =
      (await bakeBlobFaceUrl(profile, root, 256)) ||
      resolveEquippedAvatarUrl(profile, root);
    return { url: url || null, kind: url ? 'blob' : null };
  }
  const resolved = resolveEquippedAvatarUrl(profile, root);
  if (resolved) return { url: resolved, kind: 'profile' };
  const snap = String(build?.author_avatar_url || '').trim();
  return { url: snap || null, kind: snap ? 'profile' : null };
}

/**
 * @param {Map<string, object>} itemsById
 * @param {object[]} rows
 * @param {{ shapes?: object | null, sockets?: object | null }} meta
 */
function mergeItemRows(itemsById, rows, meta) {
  const mapped = itemsMapFromRows(rows, meta);
  for (const [id, item] of mapped) itemsById.set(id, item);
}

/**
 * @param {{ rounds?: { round?: number, health?: number, stamina?: number, placements?: object[] }[] } | null | undefined} history
 * @param {number | null} round
 */
function historyRoundRow(history, round) {
  if (round == null || !Array.isArray(history?.rounds)) return null;
  return history.rounds.find((r) => Number(r.round) === round) || null;
}

/**
 * @param {{ rounds?: { round?: number, placements?: object[] }[] } | null | undefined} history
 * @param {number | null} round
 */
function historyRoundPlacements(history, round) {
  const hit = historyRoundRow(history, round);
  if (!hit) return null;
  return Array.isArray(hit.placements) ? hit.placements : [];
}

/**
 * Vitals from history.db buildInfo header (Game.PLAYER.getBaseMaxHealth / getMaxBaseStamina).
 * @param {{ rounds?: { round?: number, health?: number, stamina?: number }[] } | null | undefined} history
 * @param {number | null} round
 */
function historyRoundVitals(history, round) {
  const hit = historyRoundRow(history, round);
  if (!hit) return { health: null, stamina: null };
  const health = Number(hit.health);
  const stamina = Number(hit.stamina);
  const out = {
    health: Number.isFinite(health) && health > 0 ? Math.round(health) : null,
    stamina: Number.isFinite(stamina) && stamina > 0 ? stamina : null,
  };
  return out;
}

/**
 * @param {{ rounds?: { round?: number }[] } | null | undefined} history
 * @returns {number[]}
 */
function listHistoryRounds(history) {
  const rows = Array.isArray(history?.rounds)
    ? history.rounds
    : Array.isArray(history?.history?.rounds)
      ? history.history.rounds
      : [];
  const nums = rows
    .map((r) => Number(r.round))
    .filter((n) => Number.isFinite(n) && n >= 1);
  return [...new Set(nums)].sort((a, b) => a - b);
}

/**
 * @param {{ rounds?: object[] } | null | undefined} history
 * @param {Map<string, object>} itemsById
 */
function buildHistoryFrames(history, itemsById) {
  const raw = framesFromHistoryRun(history);
  if (!raw.length) return [];
  return raw
    .map((frame) => {
      const vitals = historyRoundVitals(history, frame.round);
      return {
        ...frame,
        placements: mapIdPlacements(frame.placements || [], itemsById),
        playerMaxHp: vitals.health,
        playerMaxStamina: vitals.stamina,
      };
    })
    .filter((frame) => frame.placements.length > 0);
}

/**
 * @param {Map<string, object>} itemsById
 * @param {{ rounds?: { placements?: object[] }[] } | null | undefined} history
 * @param {{ shapes?: object | null, sockets?: object | null }} meta
 */
async function ensureHistoryCatalogItems(itemsById, history, meta) {
  const rounds = history?.rounds;
  if (!Array.isArray(rounds) || !rounds.length) return;
  const have = new Set(itemsById.keys());
  /** @type {string[]} */
  const need = [];
  for (const r of rounds) {
    for (const p of r.placements || []) {
      if (p?.id && !have.has(p.id)) {
        need.push(p.id);
        have.add(p.id);
      }
      for (const g of p.gems || []) {
        if (g && !have.has(g)) {
          need.push(String(g));
          have.add(String(g));
        }
      }
    }
  }
  if (!need.length) return;
  try {
    await ensureCatalogItems(itemsById, need, meta);
  } catch {
    /* history extras optional */
  }
}

/**
 * @param {object[]} raw
 * @param {Map<string, object>} itemsById
 */
function mapPublishedPlacements(raw, itemsById) {
  return (raw || [])
    .filter((p) => p?.id && itemsById.has(p.id))
    .map((p, i) => {
      /** @type {SimBoardLoad['placements'][number]} */
      const row = {
        id: p.id,
        x: Number(p.x) || 0,
        y: Number(p.y) || 0,
        r: Number(p.r) || 0,
        key: String(p.key || `${p.id}:${i}:${p.x},${p.y}:${p.r || 0}`),
        gems: Array.isArray(p.gems) ? p.gems : undefined,
      };
      if (p.instance && typeof p.instance === 'object') {
        row.instance = p.instance;
      }
      return row;
    });
}

/**
 * @param {object[]} raw
 * @param {Map<string, object>} itemsById
 */
function mapIdPlacements(raw, itemsById) {
  return (raw || [])
    .filter((p) => p?.id && itemsById.has(p.id))
    .map((p, i) => {
      /** @type {SimBoardLoad['placements'][number]} */
      const row = {
        id: p.id,
        x: Number(p.x) || 0,
        y: Number(p.y) || 0,
        r: Number(p.r) || 0,
        key: String(p.key || `${p.id}:${i}:${p.x},${p.y}:${p.r || 0}`),
        gems: Array.isArray(p.gems) ? p.gems : undefined,
      };
      if (p.instance && typeof p.instance === 'object') {
        row.instance = p.instance;
      }
      return row;
    });
}

/**
 * @param {Map<string, object>} itemsById
 * @param {string[]} ids
 * @param {{ shapes?: object | null, sockets?: object | null }} meta
 */
async function ensureCatalogItems(itemsById, ids, meta) {
  const missing = [...new Set(ids.filter(Boolean))].filter(
    (id) => !itemsById.has(id),
  );
  if (!missing.length) return;
  const rows = await fetchItemsByIds(missing);
  mergeItemRows(itemsById, rows, meta);
}

/**
 * @param {string} slug
 * @param {number | null} round
 * @param {string} root
 * @param {object} meta
 * @param {(item: object) => string} getSpriteUrl
 * @returns {Promise<SimBoardLoad | null>}
 */
async function loadAuthorHistoryBoard(slug, round, root, meta, getSpriteUrl) {
  const m = /^history-(\d+)$/i.exec(slug);
  if (!m) return null;
  const runId = Number(m[1]);
  const bundle = await fetchJson(`${root}assets/data/author-history-builds.json`);
  const entry = bundle?.builds?.find((b) => Number(b.runId) === runId);
  if (!entry) return null;

  const byId = new Map((bundle.items || []).map((row) => [row.id, row]));
  const itemsById = itemsMapFromRows([...byId.values()], meta);
  await ensureHistoryCatalogItems(itemsById, entry, meta);
  const publishedPlacements = mapPublishedPlacements(entry.placements || [], itemsById);
  const histRaw = historyRoundPlacements(entry, round);
  const raw = histRaw || entry.placements || [];
  const usedRound = histRaw ? round : null;
  const vitals = usedRound != null ? historyRoundVitals(entry, usedRound) : { health: null, stamina: null };
  try {
    await ensureCatalogItems(
      itemsById,
      [...raw.map((p) => p.id), ...gemIdsFromPlacements(raw)],
      meta,
    );
  } catch {
    /* catalog extras optional */
  }
  const placements = mapIdPlacements(raw, itemsById);
  const historyFrames = buildHistoryFrames(entry, itemsById);
  if (!placements.length) {
    return {
      source: 'slug',
      title: String(entry.title || slug),
      authorName: String(bundle?.author_name || '').trim() || null,
      heroClass: entry.hero_class || null,
      slug,
      round: usedRound,
      rounds: listHistoryRounds(entry),
      historyFrames,
      publishedPlacements,
      youtubeUrl: entry.youtube_url || null,
      placements: [],
      itemsById,
      getSpriteUrl,
      playerMaxHp: vitals.health,
      playerMaxStamina: vitals.stamina,
      error:
        usedRound != null
          ? `Round ${usedRound} has no items on the board.`
          : 'This build has no items on the board.',
    };
  }
  return {
    source: 'slug',
    title: String(entry.title || slug),
    authorName: String(bundle?.author_name || '').trim() || null,
    heroClass: entry.hero_class || null,
    slug,
    round: usedRound,
    rounds: listHistoryRounds(entry),
    historyFrames,
    publishedPlacements,
    youtubeUrl: entry.youtube_url || null,
    placements,
    itemsById,
    getSpriteUrl,
    playerMaxHp: vitals.health,
    playerMaxStamina: vitals.stamina,
  };
}

/**
 * @param {string} slug
 * @param {number | null} round
 * @param {string} root
 * @param {object} meta
 * @param {(item: object) => string} getSpriteUrl
 * @returns {Promise<SimBoardLoad>}
 */
async function loadSlugBoard(slug, round, root, meta, getSpriteUrl) {
  const fromHistoryJson = await loadAuthorHistoryBoard(
    slug,
    round,
    root,
    meta,
    getSpriteUrl,
  );
  if (fromHistoryJson) return fromHistoryJson;

  const build = await fetchBuildBySlug(slug);
  if (!build) {
    return {
      source: 'empty',
      title: 'Build not found',
      authorName: null,
      heroClass: null,
      slug,
      round,
      placements: [],
      itemsById: new Map(),
      getSpriteUrl,
      rounds: [],
      error: `Could not load build “${slug}”.`,
    };
  }

  const rows = [];
  for (const p of build.placements || []) {
    if (p.item) rows.push(p.item);
  }
  const itemsById = itemsMapFromRows(rows, meta);
  await ensureHistoryCatalogItems(itemsById, build.history, meta);
  const publishedPlacements = mapPublishedPlacements(
    (build.placements || [])
      .filter((p) => p.item && itemsById.has(p.item.id))
      .map((p, i) => ({
        id: p.item.id,
        x: Number(p.x) || 0,
        y: Number(p.y) || 0,
        r: Number(p.r) || 0,
        key: String(p.id ?? `${p.item.id}:${i}:${p.x},${p.y}:${p.r || 0}`),
        gems: Array.isArray(p.gems) ? p.gems : undefined,
        instance: p.instance,
      })),
    itemsById,
  );
  const histRaw = historyRoundPlacements(build.history, round);
  let placements;
  let usedRound = null;
  let vitals = { health: null, stamina: null };
  if (histRaw) {
    try {
      await ensureCatalogItems(
        itemsById,
        [...histRaw.map((p) => p.id), ...gemIdsFromPlacements(histRaw)],
        meta,
      );
    } catch {
      /* extra history items optional */
    }
    placements = mapIdPlacements(histRaw, itemsById);
    usedRound = round;
    vitals = historyRoundVitals(build.history, usedRound);
  } else {
    placements = (build.placements || [])
      .filter((p) => p.item && itemsById.has(p.item.id))
      .map((p, i) => {
        /** @type {SimBoardLoad['placements'][number]} */
        const row = {
          id: p.item.id,
          x: Number(p.x) || 0,
          y: Number(p.y) || 0,
          r: Number(p.r) || 0,
          key: String(p.id ?? `${p.item.id}:${i}:${p.x},${p.y}:${p.r || 0}`),
          gems: Array.isArray(p.gems) ? p.gems : undefined,
        };
        if (p.instance && typeof p.instance === 'object') {
          row.instance = p.instance;
        }
        return row;
      });
  }

  const missingGems = gemIdsFromPlacements(placements).filter(
    (id) => !itemsById.has(id),
  );
  if (missingGems.length) {
    try {
      const gemRows = await fetchItemsByIds(missingGems);
      mergeItemRows(itemsById, gemRows, meta);
    } catch {
      /* gems optional */
    }
  }

  if (!placements.length) {
    const authorFace = await authorAvatarFromBuild(build, root);
    return {
      source: 'slug',
      title: String(build.title || slug),
      authorName: String(build.author_name || '').trim() || null,
      authorAvatarUrl: authorFace.url,
      authorAvatarKind: authorFace.kind,
      heroClass: build.hero_class || null,
      slug,
      round: usedRound,
      rounds: listHistoryRounds(build.history),
      historyFrames: buildHistoryFrames(build.history, itemsById),
      publishedPlacements,
      youtubeUrl: build.youtube_url || null,
      placements: [],
      itemsById,
      getSpriteUrl,
      playerMaxHp: vitals.health,
      playerMaxStamina: vitals.stamina,
      error:
        usedRound != null
          ? `Round ${usedRound} has no items on the board.`
          : 'This build has no items on the board.',
    };
  }

  const authorFace = await authorAvatarFromBuild(build, root);
  return {
    source: 'slug',
    title: String(build.title || slug),
    authorName: String(build.author_name || '').trim() || null,
    authorAvatarUrl: authorFace.url,
    authorAvatarKind: authorFace.kind,
    heroClass: build.hero_class || null,
    slug,
    round: usedRound,
    rounds: listHistoryRounds(build.history),
    historyFrames: buildHistoryFrames(build.history, itemsById),
    publishedPlacements,
    youtubeUrl: build.youtube_url || null,
    placements,
    itemsById,
    getSpriteUrl,
    playerMaxHp: vitals.health,
    playerMaxStamina: vitals.stamina,
  };
}

/**
 * Load a published / history slug (for `?oppSlug=`).
 * @param {string} slug
 * @param {number | null} [round]
 */
export async function loadSimBoardForSlug(slug, round = null) {
  const root = rootPrefix();
  const meta = await loadGridMeta(root);
  const getSpriteUrl = makeSpriteUrl(root, meta.spriteDisplay);
  return loadSlugBoard(slug, round, root, meta, getSpriteUrl);
}

/**
 * @returns {Promise<SimBoardLoad>}
 */
export async function loadSimBoard() {
  const root = rootPrefix();
  const meta = await loadGridMeta(root);
  const getSpriteUrl = makeSpriteUrl(root, meta.spriteDisplay);

  const slug = slugFromQuery();
  const round = readSimQuery().round;
  if (slug) {
    try {
      return await loadSlugBoard(slug, round, root, meta, getSpriteUrl);
    } catch {
      return {
        source: 'empty',
        title: 'Build not found',
        authorName: null,
        heroClass: null,
        slug,
        round,
        placements: [],
        itemsById: new Map(),
        getSpriteUrl,
        rounds: [],
        error: 'Could not load this build. Check your connection and try again.',
      };
    }
  }

  const draft = loadDraft();
  const placementsRaw = Array.isArray(draft?.placements) ? draft.placements : [];
  if (!placementsRaw.length) {
    return {
      source: 'empty',
      title: 'No board loaded',
      authorName: null,
      heroClass: draft?.hero_class || null,
      slug: null,
      round: null,
      placements: [],
      itemsById: new Map(),
      getSpriteUrl,
    };
  }

  try {
    const ids = [
      ...placementsRaw.map((p) => p.id),
      ...gemIdsFromPlacements(placementsRaw),
    ];
    const rows = await fetchItemsByIds(ids);
    const itemsById = itemsMapFromRows(rows, meta);
    const placements = placementsRaw
      .filter((p) => p?.id && itemsById.has(p.id))
      .map((p, i) => {
        /** @type {SimBoardLoad['placements'][number]} */
        const row = {
          id: p.id,
          x: Number(p.x) || 0,
          y: Number(p.y) || 0,
          r: Number(p.r) || 0,
          key: String(p.key || `${p.id}:${i}:${p.x},${p.y}:${p.r || 0}`),
          gems: Array.isArray(p.gems) ? p.gems : undefined,
        };
        if (p.instance && typeof p.instance === 'object') {
          row.instance = p.instance;
        }
        return row;
      });

    if (!placements.length) {
      return {
        source: 'empty',
        title: String(draft.title || 'Draft'),
        authorName: 'You',
        heroClass: draft.hero_class || null,
        slug: null,
      round: null,
        placements: [],
        itemsById,
        getSpriteUrl,
        error: 'Draft items could not be resolved from the catalog.',
      };
    }

    return {
      source: 'draft',
      title: String(draft.title || 'Create draft'),
      authorName: 'You',
      heroClass: draft.hero_class || null,
      slug: null,
      round: round,
      placements,
      itemsById,
      getSpriteUrl,
    };
  } catch (err) {
    return {
      source: 'empty',
      title: String(draft?.title || 'Draft'),
      authorName: 'You',
      heroClass: draft?.hero_class || null,
      slug: null,
      round: null,
      placements: [],
      itemsById: new Map(),
      getSpriteUrl,
      error: err?.message || 'Could not load draft items.',
    };
  }
}
