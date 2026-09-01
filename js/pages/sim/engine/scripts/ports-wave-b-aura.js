/**
 * Band AD Wave B — aura / start-weapon damage auras.
 */

import { grantStacks, onBuffChanged } from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addBonusDamage, addBonusDamageFromBuffChange, addBonusDamageFactor, addSpeed, multiplyStaminaCost } from '../piece-stats.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { itemHasType } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/**
 * @param {object} ctx
 * @param {object} piece
 * @param {(other: object, item: object|undefined) => boolean} [pred]
 */
function linkedPieces(ctx, piece, pred) {
  const { graph, itemsById, canAffect, pieces } = ctx;
  const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
  /** @type {object[]} */
  const out = [];
  for (const other of pieces || []) {
    if (other.placementKey === piece.placementKey) continue;
    if (!links.some((l) => l.key === other.placementKey)) continue;
    const item = itemsById.get(other.itemId);
    if (pred && !pred(other, item)) continue;
    out.push(other);
  }
  return out;
}

/** @param {object} other @param {number} frac */
function changeStaminaFactor(other, frac) {
  multiplyStaminaCost(other, frac);
}

/** Whetstone.gd */
/** @type {ScriptHandler} */
export const whetstonePort = {
  handlerId: 'whetstone',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const dam = Math.max(1, Math.round(getPName(piece.params, 'dam', getP1(piece.params, 2))));
    const targets = linkedPieces(ctx, piece, (o) => canBeEmpoweredPiece(o));
    for (const o of targets) addBonusDamage(o, dam);
    ctx.events.push({
      t: ctx.t,
      type: 'info',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${dam} dmg ×${targets.length}`,
      meta: { category: 'adjacency', script: true, handler: 'whetstone' },
    });
  },
};

/** HeroShield.gd — start dmg aura (buckler afterBlock deferred). */
/** @type {ScriptHandler} */
export const heroShieldPort = {
  handlerId: 'hero_shield',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const flat = Math.max(0, Math.round(getPName(piece.params, 'dam', getP1(piece.params, 1))));
    const factor = getPName(piece.params, 'damfactor', getP2(piece.params, 10)) / 100;
    const targets = linkedPieces(ctx, piece, (o) => canBeEmpoweredPiece(o));
    for (const o of targets) {
      if (flat) addBonusDamage(o, flat);
      if (factor) addBonusDamageFactor(o, factor);
    }
    ctx.events.push({
      t: ctx.t,
      type: 'info',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: weapon aura ×${targets.length}`,
      meta: { category: 'adjacency', script: true, handler: 'hero_shield' },
    });
  },
};

/** SmithingForDummies.gd — crafted weapons. */
/** @type {ScriptHandler} */
export const smithingForDummiesPort = {
  handlerId: 'smithing_for_dummies',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const stam = -Math.abs(getPName(piece.params, 'stamina', getP1(piece.params, 20)) / 100);
    const dam = Math.max(0, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 2))));
    const targets = linkedPieces(ctx, piece, (o, item) => {
      const crafted =
        item?.crafted === true ||
        itemHasType(item, 'crafted') ||
        String(item?.rarity || '').toLowerCase() === 'crafted';
      return crafted && (o.kind === 'weapon' || canBeEmpoweredPiece(o));
    });
    for (const o of targets) {
      changeStaminaFactor(o, stam);
      if (dam && canBeEmpoweredPiece(o)) addBonusDamage(o, dam);
    }
    ctx.events.push({
      t: ctx.t,
      type: 'info',
      label: `${piece.name}: crafted aura ×${targets.length}`,
      meta: { category: 'adjacency', script: true, handler: 'smithing_for_dummies' },
    });
  },
};

