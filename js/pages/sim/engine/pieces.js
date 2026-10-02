/**
 * Build combat pieces (weapons, pets, cards, consumables, armor) from placements.
 */

import { gemModsFor } from './gems.js';
import {
  isBagLike,
  itemKind,
  isVampiric,
  rarityPriority,
  effectStackHints,
  damageKindFromItem,
} from './item-kind.js';
import { getScriptHandler } from './scripts/registry.js';
import { paramsFromItem } from './params.js';
import { applyPlacementInstance } from './placement-instance.js';
import { recordPieceMod, withStatSource } from './stat-mods.js';
import { createBalancedRng } from './balanced-rng.js';

/**
 * @typedef {{
 *   placementKey: string,
 *   itemId: string,
 *   name: string,
 *   kind: string,
 *   priority: number,
 *   cooldown: number,
 *   triggerTime: number,
 *   staminaCost: number,
 *   damageMin: number,
 *   damageMax: number,
 *   damageBonus: number,
 *   bonusDamage?: number,
 *   bonusDamageFactor?: number,
 *   bonusAccuracy?: number,
 *   speedScale?: number,
 *   baseCooldown?: number,
 *   empowerable?: boolean,
 *   accuracy: number,
 *   blockGrant: number,
 *   damageReduction: number,
 *   spikes: number,
 *   vampiric: boolean,
 *   itemType?: string,
 *   damageKind?: 'melee'|'ranged',
 *   chance: number,
 *   chance2?: number,
 *   chanceTag: string | null,
 *   params: Record<string, number>,
 *   stackHints: string[],
 *   charges: number | null,
 *   gemNames: string[],
 *   paramMult?: Record<string, number>,
 *   paramAdd?: Record<string, number>,
 *   persistent?: unknown,
 *   alive: boolean,
 *   pendingHasteAt?: number | null,
 *   pendingHasteMult?: number | null,
 *   pendingCharges?: { at: number, meta?: { pathId?: string, cellIndex?: number, emitterKey?: string } }[],
 *   numCharges?: number,
 *   doubleAttackEffectChance?: number,
 *   doubleActivationChance?: number,
 *   _cdAdvanceDepth?: number,
 *   tesla?: {
 *     collectCharges: boolean,
 *     numCollectedCharges: number,
 *     advanceItemCounter: number,
 *     itemsToAdvance: string[],
 *     consumed?: boolean,
 *   },
 * }} CombatPiece
 */

function gemHostKind(kind) {
  // Game Gem.getGemMode: host isWeapon() → Weapon, else Armor
  return kind === 'weapon' ? 'weapon' : 'armor';
}

function stampGemCatalogMods(piece, gemIds, itemsById) {
  if (!Array.isArray(gemIds) || !gemIds.length) return;
  const hostKind = gemHostKind(piece.kind);
  for (const gid of gemIds) {
    if (!gid) continue;
    const gem = itemsById.get(gid);
    if (!gem) continue;
    const one = gemModsFor([gid], itemsById, { hostKind });
    withStatSource({ name: String(gem.name || gid), itemId: gid }, () => {
      if (one.damageBonus) {
        recordPieceMod(piece, { stat: 'damage', amount: one.damageBonus, unit: 'flat' });
      }
      if (one.accuracyBonus) {
        recordPieceMod(piece, { stat: 'accuracy', amount: one.accuracyBonus, unit: 'flat' });
      }
      if (one.staminaDelta) {
        recordPieceMod(piece, { stat: 'stamina', amount: one.staminaDelta, unit: 'flat' });
      }
      if (one.blockBonus) {
        recordPieceMod(piece, { stat: 'block', amount: one.blockBonus, unit: 'flat' });
      }
    });
  }
}

/**
 * @param {{ id: string, key: string, gems?: string[] }[]} placements
 * @param {Map<string, object>} itemsById
 * @returns {CombatPiece[]}
 */
