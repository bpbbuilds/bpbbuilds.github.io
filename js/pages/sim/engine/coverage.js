/**
 * Coverage meter — honest engine match vs “a handler object exists.”
 * Empty unique gem stubs, shop/chess noops, and generic `basic_cd` gems
 * are not “scripted combat.”
 */

import { getScriptHandler, getCoverageSync } from './scripts/registry.js';
import { HANDLERS } from './scripts/handlers.js';
import { AK_NOOP_IDS } from './scripts/ports-ak-noop.js';

const COMBAT_HOOKS = [
  'onCombatStart',
  'onPreCombatStart',
  'onPostCombatStart',
  'onCooldownEffect',
  'onPreDealDamageEarly',
  'onPreDealDamageLate',
  'onDealtDamage',
  'onAttacked',
  'onPeerActivated',
  'onChargeReceived',
];

const METER_NOOP = new Set([...AK_NOOP_IDS, 'chess_board']);

/**
 * @param {object | null | undefined} item
 */
export function itemLooksLikeGem(item) {
  const type = String(item?.type || '');
  const extra = Array.isArray(item?.extraTypes) ? item.extraTypes : [];
  return type === 'Gem' || extra.includes('Gem');
}

/**
 * @param {object | null | undefined} handler
 */
export function combatHookCount(handler) {
  if (!handler) return 0;
  return COMBAT_HOOKS.filter((k) => typeof handler[k] === 'function').length;
}

/**
 * @param {object | null | undefined} handler
 * @param {object | null | undefined} [item]
 */
export function classifyCoverageHandler(handler, item = null) {
  const handlerExists = Boolean(handler);
  if (!handlerExists) {
    return { handlerExists: false, engineMatch: false, reason: 'none' };
  }
  if (METER_NOOP.has(String(handler.handlerId || item?.id || ''))) {
    return { handlerExists: true, engineMatch: false, reason: 'noop' };
  }
  if (combatHookCount(handler) === 0) {
    return { handlerExists: true, engineMatch: false, reason: 'empty_stub' };
  }
  if (
    itemLooksLikeGem(item) &&
    handler.onCooldownEffect === HANDLERS.basic_cd.onCooldownEffect
  ) {
    return { handlerExists: true, engineMatch: false, reason: 'gem_basic_cd' };
  }
  return { handlerExists: true, engineMatch: true, reason: 'engine' };
}

/**
 * @param {string} itemId
 * @param {object | null | undefined} [item]
 */
export function classifyCoverageItem(itemId, item = null) {
  if (METER_NOOP.has(itemId)) {
    return {
      handlerExists: Boolean(getScriptHandler(itemId)),
      engineMatch: false,
      reason: 'noop',
    };
  }
  return classifyCoverageHandler(getScriptHandler(itemId), item || { id: itemId });
}

/**
 * @param {{ id: string }[]} placements
 * @param {Map<string, object>} itemsById
 */
export function computeCoverage(placements, itemsById) {
  let total = 0;
  let catalogCd = 0;
  let scripted = 0;
  let passive = 0;
  let handlerExists = 0;
  let noop = 0;
  const covFile = getCoverageSync();

  for (const p of placements || []) {
    const item = itemsById.get(p.id);
    if (!item) continue;
    total += 1;
    const cd = Number(item.cooldown);
    const hasCd = Number.isFinite(cd) && cd > 0;
    const fileEntry = covFile?.byId?.[item.id];
    const kind = classifyCoverageItem(item.id, item);
    if (kind.handlerExists) handlerExists += 1;
    if (kind.reason === 'noop' || kind.reason === 'empty_stub' || kind.reason === 'gem_basic_cd') {
      noop += 1;
    }
    if (kind.engineMatch) {
      scripted += 1;
    } else if (
      (hasCd || fileEntry?.status === 'catalog_fallback') &&
      kind.reason !== 'noop' &&
      kind.reason !== 'empty_stub' &&
      kind.reason !== 'gem_basic_cd'
    ) {
      catalogCd += 1;
    } else {
      passive += 1;
    }
  }

  const supported = scripted + catalogCd;
  const pct = total > 0 ? Math.round((supported / total) * 100) : 0;

  return {
    total,
    scripted,
    engineMatch: scripted,
    handlerExists,
    catalogCd,
    passive,
    noop,
    supported,
    pct,
    label:
      total === 0
        ? 'No items'
        : `${supported}/${total} items (${pct}%) — ${scripted} engine match, ${catalogCd} catalog CD`,
  };
}