/** StoneGloves.gd — start slow + dmg factor; linked weapon hit → Block. */
/** @type {ScriptHandler} */
export const stoneGlovesPort = {
  handlerId: 'stone_gloves',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const { player, events, t } = ctx;
    const speedRed = getPName(piece.params, 'speedreduction', getP1(piece.params, 10)) / 100;
    const damF = getPName(piece.params, 'dambonus', getP2(piece.params, 15)) / 100;
    const targets = linkedPieces(ctx, piece, (o) => canBeEmpoweredPiece(o));
    /** @type {Set<string>} */
    const linkedKeys = new Set(targets.map((o) => o.placementKey));
    for (const o of targets) {
      if (speedRed) addSpeed(o, -speedRed);
      if (damF) addBonusDamageFactor(o, damF);
    }
    const blockPer = Math.max(1, Math.round(piece.blockGrant || getPName(piece.params, 'block', 1)));
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      const atk = payload?.piece;
      const hit = payload?.hit;
      if (!atk || !hit?.hit) return;
      if (!linkedKeys.has(atk.placementKey)) return;
      grantStacks(player, 'block', blockPer, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t: payload?.t ?? ctx.t,
        type: 'buff',
        target: 'player',
        amount: blockPer,
        label: `${piece.name}: +${blockPer} Block`,
        meta: { category: 'buff', stack: 'block', script: true, handler: 'stone_gloves' },
      });
    });
    events.push({
      t,
      type: 'info',
      label: `${piece.name}: gloves aura ×${targets.length}`,
      meta: { category: 'adjacency', script: true, handler: 'stone_gloves' },
    });
  },
};

/** Anvil.gd — crafted count buffs secondary weapons (combat start). */
/** @type {ScriptHandler} */
export const anvilPort = {
  handlerId: 'anvil',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const { graph, itemsById, canAffect, pieces } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let crafted = 0;
    /** @type {object[]} */
    const weapons = [];
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const item = itemsById.get(other.itemId);
      const isCrafted =
        item?.crafted === true || itemHasType(item, 'crafted');
      if (isCrafted) crafted += 1;
      if (other.kind === 'weapon' || canBeEmpoweredPiece(other)) weapons.push(other);
    }
    if (crafted <= 0) return;
    const dam = Math.max(0, Math.round(getP1(piece.params, 1) * crafted));
    const stam = -Math.abs((getP2(piece.params, 5) / 100) * crafted);
    for (const o of weapons) {
      if (canBeEmpoweredPiece(o) && dam) addBonusDamage(o, dam);
      changeStaminaFactor(o, stam);
    }
    ctx.events.push({
      t: ctx.t,
      type: 'info',
      label: `${piece.name}: ${crafted} crafted → weapons`,
      meta: { category: 'adjacency', script: true, handler: 'anvil' },
    });
  },
};

/** MushroomFarm.gd — speed on linked mushrooms. */
/** @type {ScriptHandler} */
export const mushroomFarmPort = {
  handlerId: 'mushroom_farm',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const speed = getPName(piece.params, 'speed', getP1(piece.params, 20)) / 100;
    const targets = linkedPieces(ctx, piece, (_o, item) => {
      const id = String(item?.id || '');
      return id === 'fly_agaric' || id === 'doom_cap' || itemHasType(item, 'mushroom');
    });
    for (const o of targets) if (speed) addSpeed(o, speed);
    ctx.events.push({
      t: ctx.t,
      type: 'info',
      label: `${piece.name}: mushroom haste ×${targets.length}`,
      meta: { category: 'adjacency', script: true, handler: 'mushroom_farm' },
    });
  },
};

