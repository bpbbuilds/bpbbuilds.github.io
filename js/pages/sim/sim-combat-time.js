/**
 * Combat-log / scrubber clock — matches in-game log (0 = items live).
 * Engine events still use wall time including Game.COMBAT_DELAY (2.5s).
 * Display uses raw two-decimal combat time like CombatEvent "%2.2f" — no 0.05 snap.
 */

/** Same as Game.COMBAT_DELAY / simulate.js */
export const COMBAT_DELAY = 2.5;

/**
 * Engine/wall time → combat-log time (clamped ≥ 0).
 * @param {number} engineT
 */
export function toCombatLogTime(engineT) {
  const n = Number(engineT);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n - COMBAT_DELAY);
}

/**
 * Combat-log time → engine/wall time.
 * @param {number} combatT
 */
export function toEngineTime(combatT) {
  const n = Number(combatT);
  if (!Number.isFinite(n)) return COMBAT_DELAY;
  return Math.max(0, n) + COMBAT_DELAY;
}

/**
 * Visible fight length on the combat clock.
 * @param {number} engineDurationSec
 */
export function combatDurationSec(engineDurationSec) {
  const d = Math.max(0.1, Number(engineDurationSec) || 30);
  return Math.max(0.1, d - COMBAT_DELAY);
}

/**
 * @param {number} engineT
 * @param {number} [digits=2]
 */
export function formatCombatLogTime(engineT, digits = 2) {
  return toCombatLogTime(engineT).toFixed(digits);
}
