/**
 * Band AD Wave B — aura / start-weapon damage auras.
 */

import { grantStacks, onBuffChanged } from '../buff-economy.js';
import { tryUseStamina } from '../actor.js';
import { changeReflectStacks } from '../actor-stats.js';
import { affectedTargets } from '../board-graph.js';
import { giveBuffPower } from '../buff-power.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { modifiedParamValue } from '../placement-instance.js';
import {
  addBonusDamage,
  addBonusDamageFactor,
  addSpeed,
  changeVaryingDamageFromBuffChange,
  multiplyStaminaCost,
} from '../piece-stats.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { itemHasType, pushActivate } from './ports-util.js';
import { eventSideForPiece } from '../vs-board.js';

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

/** HeroShield.gd delegates to Item.canBeEmpowered(): weapon with damage. */
function canHeroShieldEmpower(other, item) {
  if (other?.empowerable === false) return false;
  const isWeapon = itemHasType(item, 'weapon') || other?.kind === 'weapon';
  const canDamage =
    Number(other?.damageMin) > 0 ||
    Number(other?.damageMax) > 0 ||
    Number(item?.damageMin) > 0 ||
    Number(item?.damageMax) > 0;
  return isWeapon && canDamage;
}

/**
 * SteelDragon.gd delegates both predicates to the affected Item instance.
 * The catalog exposes ordinary block providers as `block`; the two extracted
 * custom canBlock overrides are retained here because their base catalog stat
 * is intentionally empty.
 * @param {object} other
 * @param {object|undefined} item
 */
function canSteelDragonBlock(other, item) {
  const id = String(item?.id || other?.itemId || '').toLowerCase();
  return (
    Number(item?.block) > 0 ||
    Number(other?.blockGrant) > 0 ||
    id === 'halberd' ||
    id === 'stoned'
  );
}

/**
 * Item.canBeEmpowered() is stricter than the generic aura helper: it requires
 * an actual Weapon with damage. Keep Steel Dragon's source predicate local so
 * pets or damage-bearing non-weapons are not accidentally buffed.
 * @param {object} other
 * @param {object|undefined} item
 */
function canSteelDragonEmpower(other, item) {
  if (other?.empowerable === false) return false;
  const weapon = itemHasType(item, 'weapon') || other?.kind === 'weapon';
  const damage =
    Number(other?.damageMin) > 0 ||
    Number(other?.damageMax) > 0 ||
    Number(item?.damageMin) > 0 ||
    Number(item?.damageMax) > 0;
  return weapon && damage;
}

/** Whetstone.gd */
/** @type {ScriptHandler} */
export const whetstonePort = {
  handlerId: 'whetstone',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const dam = Math.max(1, Math.round(getPName(piece.params, 'dam', getP1(piece.params, 2))));
    const targets = linkedPieces(ctx, piece, canHeroShieldEmpower);
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

/**
 * HeroShield inherits WoodenBuckler.afterBlock. Keep that inherited shield
 * registration beside the Hero Shield aura so chance blocking, stamina drain,
 * and activation all use the same live actor path.
 */
function registerHeroShield(piece, ctx) {
  const catalog = ctx.itemsById?.get(piece.itemId);
  const chanceRaw = catalog?.chance ?? piece.chance ?? 30;
  const chance = Number.isFinite(Number(chanceRaw)) ? Number(chanceRaw) : 30;
  const damblockRaw = getPName(piece.params, 'damblock', getP1(piece.params, 7));
  const damblock = Number.isFinite(Number(damblockRaw)) ? Math.round(Number(damblockRaw)) : 0;
  const stamRaw = getPName(piece.params, 'stamina', getP2(piece.params, 0.3));
  const stamDrain = Number.isFinite(Number(stamRaw)) ? Number(stamRaw) : 0;
  if (!ctx.player._shields) ctx.player._shields = [];
  ctx.player._shields.push({
    piece,
    chance,
    damblock,
    afterBlock(payload) {
      if (!piece.alive) return;
      const drain = Math.max(0, stamDrain);
      if (drain > 0) {
        tryUseStamina(ctx.player, drain);
        ctx.events.push({
          t: payload?.t ?? ctx.t,
          type: 'stamina',
          actor: eventSideForPiece(piece),
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          amount: drain,
          label: `${piece.name}: drain ${drain} stamina (afterBlock)`,
          meta: { category: 'stamina', script: true, handler: 'hero_shield' },
        });
      }
      pushActivate(piece, ctx, 'hero_shield', `Shield: ${piece.name}`);
    },
  });
}

/** HeroShield.gd — start damage aura plus inherited WoodenBuckler blocking. */
/** @type {ScriptHandler} */
export const heroShieldPort = {
  handlerId: 'hero_shield',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const flatRaw = getPName(piece.params, 'dam', getP3(piece.params, 2));
    const flat = Number.isFinite(Number(flatRaw)) ? Number(flatRaw) : 0;
    const factorRaw = getPName(piece.params, 'damfactor', getP4(piece.params, 15));
    const factor = (Number.isFinite(Number(factorRaw)) ? Number(factorRaw) : 0) / 100;
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
    registerHeroShield(piece, ctx);
    pushActivate(piece, ctx, 'hero_shield', `Shield: ${piece.name}`);
  },
};

