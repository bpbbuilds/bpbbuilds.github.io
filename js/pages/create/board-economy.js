/**
 * Create board run economy — gold, stamina pool, game stamina-usage rate.
 * Rate + tiers mirror Character.getTotalStaminaUsage + StaminaUseCounter.gd.
 */

import { sumBoardGold } from './draft-gold.js';

export const BASE_MAX_STAMINA = 5;

/** @typedef {'veryLow' | 'low' | 'medium' | 'high' | 'veryHigh'} StaminaUsageTier */

/** Game STAMINA_* labels (Interface.csv EN). */
export const STAMINA_USAGE_TIERS = /** @type {const} */ ([
  {
    id: 'veryLow',
    label: 'Very low',
    frame: 1,
    maxExclusive: 0.5,
    color: 'rgb(170, 255, 117)',
  },
  {
    id: 'low',
    label: 'Low',
    frame: 2,
    maxExclusive: 1.2,
    color: 'rgb(228, 255, 117)',
  },
  {
    id: 'medium',
    label: 'Medium',
    frame: 3,
    maxExclusive: 1.5,
    color: 'rgb(255, 250, 117)',
  },
  {
    id: 'high',
    label: 'High',
    frame: 4,
    maxExclusive: 2.0,
    color: 'rgb(255, 175, 117)',
  },
  {
    id: 'veryHigh',
    label: 'Very high',
    frame: 5,
    maxExclusive: Infinity,
    color: 'rgb(255, 100, 100)',
  },
]);

/**
 * @param {number} n
 * @returns {string}
 */
export function formatEconomyNum(n) {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded);
}

/** Game stepify(n, 0.1) for stamina-usage tooltip numbers. */
export function formatStaminaRate(n) {
  if (!Number.isFinite(n)) return '0';
  const stepped = Math.round(n * 10) / 10;
  if (Number.isInteger(stepped)) return String(stepped);
  return stepped.toFixed(1);
}

/**
 * Permanent max-stamina grant from an item (not combat "Eliminated:" lines).
 * @param {object | null | undefined} item
 * @returns {number}
 */
export function maxStaminaBonusFromItem(item) {
  if (!item) return 0;
  const effect = String(item.effect || '');
  let add = 0;
  for (const line of effect.split(/\n+/)) {
    const m = line
      .trim()
      .match(/^Gain\s+(\d+(?:\.\d+)?)\s+maximum\s+stamina\.?$/i);
    if (m) add += Number(m[1]);
  }
  if (add > 0) return add;
  if (
    item.id === 'stamina_sack' ||
    /^stamina\s*sack$/i.test(String(item.name || ''))
  ) {
    return 1;
  }
  return 0;
}

/**
 * Sum of placed stamina costs (activation pool pressure).
 * @param {import('./draft-io.js').DraftPlacement[]} placements
 * @param {Map<string, object>} itemsById
 * @returns {number}
 */
export function sumBoardStaminaCost(placements, itemsById) {
  if (!Array.isArray(placements) || !(itemsById instanceof Map)) return 0;
  let total = 0;
  for (const p of placements) {
    if (!p?.id) continue;
    const item = itemsById.get(p.id);
    const n = Number(item?.staminaCost ?? item?.stamina_cost);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

/** @deprecated use sumBoardStaminaCost */
export const sumBoardStaminaUsage = sumBoardStaminaCost;

/**
 * Stamina per second — Character.getTotalStaminaUsage().
 * cost / cooldown when cooldown > 0; else raw cost.
 * @param {import('./draft-io.js').DraftPlacement[]} placements
 * @param {Map<string, object>} itemsById
 * @returns {number}
 */
export function sumBoardStaminaRate(placements, itemsById) {
  if (!Array.isArray(placements) || !(itemsById instanceof Map)) return 0;
  let total = 0;
  for (const p of placements) {
    if (!p?.id) continue;
    const item = itemsById.get(p.id);
    if (!item) continue;
    let staminaUse = Number(item.staminaCost ?? item.stamina_cost);
    if (!Number.isFinite(staminaUse) || staminaUse <= 0) continue;
    const cd = Number(item.cooldown);
    if (Number.isFinite(cd) && cd > 0) staminaUse /= cd;
    total += staminaUse;
  }
  return total;
}

/**
 * @param {number} rate
 * @returns {(typeof STAMINA_USAGE_TIERS)[number]}
 */
export function staminaUsageTier(rate) {
  const n = Number.isFinite(rate) ? rate : 0;
  for (const tier of STAMINA_USAGE_TIERS) {
    if (n < tier.maxExclusive) return tier;
  }
  return STAMINA_USAGE_TIERS[STAMINA_USAGE_TIERS.length - 1];
}

/**
 * @param {number} frame 1–5
 * @param {string} [rootBase]
 * @returns {string}
 */
export function staminaUsageIconUrl(frame, rootBase = '../') {
  const base = rootBase.endsWith('/') ? rootBase : `${rootBase}/`;
  const n = Math.min(5, Math.max(1, Math.round(frame) || 1));
  return `${base}assets/icons/stamina/StaminaUsage_${n}.png`;
}

/**
 * @param {import('./draft-io.js').DraftPlacement[]} placements
 * @param {Map<string, object>} itemsById
 * @returns {number}
 */
export function sumBoardMaxStamina(placements, itemsById) {
  if (!Array.isArray(placements) || !(itemsById instanceof Map)) {
    return BASE_MAX_STAMINA;
  }
  let max = BASE_MAX_STAMINA;
  for (const p of placements) {
    if (!p?.id) continue;
    max += maxStaminaBonusFromItem(itemsById.get(p.id));
  }
  return max;
}

/**
 * @param {import('./draft-io.js').DraftPlacement[]} placements
 * @param {Map<string, object>} itemsById
 */
export function summarizeBoardEconomy(placements, itemsById) {
  const staminaRate = sumBoardStaminaRate(placements, itemsById);
  const tier = staminaUsageTier(staminaRate);
  return {
    gold: sumBoardGold(placements, itemsById),
    staminaCost: sumBoardStaminaCost(placements, itemsById),
    staminaMax: sumBoardMaxStamina(placements, itemsById),
    staminaRate,
    staminaTier: tier,
  };
}

export { sumBoardGold };