export function buildCombatPieces(placements, itemsById) {
  /** @type {CombatPiece[]} */
  const out = [];
  for (const p of placements || []) {
    const item = itemsById.get(p.id);
    if (!item) continue;
    const bagHost = isBagLike(item);
    let kind = bagHost ? 'bag' : itemKind(item);
    const script = getScriptHandler(item.id);
    const listenOnly = typeof script?.onPeerActivated === 'function';
    // Bags are combat hosts (insides / Fanny Pack). Other gem/passive skip rules unchanged.
    if (bagHost) {
      // keep kind bag
    } else if (
      (kind === 'gem' || kind === 'passive') &&
      !script?.onCombatStart &&
      !script?.onCooldownEffect &&
      !listenOnly
    ) {
      continue;
    } else if (
      kind === 'passive' &&
      script?.onCombatStart &&
      script?.onCooldownEffect &&
      !listenOnly
    ) {
      kind = 'gadget';
    }
    // Socket-only gems stay out of the board loop; CD / start gems (e.g. Lump of Coal) participate.
    if (kind === 'gem' && (script?.onCooldownEffect || script?.onCombatStart)) {
      kind = script?.onCooldownEffect ? 'gadget' : 'consumable';
    } else if (kind === 'gem') {
      continue;
    }

    const gems = gemModsFor(p.gems, itemsById, { hostKind: gemHostKind(kind) });
    const cd = Number(item.cooldown);
    const hasCd = Number.isFinite(cd) && cd > 0;
    const dMin = Number(item.damageMin);
    const dMax = Number(item.damageMax);
    const hasDamage =
      (Number.isFinite(dMin) && dMin > 0) ||
      (Number.isFinite(dMax) && dMax > 0);

    let damageMin = Number.isFinite(dMin) ? dMin : hasDamage ? dMax : 0;
    let damageMax = Number.isFinite(dMax) ? dMax : hasDamage ? dMin : 0;
    damageMin += gems.damageBonus;
    damageMax += gems.damageBonus;

    let accuracy = Number.isFinite(Number(item.accuracy))
      ? Number(item.accuracy)
      : 90;
    accuracy = Math.min(100, accuracy + gems.accuracyBonus);

    let staminaCost = Math.max(0, Number(item.staminaCost) || 0);
    staminaCost = Math.max(0, staminaCost + gems.staminaDelta);

    const blockGrant =
      Math.max(0, Math.round(Number(item.block) || 0)) + gems.blockBonus;

    // Armor DR: non-weapon block items grant flat reduction
    const damageReduction =
      kind === 'armor' ? Math.min(8, Math.floor(blockGrant / 5)) : 0;
    const spikes =
      kind === 'armor' && /spike/i.test(String(item.effect || ''))
        ? Math.max(2, Math.floor(blockGrant / 4))
        : effectStackHints(item).includes('spikes')
          ? 3
          : 0;

    let charges = null;
    if (kind === 'consumable') {
      charges = hasCd ? null : 1;
    }
    if (kind === 'card') {
      charges = null;
    }

    const petStartOnly =
      kind === 'pet' &&
      !hasCd &&
      !hasDamage &&
      Boolean(script?.onCombatStart || script?.onPreCombatStart) &&
      !script?.onCooldownEffect;

    const cooldown = hasCd
      ? Math.max(0.35, cd)
      : kind === 'pet'
        ? petStartOnly
          ? 0
          : 2.5
        : kind === 'card'
          ? 1.5
          : kind === 'consumable'
            ? 999
            : 0;

    const startOnly =
      petStartOnly ||
      (Boolean(script?.onCombatStart) &&
        !script?.onCooldownEffect &&
        !hasCd &&
        kind !== 'card' &&
        kind !== 'pet' &&
        kind !== 'consumable');

    if (
      !hasCd &&
      !hasDamage &&
      kind !== 'armor' &&
      kind !== 'card' &&
      kind !== 'pet' &&
      kind !== 'consumable' &&
      kind !== 'bag' &&
      kind !== 'gadget' &&
      !listenOnly &&
      !startOnly
    ) {
      continue;
    }
    const params = paramsFromItem(item);
    const chance = Number.isFinite(Number(item.chance)) ? Number(item.chance) : 0;
    const chance2 = Number.isFinite(Number(item.chance2)) ? Number(item.chance2) : 0;
    const chanceTag =
      item.chanceTag != null && String(item.chanceTag).trim()
        ? String(item.chanceTag).trim().toLowerCase()
        : null;
    const empowerable =
      hasDamage || kind === 'weapon' || kind === 'pet' || /weapon/i.test(String(item.type || ''));

    const bagTicks =
      kind === 'bag' && Boolean(script?.onCooldownEffect) && hasCd && !script?.deferStartActivate;

    if (
      (kind === 'armor' && !hasCd) ||
      (listenOnly && !hasCd) ||
      (kind === 'bag' && !bagTicks) ||
      startOnly
    ) {
      // Passive armor / listen-only / bag hosts — no CD loop
      out.push({
        placementKey: p.key,
        itemId: item.id,
        name: String(item.displayName || item.name || item.id),
        kind: listenOnly && kind !== 'bag' ? 'passive' : kind,
        priority: rarityPriority(item) * 1000,
        cooldown: 0,
        triggerTime: 0,
        baseCooldown: 0,
        staminaCost: 0,
        baseStaminaCost: 0,
        staminaFactor: 1,
        damageMin: 0,
        damageMax: 0,
        damageBonus: 0,
        bonusDamage: 0,
        bonusDamageFactor: 1,
        bonusAccuracy: 0,
        speedScale: 0,
        empowerable: false,
        accuracy: 100,
        blockGrant,
        damageReduction,
        spikes,
        vampiric: false,
        itemType: item.type ? String(item.type) : '',
        damageKind: damageKindFromItem(item),
        chance,
        chance2,
        chanceTag,
        bonusChanceMult: 0,
        bonusChanceAdd1: 0,
        bonusChanceAdd2: 0,
        chanceRng: createBalancedRng(),
        params,
        stackHints: effectStackHints(item),
        charges: null,
        gemNames: gems.gemNames,
        gemIds: Array.isArray(p.gems) ? p.gems.filter(Boolean) : [],
        alive: true,
        numCharges: 0,
        _revealing: false,
        _revealed: false,
        side: p.side === 'them' ? 'them' : 'you',
      });
      applyPlacementInstance(out[out.length - 1], p.instance);
      stampGemCatalogMods(out[out.length - 1], p.gems, itemsById);
      continue;
    }

    const loopCd = cooldown || 1;
    const isCard = kind === 'card';
    out.push({
      placementKey: p.key,
      itemId: item.id,
      name: String(item.displayName || item.name || item.id),
      kind,
      priority: rarityPriority(item) * 1000 + Math.round(damageMax),
      cooldown: loopCd,
      triggerTime: isCard ? 999 : loopCd,
      baseCooldown: hasCd ? Math.max(0.35, cd) : loopCd,
      staminaCost,
      baseStaminaCost: staminaCost,
      staminaFactor: 1,
      damageMin,
      damageMax,
      damageBonus: 0,
      bonusDamage: 0,
      bonusDamageFactor: 1,
      bonusAccuracy: 0,
      speedScale: 0,
      empowerable,
      accuracy,
      blockGrant,
      damageReduction,
      spikes,
      vampiric: isVampiric(item),
      itemType: item.type ? String(item.type) : '',
      damageKind: damageKindFromItem(item),
      chance,
      chance2,
      chanceTag,
      bonusChanceMult: 0,
      bonusChanceAdd1: 0,
      bonusChanceAdd2: 0,
      chanceRng: createBalancedRng(),
      params,
      stackHints: effectStackHints(item),
      charges,
      gemNames: gems.gemNames,
      gemIds: Array.isArray(p.gems) ? p.gems.filter(Boolean) : [],
      alive: true,
      numCharges: 0,
      _revealing: false,
      _revealed: false,
      side: p.side === 'them' ? 'them' : 'you',
    });
    applyPlacementInstance(out[out.length - 1], p.instance);
    stampGemCatalogMods(out[out.length - 1], p.gems, itemsById);
  }

  // Higher priority activates first when multiple ready same frame
  out.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
  return out;
}

/**
 * @param {CombatPiece[]} pieces
 */
export function activeLoopPieces(pieces) {
  return pieces.filter(
    (p) =>
      p.alive &&
      // Passive armor (cooldown 0) stays out; CD armor (Vampiric, Bionic, …) ticks.
      (p.kind !== 'armor' || (p.cooldown > 0 && p.cooldown < 500)) &&
      (p.kind !== 'bag' || (p.cooldown > 0 && p.cooldown < 500)) &&
      (p.kind !== 'card' || p._revealing) &&
      (p.charges == null || p.charges > 0) &&
      p.cooldown > 0 &&
      p.cooldown < 500,
  );
}