/** SmithingForDummies.gd — crafted weapons. */
/** @type {ScriptHandler} */
export const smithingForDummiesPort = {
  handlerId: 'smithing_for_dummies',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const stam = -modifiedParamValue(
      piece,
      getPName(piece.params, 'stamina', getP1(piece.params, 20)),
      'stamina',
    ) / 100;
    const dam = modifiedParamValue(
      piece,
      getPName(piece.params, 'dam', getP2(piece.params, 2)),
      'dam',
    );
    const targets = linkedPieces(ctx, piece, (o, item) => {
      const craftedIds = ctx.canAffect?.craftedIds;
      const crafted =
        item?.crafted === true ||
        itemHasType(item, 'crafted') ||
        String(item?.rarity || '').toLowerCase() === 'crafted' ||
        (craftedIds instanceof Set
          ? craftedIds.has(String(item?.id || o.itemId))
          : Array.isArray(craftedIds) && craftedIds.includes(String(item?.id || o.itemId)));
      return crafted && (o.kind === 'weapon' || itemHasType(item, 'weapon'));
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
    pushActivate(piece, ctx, 'smithing_for_dummies', `${piece.name}: activate`);
  },
};

/** StoneGloves.gd — start slow + dmg factor; linked weapon hit → Block. */
/**
 * StoneGloves.gd uses Item.canBeEmpowered(): a damage-dealing Weapon only.
 * @param {object} other
 * @param {object|undefined} item
 */
function canStoneGlovesEmpower(other, item) {
  if (other?.empowerable === false) return false;
  const weapon = itemHasType(item, 'weapon') || other?.kind === 'weapon';
  const damage =
    Number(other?.damageMin) > 0 ||
    Number(other?.damageMax) > 0 ||
    Number(item?.damageMin) > 0 ||
    Number(item?.damageMax) > 0;
  return weapon && damage;
}

/** @type {ScriptHandler} */
export const stoneGlovesPort = {
  handlerId: 'stone_gloves',
  family: 'synergy_aura',
  onPrepare(piece, ctx) {
    const targets = linkedPieces(ctx, piece, (o, item) => canStoneGlovesEmpower(o, item));
    const linkedKeys = new Set(targets.map((o) => o.placementKey));
    piece._stoneGlovesLinkedKeys = linkedKeys;
    const { player, events } = ctx;
    const blockPer = Math.max(
      0,
      Math.round(
        Number(piece.blockGrant) ||
          Number(ctx.itemsById?.get?.(piece.itemId)?.block) ||
          getPName(piece.params, 'block', getP1(piece.params, 0)),
      ),
    );
    ctx.bus?.on?.('item_attacked', (payload) => {
      const atk = payload?.piece;
      if (!atk || !payload?.hit?.hit) return;
      if (!linkedKeys.has(atk.placementKey) || !(blockPer > 0)) return;
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
      events.push({
        t: payload?.t ?? ctx.t,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: mini activate`,
        meta: { category: 'system', script: true, handler: 'stone_gloves', miniActivate: true },
      });
    });
  },
  onCombatStart(piece, ctx) {
    const { events, t } = ctx;
    const speedRed = getPName(piece.params, 'speedreduction', getP1(piece.params, 10)) / 100;
    const damF = getPName(piece.params, 'dambonus', getP2(piece.params, 15)) / 100;
    const targets = linkedPieces(ctx, piece, (o, item) => canStoneGlovesEmpower(o, item));
    for (const o of targets) {
      if (speedRed) addSpeed(o, -speedRed);
      if (damF) addBonusDamageFactor(o, damF);
    }
    events.push({
      t,
      type: 'info',
      label: `${piece.name}: gloves aura ×${targets.length}`,
      meta: { category: 'adjacency', script: true, handler: 'stone_gloves' },
    });
    pushActivate(piece, ctx, 'stone_gloves', `Accessory: ${piece.name}`);
  },
};

/** Anvil.gd — primary crafted count buffs secondary weapons before combat. */
/** @type {ScriptHandler} */
export const anvilPort = {
  handlerId: 'anvil',
  family: 'synergy_aura',
  onPreCombatStart(piece, ctx) {
    const { graph, itemsById, canAffect, pieces } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const primary = new Set(links.filter((link) => link.color === 'primary').map((link) => link.key));
    const secondary = new Set(links.filter((link) => link.color === 'secondary').map((link) => link.key));
    let crafted = 0;
    /** @type {object[]} */
    const weapons = [];
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const item = itemsById.get(other.itemId);
      const isCrafted =
        item?.crafted === true || itemHasType(item, 'crafted');
      if (primary.has(other.placementKey) && isCrafted) crafted += 1;
      if (secondary.has(other.placementKey) && (other.kind === 'weapon' || canBeEmpoweredPiece(other))) weapons.push(other);
    }
    if (crafted > 0) {
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
    }
    pushActivate(piece, ctx, 'anvil', `Accessory: ${piece.name}`);
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
  onPrepare(piece, ctx) {
    const blockFactor = getPName(piece.params, 'blockfactor', getP3(piece.params, 10)) / 100;
    if (!blockFactor) return;
    const targets = linkedPieces(
      ctx,
      piece,
      (o, item) => canSteelDragonBlock(o, item) || canSteelDragonEmpower(o, item),
    );
    for (const o of targets) {
      const item = ctx.itemsById.get(o.itemId);
      if (canSteelDragonBlock(o, item)) giveBuffPower(o, 'block', blockFactor);
    }
  },
  onPreCombatStart(piece, ctx) {
    const reflect = Math.max(0, Math.round(getPName(piece.params, 'reflect', getP1(piece.params, 0))));
    changeReflectStacks(ctx.player, reflect, ctx, piece);
  },
  onCombatStart(piece, ctx) {
    const dam = Math.max(0, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 0))));
    const targets = linkedPieces(
      ctx,
      piece,
      (o, item) => canSteelDragonEmpower(o, item) || canSteelDragonBlock(o, item),
    );
    for (const o of targets) if (dam) addBonusDamage(o, dam);
    pushActivate(piece, ctx, 'steel_dragon', `Weapon: ${piece.name}`);
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
  family: 'weapon_base',
  onPreCombatStart(piece, ctx) {
    const steal = getP1(piece.params, 0);
    const selfGain = getP2(piece.params, 0);
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
function bindDancingDragonBuff(piece, ctx) {
  const { player } = ctx;
  const dmgPerHeat = Math.max(0, Number(getP1(piece.params, 1)) || 0);
  const resistPerLuck = Math.max(0, Number(piece.chance) || getPName(piece.params, 'chance', 5));
  if (piece._dancingDragonBuffBound) return;
  piece._dancingDragonBuffBound = true;
  onBuffChanged(player, (ch) => {
    if (ch.stack === 'heat' && ch.amount && dmgPerHeat) {
      changeVaryingDamageFromBuffChange(piece, ch, dmgPerHeat);
    }
    if (ch.stack === 'lucky' && ch.amount && resistPerLuck) {
      if (!player.stackResist) player.stackResist = {};
      for (const k of ['poison', 'blind', 'cold']) {
        player.stackResist[k] = (Number(player.stackResist[k]) || 0) + resistPerLuck * ch.amount;
      }
    }
  });
}

/** @type {ScriptHandler} */
export const dancingDragonPort = {
  handlerId: 'dancing_dragon',
  family: 'unique',
  onPrepare(piece, ctx) {
    bindDancingDragonBuff(piece, ctx);
  },
  onCombatStart(piece, ctx) {
    bindDancingDragonBuff(piece, ctx);
    const { player } = ctx;
    const n = linkedPieces(ctx, piece, (_o, item) => itemHasType(item, 'magic')).length;
    if (n <= 0) return;
    const heat = Math.max(0, Math.round(getP2(piece.params, 1) * n));
    const luck = Math.max(0, Math.round(getP3(piece.params, 1) * n));
    if (heat) grantStacks(player, 'heat', heat, { originKey: piece.placementKey, originId: piece.itemId });
    if (luck) grantStacks(player, 'lucky', luck, { originKey: piece.placementKey, originId: piece.itemId });
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
