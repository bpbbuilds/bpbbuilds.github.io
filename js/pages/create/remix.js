/**
 * Remix preload — /create/?remix={slug} → draft from a public build.
 */

import { getSupabase } from '../../shared/supabase.js';
import {
  emptyDraft,
  newPlacementKey,
  normalizeBuildTag,
  normalizeDraftHistory,
} from './draft-io.js';

const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, cost, effect, image, shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max, block, chance, chance_tag, params';

const TITLE_MAX = 80;

/** @returns {string} */
export function readRemixSlug() {
  try {
    const q = new URLSearchParams(location.search);
    return String(q.get('remix') || '').trim();
  } catch {
    return '';
  }
}

/** Drop ?remix= without a navigation. */
export function clearRemixParam() {
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has('remix')) return;
    url.searchParams.delete('remix');
    const next = `${url.pathname}${url.search}${url.hash}`;
    history.replaceState(null, '', next);
  } catch {
    /* ignore */
  }
}

/**
 * @param {import('./draft-io.js').Draft} draft
 */
export function draftLooksDirty(draft) {
  if (!draft) return false;
  if (String(draft.title || '').trim()) return true;
  if (Array.isArray(draft.placements) && draft.placements.length) return true;
  if (Array.isArray(draft.parked) && draft.parked.length) return true;
  return false;
}

/**
 * @param {string} slug
 * @returns {Promise<object>}
 */
export async function fetchRemixBuild(slug) {
  const key = String(slug || '').trim();
  if (!key) throw new Error('Missing remix slug.');

  const { syncEventBuildVisibility } = await import('../events/event-gallery-sync.js');
  await syncEventBuildVisibility();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('builds')
    .select(
      `
      slug, title, hero_class, build_tag, rank, gold_count, history,
      starting_bag_id, route_r3_item_id, route_r10_item_id,
      placements:build_placements (
        id, x, y, r, gems, priority,
        item:items ( ${ITEM_SELECT} )
      )
    `,
    )
    .eq('slug', key)
    .eq('is_public', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Build not found (or not public).');
  return data;
}

/**
 * @param {object} build
 * @returns {import('./draft-io.js').Draft}
 */
export function draftFromRemixBuild(build) {
  const sourceTitle = String(build?.title || build?.slug || 'build').trim();
  const title = remixTitle(sourceTitle);

  /** @type {import('./draft-io.js').DraftPlacement[]} */
  const placements = [];
  for (const [i, p] of (build.placements || []).entries()) {
    const itemId = String(p?.item?.id || p?.item_id || '').trim();
    if (!itemId) continue;
    /** @type {import('./draft-io.js').Priority} */
    let priority = null;
    if (p.priority === 'needed' || p.priority === 'nice' || p.priority === 'optional') {
      priority = p.priority;
    }
    /** @type {import('./draft-io.js').DraftPlacement} */
    const row = {
      id: itemId,
      x: Number(p.x) || 0,
      y: Number(p.y) || 0,
      r: ((Number(p.r) || 0) % 4 + 4) % 4,
      key: newPlacementKey(),
      priority,
    };
    if (Array.isArray(p.gems) && p.gems.length) {
      row.gems = p.gems.map((g) => (g == null || g === '' ? '' : String(g)));
    }
    placements.push(row);
    void i;
  }

  const history = normalizeDraftHistory(build.history);
  let buildTag = normalizeBuildTag(build.build_tag);
  if (history) buildTag = 'real';
  else if (buildTag === 'real') buildTag = 'feasible';

  return {
    ...emptyDraft(),
    title,
    blurb: '',
    notes: '',
    hero_class: String(build.hero_class || 'Adventurer').trim() || 'Adventurer',
    build_tag: buildTag,
    is_op: false,
    youtube_url: null,
    gold_count: Math.max(0, Math.round(Number(build.gold_count) || 0)),
    rank: build.rank != null && String(build.rank).trim() ? String(build.rank).trim() : null,
    route_r3_item_id:
      build.route_r3_item_id != null && String(build.route_r3_item_id).trim()
        ? String(build.route_r3_item_id).trim()
        : null,
    route_r10_item_id:
      build.route_r10_item_id != null && String(build.route_r10_item_id).trim()
        ? String(build.route_r10_item_id).trim()
        : null,
    starting_bag_id:
      build.starting_bag_id != null && String(build.starting_bag_id).trim()
        ? String(build.starting_bag_id).trim()
        : null,
    placements,
    parked: [],
    history,
  };
}

/**
 * Apply ?remix= into editor state (confirm if dirty). Always clears the param.
 * @param {{
 *   getDraft: () => import('./draft-io.js').Draft,
 *   replaceDraft: (d: import('./draft-io.js').Draft) => void,
 * }} state
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function applyRemixFromUrl(state) {
  const slug = readRemixSlug();
  if (!slug) return { ok: false };

  if (draftLooksDirty(state.getDraft())) {
    const ok = window.confirm(
      'Load this remix into the creator? Your current draft will be replaced.',
    );
    if (!ok) {
      clearRemixParam();
      return { ok: false };
    }
  }

  try {
    const build = await fetchRemixBuild(slug);
    state.replaceDraft(draftFromRemixBuild(build));
    clearRemixParam();
    return { ok: true };
  } catch (err) {
    clearRemixParam();
    const message =
      err instanceof Error ? err.message : 'Could not load remix build.';
    return { ok: false, error: message };
  }
}

/** @param {string} sourceTitle */
function remixTitle(sourceTitle) {
  const base = String(sourceTitle || 'build').trim() || 'build';
  // Avoid "Remix of Remix of …"
  const cleaned = base.replace(/^remix of\s+/i, '').trim() || 'build';
  const title = `Remix of ${cleaned}`;
  if (title.length <= TITLE_MAX) return title;
  return title.slice(0, TITLE_MAX - 1).trimEnd() + '…';
}
