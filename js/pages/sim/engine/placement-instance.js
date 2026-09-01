/**
 * Per-placement item instance stats — mirrors live Item fields (baseCooldownOverride,
 * speedScale, params) when a build carries them. Catalog rows stay the default.
 */

import { normalizeParams } from './params.js';

/**
 * @typedef {{
 *   baseCooldown?: number,
 *   speedScale?: number,
 *   params?: Record<string, number>,
 *   paramMult?: Record<string, number>,
 *   paramAdd?: Record<string, number>,
 *   damageMin?: number,
 *   damageMax?: number,
 *   accuracy?: number,
 *   staminaCost?: number,
 *   blockGrant?: number,
 *   numCharges?: number,
 *   persistent?: unknown,
 * }} PlacementInstance
 */

/**
 * @param {unknown} raw
 * @returns {PlacementInstance | null}
 */
export function normalizePlacementInstance(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  /** @type {PlacementInstance} */
  const out = {};

  const num = (k) => {
    const n = Number(o[k]);
    return Number.isFinite(n) ? n : undefined;
  };

  const bc = num('baseCooldown');
  if (bc != null) out.baseCooldown = bc;
  const ss = num('speedScale');
  if (ss != null) out.speedScale = ss;
  const dMin = num('damageMin');
  if (dMin != null) out.damageMin = dMin;
  const dMax = num('damageMax');
  if (dMax != null) out.damageMax = dMax;
  const acc = num('accuracy');
  if (acc != null) out.accuracy = acc;
  const stam = num('staminaCost');
  if (stam != null) out.staminaCost = stam;
  const block = num('blockGrant');
  if (block != null) out.blockGrant = block;
  const charges = num('numCharges');
  if (charges != null) out.numCharges = charges;

  if (o.params && typeof o.params === 'object') {
    out.params = normalizeParams(o.params);
  }
  if (o.paramMult && typeof o.paramMult === 'object') {
    out.paramMult = normalizeParams(o.paramMult);
  }
  if (o.paramAdd && typeof o.paramAdd === 'object') {
    out.paramAdd = normalizeParams(o.paramAdd);
  }
  if (o.persistent !== undefined) out.persistent = o.persistent;

  return Object.keys(out).length ? out : null;
}

/**
 * Game getParamModified — (base + paramAdd) * paramMult when piece carries mods.
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {number} baseVal
 * @param {string} [paramKey] paramMult/paramAdd key (named param)
 */
export function modifiedParamValue(piece, baseVal, paramKey) {
  const key = paramKey || '';
  const add = Number(piece.paramAdd?.[key]) || 0;
  const mult = Number(piece.paramMult?.[key]);
  const m = Number.isFinite(mult) && mult !== 0 ? mult : 1;
  return (Number(baseVal) + add) * m;
}

/**
 * Apply build-faithful instance stats onto a combat piece (after catalog + gems).
 * @param {import('./pieces.js').CombatPiece} piece
 * @param {PlacementInstance | null | undefined} instance
 */
export function applyPlacementInstance(piece, instance) {
  const inst = normalizePlacementInstance(instance);
  if (!inst || !piece) return;

  if (inst.params) {
    piece.params = { ...(piece.params || {}), ...inst.params };
  }
  if (inst.paramMult) {
    piece.paramMult = { ...(piece.paramMult || {}), ...inst.paramMult };
  }
  if (inst.paramAdd) {
    piece.paramAdd = { ...(piece.paramAdd || {}), ...inst.paramAdd };
  }

  if (inst.damageMin != null || inst.damageMax != null) {
    if (inst.damageMin != null) piece.damageMin = Math.max(0, inst.damageMin);
    if (inst.damageMax != null) piece.damageMax = Math.max(0, inst.damageMax);
  }
  if (inst.accuracy != null) piece.accuracy = inst.accuracy;
  if (inst.staminaCost != null) {
    piece.staminaCost = Math.max(0, inst.staminaCost);
    piece.baseStaminaCost = piece.staminaCost;
  }
  if (inst.blockGrant != null) piece.blockGrant = Math.max(0, Math.round(inst.blockGrant));
  if (inst.numCharges != null) piece.numCharges = Math.max(0, Math.round(inst.numCharges));

  if (inst.speedScale != null) {
    piece.speedScale = inst.speedScale;
  }

  if (inst.baseCooldown != null && Number.isFinite(inst.baseCooldown)) {
    const cd = Math.max(0.35, inst.baseCooldown);
    piece.baseCooldown = cd;
    if (piece.cooldown > 0 && piece.cooldown < 500) {
      piece.cooldown = cd;
      if (piece.kind !== 'card') {
        piece.triggerTime = cd;
      }
    }
  }

  if (inst.persistent !== undefined) {
    piece.persistent = inst.persistent;
  }
}
