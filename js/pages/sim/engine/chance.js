/**
 * Item chance helpers — mirrors Item.applyBonusChance / getChance / rollChance.
 */

import { createBalancedRng } from './balanced-rng.js';

/**
 * @param {object | null | undefined} piece
 * @param {number} [index] 1 = chance, 2 = chance2
 */
export function applyBonusChance(base, piece, index = 1) {
  const toChance = Number(base) || 0;
  const mult = Number(piece?.bonusChanceMult) || 0;
  const add =
    index === 2
      ? Number(piece?.bonusChanceAdd2) || 0
      : Number(piece?.bonusChanceAdd1) || 0;
  return (toChance + add) * ((100 + mult) / 100);
}

/**
 * Display / tip chance (clamped 0..100), like Item.getChance().
 * @param {object | null | undefined} piece
 * @param {number} [fallbackBase]
 */
export function effectiveChance(piece, fallbackBase = 0) {
  const base = Number(piece?.chance);
  const raw = Number.isFinite(base) && base > 0 ? base : Number(fallbackBase) || 0;
  const v = applyBonusChance(raw, piece, 1);
  // Match tip display; tiny float noise (25×1.15) → 28.75
  return Math.round(Math.max(0, Math.min(100, v)) * 100) / 100;
}

/**
 * @param {object | null | undefined} piece
 * @param {number} [fallbackBase]
 */
export function effectiveChance2(piece, fallbackBase = 0) {
  const base = Number(piece?.chance2);
  const raw = Number.isFinite(base) && base > 0 ? base : Number(fallbackBase) || 0;
  const v = applyBonusChance(raw, piece, 2);
  return Math.round(Math.max(0, Math.min(100, v)) * 100) / 100;
}

/**
 * Ensure piece has a BalancedRng (Item.chanceRng).
 * @param {object} piece
 */
export function ensureChanceRng(piece) {
  if (!piece) return null;
  if (!piece.chanceRng) piece.chanceRng = createBalancedRng();
  return piece.chanceRng;
}

/**
 * Item.rollChance() — applyBonusChance then piece.chanceRng.rollPercent.
 * Uses shared combat rng for the flip (game Util.flip → Util.rng).
 * @param {object} piece
 * @param {() => number} rng
 * @param {number} [baseChance] defaults to piece.chance / catalog base
 */
/**
 * Tip / debug counters for item chance rolls (sim-only).
 * @param {object | null | undefined} piece
 * @param {boolean} hit
 */
function noteChanceRoll(piece, hit) {
  if (!piece) return;
  piece.chanceRolls = (Number(piece.chanceRolls) || 0) + 1;
  if (hit) piece.chanceProcs = (Number(piece.chanceProcs) || 0) + 1;
}

/**
 * Item.rollChance() — applyBonusChance then piece.chanceRng.rollPercent.
 * Uses shared combat rng for the flip (game Util.flip → Util.rng).
 * @param {object} piece
 * @param {() => number} rng
 * @param {number} [baseChance] defaults to piece.chance / catalog base
 */
export function rollItemChance(piece, rng, baseChance) {
  const base =
    baseChance != null && Number.isFinite(Number(baseChance))
      ? Number(baseChance)
      : Number(piece?.chance) || 0;
  const pct = applyBonusChance(base, piece, 1);
  if (!(pct > 0)) return false;
  if (pct >= 100) {
    noteChanceRoll(piece, true);
    return true;
  }
  const bal = ensureChanceRng(piece);
  const hit = bal.rollPercent(pct, rng);
  noteChanceRoll(piece, hit);
  return hit;
}

/**
 * Item.rollChance2().
 * @param {object} piece
 * @param {() => number} rng
 * @param {number} [baseChance]
 */
export function rollItemChance2(piece, rng, baseChance) {
  const base =
    baseChance != null && Number.isFinite(Number(baseChance))
      ? Number(baseChance)
      : Number(piece?.chance2) || 0;
  const pct = applyBonusChance(base, piece, 2);
  if (!(pct > 0)) return false;
  if (pct >= 100) {
    noteChanceRoll(piece, true);
    return true;
  }
  const bal = ensureChanceRng(piece);
  const hit = bal.rollPercent(pct, rng);
  noteChanceRoll(piece, hit);
  return hit;
}
