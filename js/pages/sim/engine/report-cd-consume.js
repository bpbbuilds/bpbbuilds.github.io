/**
 * Item.gd onAfterEffectFinished → deactivateCooldown + consume().
 * Extra CD activates after combat delay mean the sim looped the bar.
 * Combat-start activate() (Angel Crystal, Leather Helm / Spirit Bells) is allowed.
 */

import { CD_THEN_CONSUME_IDS } from './cd-then-consume-ids.js';

/** Game.COMBAT_DELAY — keep local to avoid simulate.js import cycles. */
const COMBAT_DELAY = 2.5;

/**
 * @param {import('../sim-events.js').SimRun} run
 * @param {Map<string, object> | undefined} itemsById
 */
export function findCdThenConsumeMismatches(run, itemsById) {
  if (!CD_THEN_CONSUME_IDS.size) return [];

  /** @type {Map<string, number[]>} */
  const activateAt = new Map();
  for (const e of run.events || []) {
    if (e.type !== 'activate') continue;
    const itemId = e.itemId;
    if (!itemId || !CD_THEN_CONSUME_IDS.has(itemId)) continue;
    const list = activateAt.get(itemId) || [];
    list.push(Number(e.t) || 0);
    activateAt.set(itemId, list);
  }

  /** @type {object[]} */
  const flags = [];
  for (const [itemId, times] of activateAt) {
    const cdActs = times.filter((t) => t > COMBAT_DELAY + 0.2);
    if (cdActs.length <= 1) continue;
    const item = itemsById?.get(itemId);
    flags.push({
      itemId,
      name: String(item?.name || itemId),
      stack: 'activations',
      granted: cdActs.length,
      grants: cdActs.length,
      expected: 1,
      expectedKey: 'cd_then_consume',
      alsoMatches: [],
      note:
        `game: doCooldownEffect → onAfterEffectFinished() stops the CD and consume()s ` +
        `(one post-delay Activations tick). Sim had ${cdActs.length} CD activate(s) for ` +
        `${item?.name || itemId} at t=${cdActs.map((t) => t.toFixed(2)).join(', ')}`,
    });
  }
  return flags;
}
