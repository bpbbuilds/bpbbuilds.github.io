/**
 * Filter history runs with the builds-page search (items + free text).
 * @user is ignored — a history.db is only this player's runs.
 */

import { buildMatchesSearch, buildSearchRank } from '../../../shared/build-search.js';
import { decodeHistoryRun } from '../history-db.js';

/**
 * @param {import('../history-db.js').HistoryRunSummary} summary
 * @param {Set<string>} itemIds
 * @param {import('../../../shared/build-search.js').ParsedBuildSearch} parsed
 * @param {Map<string, object>} itemsById
 */
export function historyRunMatchesSearch(summary, itemIds, parsed, itemsById) {
  const p = { ...parsed, users: [] };
  if (!p.free.length && !p.itemIds.length && !p.itemQueries.length) return true;

  return buildMatchesSearch(
    historySearchBuild(summary, itemIds, itemsById),
    p,
    [...itemsById.values()],
  );
}

/**
 * Exact item names rank above longer names that only contain the word.
 * @param {import('../history-db.js').HistoryRunSummary} summary
 * @param {Set<string>} itemIds
 * @param {import('../../../shared/build-search.js').ParsedBuildSearch} parsed
 * @param {Map<string, object>} itemsById
 */
export function historyRunSearchRank(summary, itemIds, parsed, itemsById) {
  return buildSearchRank(historySearchBuild(summary, itemIds, itemsById), {
    ...parsed,
    users: [],
  });
}

/**
 * @param {import('../history-db.js').HistoryRunSummary} summary
 * @param {Set<string>} itemIds
 * @param {Map<string, object>} itemsById
 */
function historySearchBuild(summary, itemIds, itemsById) {
  /** @type {{ id: string, item: object }[]} */
  const placements = [];
  for (const id of itemIds) {
    const item = lookupItem(itemsById, id);
    placements.push({
      id,
      item: item || { id, name: String(id).replace(/_/g, ' ') },
    });
  }
  return {
    hero_class: summary.heroClass || '',
    title: [summary.heroClass, summary.rank, summary.version].filter(Boolean).join(' '),
    author_name: '',
    placements,
  };
}

/** @type {Map<string, object> | null} */
let lookupSource = null;
/** @type {Map<string, object>} */
let lookupByLower = new Map();

/**
 * @param {Map<string, object>} itemsById
 * @param {string} id
 */
function lookupItem(itemsById, id) {
  if (lookupSource !== itemsById) {
    lookupSource = itemsById;
    lookupByLower = new Map();
    for (const [key, item] of itemsById) {
      lookupByLower.set(String(key).toLowerCase(), item);
    }
  }
  return itemsById.get(id) || lookupByLower.get(String(id).toLowerCase()) || null;
}

/**
 * Collect board item ids for each run. Yields between runs so the list stays usable.
 * @param {any} db
 * @param {import('../history-db.js').HistoryRunSummary[]} summaries
 * @param {string} root
 * @param {{
 *   idsByRun: Map<number, Set<string>>,
 *   isCancelled: () => boolean,
 *   onProgress?: () => void,
 * }} hooks
 */
export async function indexHistoryItemIds(db, summaries, root, hooks) {
  for (const summary of summaries) {
    if (hooks.isCancelled()) return;
    if (hooks.idsByRun.has(summary.runId)) continue;
    /** @type {Set<string>} */
    const ids = new Set();
    try {
      const run = await decodeHistoryRun(db, summary, root);
      for (const round of run.rounds || []) {
        for (const placement of round.placements || []) {
          const id = String(placement.id || '').trim().toLowerCase();
          if (id) ids.add(id);
        }
      }
    } catch {
      /* keep an empty set so we don't retry a bad run */
    }
    hooks.idsByRun.set(summary.runId, ids);
    hooks.onProgress?.();
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}
