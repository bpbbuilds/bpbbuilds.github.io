/**
 * Publish event entry from wizard state.
 */

import { startingBagIdForLoadout } from '../../shared/starting-bags.js';
import {
  ensureHistoryCatalogItems,
  loadHistoryCatalog,
} from '../create/history-decode.js';
import { normalizeDraftHistory } from '../create/draft-io.js';
import { sumBoardGold } from '../create/draft-gold.js';
import { publishDraft } from '../create/publish.js';
import { formatDps } from './enter-sim-dps.js';

/**
 * @param {{
 *   root: string,
 *   eventSlug: string,
 *   title: string,
 *   notes: string,
 *   claimedDps: string,
 *   youtubeUrl: string,
 *   simDps: number | null,
 *   judgeWindowSec: number,
 *   showSimDpsOnEntry: boolean,
 *   selectedRun: import('../create/history-db.js').HistoryDecodedRun,
 *   placements: import('../create/draft-io.js').DraftPlacement[],
 *   catalog: { itemsById: Map<string, object>, getSpriteUrl: (item: object) => string },
 * }} opts
 * @returns {Promise<{ id: number, slug: string }>}
 */
export async function submitEventEntry(opts) {
  const cat = await loadHistoryCatalog(opts.root);
  const run = opts.selectedRun;
  const catalog = opts.catalog;
  ensureHistoryCatalogItems(catalog.itemsById, cat);

  /**
   * @param {number} gid
   */
  function idFromGid(gid) {
    if (!(Number(gid) > 0)) return null;
    const fromCat = cat.gidToId[String(gid)];
    if (fromCat && catalog.itemsById.has(fromCat)) return fromCat;
    for (const item of catalog.itemsById.values()) {
      if (Number(item.gid) === Number(gid)) return String(item.id);
    }
    return fromCat || null;
  }

  const hero = run.heroClass;
  const starting_bag_id = hero
    ? startingBagIdForLoadout(hero, run.loadout)
    : null;
  const r3 = Number(run.skill1Gid) > 0 ? idFromGid(run.skill1Gid) : null;
  const r10 = Number(run.skill2Gid) > 0 ? idFromGid(run.skill2Gid) : null;
  if (!starting_bag_id || !r3 || !r10) {
    throw new Error(
      'That run is missing starting bag or round skills (R3 / R10). Pick a later round / complete run.',
    );
  }

  let notesOut = opts.notes.trim();
  if (opts.claimedDps.trim()) {
    notesOut = [notesOut, `Claimed DPS: ${opts.claimedDps.trim()}`]
      .filter(Boolean)
      .join('\n');
  }
  if (opts.simDps != null && opts.showSimDpsOnEntry) {
    notesOut = [
      notesOut,
      `Sim DPS (${opts.judgeWindowSec}s dummy): ${formatDps(opts.simDps)}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  const history = normalizeDraftHistory(run);
  return publishDraft(
    {
      version: 1,
      title: opts.title.trim(),
      blurb: '',
      notes: notesOut,
      hero_class: hero,
      build_tag: 'real',
      is_op: false,
      youtube_url: opts.youtubeUrl.trim() || null,
      gold_count: sumBoardGold(opts.placements, catalog.itemsById),
      rank: run.rank || null,
      route_r3_item_id: r3,
      route_r10_item_id: r10,
      starting_bag_id,
      placements: opts.placements,
      parked: [],
      history,
    },
    {
      itemsById: catalog.itemsById,
      getSpriteUrl: catalog.getSpriteUrl,
      root: opts.root,
      eventSlug: opts.eventSlug,
    },
  );
}