/** SteelDragon.gd — prepare Block power; start reflect + dmg aura. */
/** @type {ScriptHandler} */
export const steelDragonPort = {
  handlerId: 'steel_dragon',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const { player } = ctx;
    const blockFactor = getPName(piece.params, 'blockfactor', 10) / 100;
    const reflect = Math.max(0, Math.round(getPName(piece.params, 'reflect', getP1(piece.params, 2))));
    if (reflect) player.debuffReflectStacks = (player.debuffReflectStacks || 0) + reflect;
    const dam = Math.max(0, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 2))));
    const targets = linkedPieces(ctx, piece, (o) => canBeEmpoweredPiece(o) || o.blockGrant > 0);
    for (const o of targets) {
      if (blockFactor && (o.blockGrant > 0 || o.kind === 'armor' || o.kind === 'shield')) {
        o.blockGrant = Math.max(
          0,
          Math.round((Number(o.blockGrant) || 0) * (1 + blockFactor)),
        );
      }
      if (dam && canBeEmpoweredPiece(o)) addBonusDamage(o, dam);
    }
    ctx.events.push({
      t: ctx.t,
      type: 'info',
      label: `${piece.name}: steel aura ×${targets.length}`,
      meta: { category: 'adjacency', script: true, handler: 'steel_dragon' },
    });
  },
};

/** VillainSword.gd — steal melee bonus damage onto self. */
/** @type {ScriptHandler} */
export const villainSwordPort = {
  handlerId: 'villain_sword',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const steal = Math.max(1, Math.round(getP1(piece.params, 1)));
    const selfGain = Math.max(1, Math.round(getP2(piece.params, 2)));
    const targets = linkedPieces(ctx, piece, (o, item) => {
      if (!canBeEmpoweredPiece(o)) return false;
      return (
        itemHasType(item, 'melee') ||
        String(item?.type || '')
          .toLowerCase()
          .includes('melee')
      );
    });
    for (const o of targets) addBonusDamage(o, -steal);
    addBonusDamage(piece, selfGain);
    ctx.events.push({
      t: ctx.t,
      type: 'info',
      label: `${piece.name}: steal dmg ×${targets.length}`,
      meta: { category: 'adjacency', script: true, handler: 'villain_sword' },
    });
  },
};

/** DancingDragon.gd — heat + lucky × magic neighbors; heat/lucky bus → dmg / resist. */
/** @type {ScriptHandler} */
export const dancingDragonPort = {
  handlerId: 'dancing_dragon',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { player } = ctx;
    const n = linkedPieces(ctx, piece, (_o, item) => itemHasType(item, 'magic')).length;
    const dmgPerHeat = Math.max(0, Number(getP1(piece.params, 1)) || 0);
    const resistPerLuck = Math.max(0, Number(piece.chance) || getPName(piece.params, 'chance', 5));
    onBuffChanged(player, (ch) => {
      if (ch.stack === 'heat' && ch.amount && dmgPerHeat) {
        addBonusDamageFromBuffChange(piece, ch, dmgPerHeat);
      }
      if (ch.stack === 'lucky' && ch.amount && resistPerLuck) {
        if (!player.stackResist) player.stackResist = {};
        for (const k of ['poison', 'blind', 'cold']) {
          player.stackResist[k] = (Number(player.stackResist[k]) || 0) + resistPerLuck * ch.amount;
        }
      }
    });
    if (n <= 0) return;
    const heat = Math.max(0, Math.round(getP2(piece.params, 1) * n));
    const luck = Math.max(0, Math.round(getP3(piece.params, 1) * n));
    if (heat) grantStacks(player, 'heat', heat, { originKey: piece.placementKey, originId: piece.itemId });
    if (luck) grantStacks(player, 'lucky', luck, { originKey: piece.placementKey, originId: piece.itemId });
    ctx.events.push({
      t: ctx.t,
      type: 'buff',
      target: 'player',
      amount: heat + luck,
      label: `${piece.name}: +${heat} Heat / +${luck} Lucky`,
      meta: { category: 'buff', script: true, handler: 'dancing_dragon' },
    });
  },
};

/** @type {Record<string, ScriptHandler>} */
export const WAVE_B_AURA_PORTS = {
  whetstone: whetstonePort,
  hero_shield: heroShieldPort,
  smithing_for_dummies: smithingForDummiesPort,
  stone_gloves: stoneGlovesPort,
  anvil: anvilPort,
  mushroom_farm: mushroomFarmPort,
  steel_dragon: steelDragonPort,
  villain_sword: villainSwordPort,
  dancing_dragon: dancingDragonPort,
};
