/**
 * History list row view-models from run summaries + lightweight results.
 */

import { classIconPath } from '../../../shared/class-icons.js';
import { startingBagIdForLoadout } from '../../../shared/starting-bags.js';
import { fetchRunResults } from '../history-db.js';
import { loadHistoryCatalog } from '../history-decode.js';
import { formatRelativeTime } from './relative-time.js';
import { computeHistoryRankDisplay } from './rating-math.js';

/** @type {Record<string, string>} */
const LEAGUE_FILES = {
  bronze: 'League_Bronze.png',
  silver: 'League_Silver.png',
  gold: 'League_Gold.png',
  platinum: 'League_Platinum.png',
  diamond: 'League_Diamond.png',
  master: 'League_Master.png',
  grandmaster: 'League_Grandmaster.png',
  grandma: 'League_Grandma.png',
};

/** Game Loadout.RandomCharacter */
export const LOADOUT_RANDOM_CHARACTER = 3;

/**
 * @param {string} root
 * @param {string | null | undefined} rank
 * @returns {string | null}
 */
export function leagueIconPath(root, rank) {
  const key = String(rank || '')
    .trim()
    .toLowerCase();
  const file = LEAGUE_FILES[key];
  if (!file) return null;
  const base = root.endsWith('/') ? root : `${root}/`;
  return `${base}assets/icons/leagues/${file}`;
}

/**
 * @param {Map<string, object>} itemsById
 * @param {number} gid
 * @param {import('../history-decode.js').HistoryDecodeCatalog} cat
 * @returns {string | null}
 */
function idFromGid(itemsById, gid, cat) {
  if (!Number.isFinite(gid) || gid <= 0) return null;
  const fromCat = cat.gidToId[String(gid)];
  if (fromCat && itemsById.has(fromCat)) return fromCat;
  for (const item of itemsById.values()) {
    if (Number(item.gid) === Number(gid)) return String(item.id);
  }
  return fromCat || null;
}

/**
 * @typedef {{
 *   runId: number,
 *   heroClass: string | null,
 *   classIcon: string | null,
 *   randomClass: boolean,
 *   rank: string,
 *   rating: number,
 *   showRanked: boolean,
 *   leagueIcon: string | null,
 *   leagueProgress: number,
 *   rankingDif: number | null,
 *   version: string,
 *   relativeTime: string,
 *   rounds: number,
 *   tries: number,
 *   wins: number,
 *   losses: number,
 *   results: { round: number, result: 'win' | 'loss' }[],
 *   keyItemIds: (string | null)[],
 * }} HistoryRowModel
 */

/**
 * @param {{
 *   db: any,
 *   summary: import('../history-db.js').HistoryRunSummary,
 *   itemsById: Map<string, object>,
 *   root: string,
 *   catalog?: import('../history-decode.js').HistoryDecodeCatalog | null,
 * }} opts
 * @returns {Promise<HistoryRowModel>}
 */
export async function buildRowModel(opts) {
  const { db, summary, itemsById, root } = opts;
  const base = root.endsWith('/') ? root : `${root}/`;
  const cat = opts.catalog || (await loadHistoryCatalog(base));
  const results = fetchRunResults(db, summary.runId);
  const wins = results.filter((r) => r.result === 'win').length;
  const losses = results.filter((r) => r.result === 'loss').length;
  const rankDisp = computeHistoryRankDisplay(
    summary.rating,
    results,
    summary.tries ?? 0,
  );
  const leagueKey = rankDisp.leagueName || summary.rank;

  const bagId = summary.heroClass
    ? startingBagIdForLoadout(summary.heroClass, summary.loadout)
    : null;
  const keyItemIds = [
    idFromGid(itemsById, summary.subclassGid, cat),
    idFromGid(itemsById, summary.skill1Gid, cat),
    idFromGid(itemsById, summary.skill2Gid, cat),
    bagId && itemsById.has(bagId) ? bagId : null,
  ];

  return {
    runId: summary.runId,
    heroClass: summary.heroClass,
    classIcon: classIconPath(base, summary.heroClass),
    randomClass: Number(summary.loadout) === LOADOUT_RANDOM_CHARACTER,
    rank: leagueKey || summary.rank,
    rating: summary.rating,
    showRanked: rankDisp.showRanked,
    leagueIcon: rankDisp.showRanked ? leagueIconPath(base, leagueKey) : null,
    leagueProgress: rankDisp.leagueProgress,
    rankingDif: rankDisp.rankingDif,
    version: summary.version || '',
    relativeTime: formatRelativeTime(summary.time),
    rounds: summary.rounds,
    tries: summary.tries ?? 0,
    wins,
    losses,
    results,
    keyItemIds,
  };
}
