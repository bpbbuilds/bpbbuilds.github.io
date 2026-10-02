/**
 * Sim runner seam — demo | engine modes share SimRun / SimEvent[].
 */

import { buildDemoTimeline } from '../demo-timeline.js';
import { computeCoverage } from './coverage.js';
import { simulateEngine } from './simulate.js';
import { SIM_DURATION_SEC } from '../sim-events.js';

/**
 * @typedef {'demo' | 'engine'} SimMode
 */

/**
 * Parse ?seed= from URL (uint32).
 * @returns {number | null}
 */
export function seedFromQuery() {
  const raw = new URLSearchParams(location.search).get('seed');
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n >>> 0;
}

/**
 * @param {{
 *   mode?: SimMode,
 *   placements: { id: string, key: string, gems?: string[] }[],
 *   itemsById: Map<string, object>,
 *   durationSec?: number,
 *   seed?: number,
 *   canAffect?: object | null,
 *   dummyBlock?: number,
 *   dummyMaxHp?: number | null,
 *   dummyAttacks?: boolean,
 *   dummyAttackDamage?: number | null,
 *   dummyAttackCd?: number | null,
 *   opponentPlacements?: { id: string, key: string, gems?: string[] }[],
 *   round?: number | null,
 *   opponentRound?: number | null,
 *   playerMaxHp?: number | null,
 *   playerMaxStamina?: number | null,
 *   opponentMaxHp?: number | null,
 *   opponentMaxStamina?: number | null,
 * }} opts
 * @returns {import('../sim-events.js').SimRun}
 */
export function runSim(opts) {
  const mode = opts.mode === 'demo' ? 'demo' : 'engine';
  const seed = opts.seed ?? seedFromQuery() ?? 0xb0bd2026;
  const durationSec = opts.durationSec ?? SIM_DURATION_SEC;
  const coverage = computeCoverage(opts.placements, opts.itemsById);

  if (mode === 'demo') {
    const run = buildDemoTimeline({
      placements: opts.placements,
      itemsById: opts.itemsById,
      durationSec,
      seed,
    });
    return {
      ...run,
      mode: 'demo',
      coverage,
      summary: {
        seed,
        endReason: 'demo',
        coverage,
      },
    };
  }

  return simulateEngine({
    placements: opts.placements,
    itemsById: opts.itemsById,
    durationSec,
    seed,
    canAffect: opts.canAffect || null,
    dummyBlock: opts.dummyBlock,
    dummyMaxHp: opts.dummyMaxHp,
    dummyAttacks: opts.dummyAttacks,
    dummyAttackDamage: opts.dummyAttackDamage,
    dummyAttackCd: opts.dummyAttackCd,
    opponentPlacements: opts.opponentPlacements,
    round: opts.round,
    opponentRound: opts.opponentRound,
    playerMaxHp: opts.playerMaxHp,
    playerMaxStamina: opts.playerMaxStamina,
    opponentMaxHp: opts.opponentMaxHp,
    opponentMaxStamina: opts.opponentMaxStamina,
  });
}

export { computeCoverage } from './coverage.js';
export { simulateEngine } from './simulate.js';
