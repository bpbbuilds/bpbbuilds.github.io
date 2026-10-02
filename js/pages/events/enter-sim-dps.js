/**
 * Fixed-window dummy DPS for event entry preview.
 */

import { runSim } from '../sim/engine/index.js';
import { buildDamageSources } from '../sim/log/sim-meter-metrics.js';
import { newPlacementKey } from '../create/draft-io.js';

/**
 * @param {{
 *   placements: { id: string, key?: string, x?: number, y?: number, r?: number, gems?: string[] }[],
 *   itemsById: Map<string, object>,
 *   durationSec: number,
 *   canAffect?: object | null,
 * }} opts
 * @returns {{ totalDamage: number, dps: number, durationSec: number }}
 */
export function computeEventSimDps(opts) {
  const durationSec = Math.max(1, Number(opts.durationSec) || 15);
  const placements = (opts.placements || []).map((p) => ({
    id: String(p.id),
    key: p.key || newPlacementKey(),
    gems: Array.isArray(p.gems) ? p.gems.map(String) : [],
    x: Number(p.x) || 0,
    y: Number(p.y) || 0,
    r: Number(p.r) || 0,
  }));
  if (!placements.length) {
    return { totalDamage: 0, dps: 0, durationSec };
  }

  const run = runSim({
    mode: 'engine',
    placements,
    itemsById: opts.itemsById,
    durationSec,
    dummyBlock: 0,
    dummyAttacks: false,
    canAffect: opts.canAffect || null,
  });

  const sources = buildDamageSources(run.events || [], opts.itemsById, 'player');
  const totalDamage = sources.reduce((s, src) => s + (Number(src.total) || 0), 0);
  const fightSec = Number(run.durationSec) > 0 ? Number(run.durationSec) : durationSec;
  const dps = fightSec > 0 ? totalDamage / fightSec : 0;
  return { totalDamage, dps, durationSec: fightSec };
}

/**
 * @param {number} n
 * @returns {string}
 */
export function formatDps(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 100) return String(Math.round(n));
  return n.toFixed(1);
}
