/**
 * Apply a decoded history run onto the create draft.
 */

import { newPlacementKey, normalizeDraftHistory } from './draft-io.js';
import { sumBoardGold } from './draft-gold.js';
import { startingBagIdForLoadout } from '../../shared/starting-bags.js';
import { loadHistoryCatalog } from './history-decode.js';

/**
 * @param {Map<string, object>} itemsById
 * @param {number} gid
 * @param {import('./history-decode.js').HistoryDecodeCatalog} cat
 * @returns {string | null}
 */
function idFromGid(itemsById, gid, cat) {
  const fromCat = cat.gidToId[String(gid)];
  if (fromCat && itemsById.has(fromCat)) return fromCat;
  for (const item of itemsById.values()) {
    if (Number(item.gid) === Number(gid)) return String(item.id);
  }
  return fromCat || null;
}

/**
 * @param {{
 *   state: ReturnType<import('./editor-state.js').createEditorState>,
 *   itemsById: Map<string, object>,
 *   run: import('./history-db.js').HistoryDecodedRun,
 *   root: string,
 *   placements?: import('./draft-io.js').DraftPlacement[] | null,
 *   roundIndex?: number | null,
 * }} opts
 */
export async function applyHistoryRunToDraft(opts) {
  const { state, itemsById, run, root } = opts;
  const cat = await loadHistoryCatalog(root);

  /** @type {import('./draft-io.js').DraftPlacement[] | undefined} */
  let source = Array.isArray(opts.placements) ? opts.placements : undefined;
  if (!source?.length) {
    const idx =
      opts.roundIndex != null && Number.isFinite(opts.roundIndex)
        ? Math.max(0, Math.min(run.rounds.length - 1, Number(opts.roundIndex)))
        : run.rounds.length - 1;
    source = run.rounds[idx]?.placements;
  }
  if (!source?.length) {
    throw new Error('That run has an empty board for the selected round.');
  }

  const placements = source
    .filter((p) => p.id && itemsById.has(p.id))
    .map((p) => ({
      ...p,
      key: p.key || newPlacementKey(),
      priority: null,
    }));

  if (!placements.length) {
    throw new Error('Could not map run items to the catalog.');
  }

  const hero = run.heroClass;
  const starting_bag_id = hero
    ? startingBagIdForLoadout(hero, run.loadout)
    : null;

  const r3 =
    Number(run.skill1Gid) > 0
      ? idFromGid(itemsById, run.skill1Gid, cat)
      : null;
  const r10 =
    Number(run.skill2Gid) > 0
      ? idFromGid(itemsById, run.skill2Gid, cat)
      : null;
  const gold = sumBoardGold(placements, itemsById);

  const history = normalizeDraftHistory(run);
  if (!history) {
    throw new Error('That run has no usable round history.');
  }

  const prev = state.getDraft();
  state.replaceDraft({
    ...prev,
    hero_class: hero,
    starting_bag_id,
    rank: run.rank || null,
    gold_count: gold,
    route_r3_item_id: r3,
    route_r10_item_id: r10,
    placements,
    parked: [],
    history,
    build_tag: 'real',
    // Real + OP is allowed; Theory is not relevant with attached history
  });
}
