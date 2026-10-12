/**
 * Shared source duration handling for simulator effects.
 *
 * Time Melting and Puzzlebag of Endurance modify an item's effect-duration
 * multiplier during prepare. The catalog parameters stay immutable so every
 * consumer (stun, blind, invulnerability, and other `dur*` effects) reads the
 * same prepared value.
 */

import { getPName } from './params.js';

const DURATION_KEY = /^dur(?:_|$)/i;

/**
 * @param {object | null | undefined} value
 * @returns {Record<string, number>}
 */
export function durationParams(value) {
  const params = value?.params;
  if (!params || typeof params !== 'object') return {};
  /** @type {Record<string, number>} */
  const out = {};
  for (const [key, raw] of Object.entries(params)) {
    const n = Number(raw);
    if (DURATION_KEY.test(key) && Number.isFinite(n)) out[key] = n;
  }
  return out;
}
/**
 * Add one source multiplier to a prepared combat piece.
 * @param {object} piece
 * @param {number} bonus Fractional bonus, e.g. 0.55 for +55%.
 */
export function addEffectDurationFactor(piece, bonus) {
  const n = Number(bonus);
  if (!piece || !Number.isFinite(n) || n === 0) return;
  const current = Number(piece.effectDurationFactor);
  const base = Number.isFinite(current) && current > 0 ? current : 1;
  piece.effectDurationFactor = base * (1 + n);
}

/**
 * Apply the prepared effect-duration multiplier to a computed duration.
 * @param {object | null | undefined} piece
 * @param {number} duration
 * @returns {number}
 */
export function scaleEffectDuration(piece, duration) {
  const value = Number(duration);
  if (!Number.isFinite(value)) return duration;
  const factor = Number(piece?.effectDurationFactor);
  return value * (Number.isFinite(factor) && factor > 0 ? factor : 1);
}

/**
 * Read a named catalog duration and apply the prepared multiplier.
 * @param {object | null | undefined} piece
 * @param {string} key
 * @param {number} [fallback]
 * @returns {number}
 */
export function effectDuration(piece, key, fallback = 0) {
  return scaleEffectDuration(piece, getPName(piece?.params, key, fallback));
}

/**
 * Return the live duration parameters for a tooltip snapshot.
 * @param {object | null | undefined} piece
 * @returns {Record<string, number>}
 */
export function liveDurationParams(piece) {
  const base = durationParams(piece);
  const factor = Number(piece?.effectDurationFactor);
  const multiplier = Number.isFinite(factor) && factor > 0 ? factor : 1;
  if (multiplier === 1) return base;
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [key, value * multiplier]),
  );
}
