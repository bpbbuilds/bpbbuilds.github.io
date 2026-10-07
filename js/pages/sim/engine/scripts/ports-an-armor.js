/**
 * Band AN — leftover armor, claws, boots, whetstones.
 */

import { gainStacks } from '../stacks.js';
import {
  cleanseRandomDebuffs,
  grantStacks,
  useMana,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addBonusDamage, addSpeed } from '../piece-stats.js';
import { grantTimedResistancePct } from '../timed-resistance.js';
import { grantTimedSpeed } from '../timed-speed.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { whetstonePort } from './ports-wave-b-aura.js';
import { applyEffectDmgFactor } from '../actor-stats.js';
import { pushActivate } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function linked(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter((o) => links.some((l) => l.key === o.placementKey));
}

/** @type {ScriptHandler} */
const dragonscaleArmorPort = {
  handlerId: 'dragonscale_armor',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const dr = getP1(piece.params, 15);
    ctx.bus?.on?.('battle_rage_started', () => {
      gainStacks(ctx.player, 'block', Math.max(1, Math.round(piece.blockGrant || getPName(piece.params, 'block', 8))));
      grantTimedResistancePct(ctx.player, dr, ctx.player.battleRageUntil || ctx.t + 4, 'dragonscale');
      pushActivate(piece, ctx, 'dragonscale_armor', `Armor: ${piece.name}`);
    });
  },
};

/** @type {ScriptHandler} */
const dragonClawsPort = {
  handlerId: 'dragon_claws',
  family: 'unique',
  onCombatStart(piece, ctx) {
    ctx.player.stackResist = ctx.player.stackResist || {};
    ctx.player.stackResist.poison =
      (Number(ctx.player.stackResist.poison) || 0) + (Number(piece.chance) || 15);
    const spd = getP1(piece.params, 15) / 100;
    ctx.bus?.on?.('battle_rage_started', () => {
      for (const o of linked(ctx, piece)) {
        if (o.cooldown > 0 && o.cooldown < 500) addSpeed(o, spd);
      }
    });
  },
};

/** @type {ScriptHandler} */
const arcaneBootsPort = {
  handlerId: 'arcane_boots',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._arcane = false;
    const th = getPName(piece.params, 'healtht', 50) / 100;
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', 4)));
    ctx.bus?.on?.('player_damaged', () => {
      if (piece._arcane) return;
      if (ctx.player.maxHp <= 0 || ctx.player.hp / ctx.player.maxHp >= th) return;
      const mana = Number(ctx.player.stacks?.mana) || 0;
      if (mana < need) return;
      piece._arcane = true;
      useMana(ctx.player, need, { originKey: piece.placementKey, originId: piece.itemId });
      grantStacks(ctx.player, 'lucky', Math.max(1, Math.round(getPName(piece.params, 'luck', 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      grantStacks(ctx.player, 'empower', Math.max(1, Math.round(getPName(piece.params, 'empower', 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      gainStacks(ctx.player, 'block', Math.max(1, Math.round(piece.blockGrant || 4)));
      const spd = getPName(piece.params, 'speed', 20) / 100;
      const dur = Math.max(0.1, getPName(piece.params, 'dur_speed', 3));
      for (const o of linked(ctx, piece)) {
        if (o.cooldown > 0 && o.cooldown < 500) grantTimedSpeed(o, spd, ctx.t + dur, `arcane:${piece.placementKey}`);
      }
      pushActivate(piece, ctx, 'arcane_boots', `Shoes: ${piece.name}`);
      piece.alive = false;
    });
  },
};

/** @type {ScriptHandler} */
const dragonskinBootsPort = {
  handlerId: 'dragonskin_boots',
  family: 'unique',
  onCombatStart(piece, ctx) {
    ctx.player.stackResist = ctx.player.stackResist || {};
    ctx.player.stackResist.cold =
      (Number(ctx.player.stackResist.cold) || 0) + (Number(piece.chance) || 20);
    ctx.bus?.on?.('battle_rage_started', () => {
      cleanseRandomDebuffs(ctx.player, Math.max(1, Math.round(getP1(piece.params, 1))), ctx.rng, {});
      grantStacks(ctx.player, 'empower', Math.max(1, Math.round(getP2(piece.params, 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      gainStacks(ctx.player, 'block', Math.max(1, Math.round(piece.blockGrant || 4)));
    });
  },
};

/** @type {ScriptHandler} */
const stoneShoesPort = {
  handlerId: 'stone_shoes',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._stone = false;
    const th = getP1(piece.params, 40) / 100;
    ctx.bus?.on?.('player_damaged', () => {
      if (piece._stone) return;
      if (ctx.player.maxHp <= 0 || ctx.player.hp / ctx.player.maxHp >= th) return;
      piece._stone = true;
      grantStacks(ctx.player, 'lucky', Math.max(1, Math.round(getP2(piece.params, 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      grantStacks(ctx.player, 'empower', Math.max(1, Math.round(getP3(piece.params, 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      gainStacks(ctx.player, 'block', Math.max(1, Math.round(piece.blockGrant || 6)));
      const factor = getPName(piece.params, 'damreduction', 15) / 100;
      ctx.dummy.rangedDmgFactor = (Number(ctx.dummy.rangedDmgFactor) || 0) - factor;
      applyEffectDmgFactor(ctx.dummy, -factor, ctx, piece);
      piece._stoneUntil = ctx.t + Math.max(0.1, getPName(piece.params, 'dur', 7));
      pushActivate(piece, ctx, 'stone_shoes', `Shoes: ${piece.name}`);
      piece.alive = false;
    });
  },
  onTick(piece, ctx) {
    if (piece._stoneUntil == null || ctx.t < piece._stoneUntil || piece._stoneRestored) return;
    const factor = getPName(piece.params, 'damreduction', 35) / 100;
    ctx.dummy.rangedDmgFactor = (Number(ctx.dummy.rangedDmgFactor) || 0) + factor;
    ctx.dummy.effectDmgFactor = (Number(ctx.dummy.effectDmgFactor) || 0) + factor;
    piece._stoneRestored = true;
  },
};

/** @type {ScriptHandler} */
const wingedBootsPort = {
  handlerId: 'winged_boots',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._wing = false;
    const th = getPName(piece.params, 'healtht', 50) / 100;
    ctx.bus?.on?.('player_damaged', () => {
      if (piece._wing) return;
      if (ctx.player.maxHp <= 0 || ctx.player.hp / ctx.player.maxHp >= th) return;
      piece._wing = true;
      grantStacks(ctx.player, 'empower', Math.max(1, Math.round(getPName(piece.params, 'empower', 1))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      cleanseRandomDebuffs(ctx.player, Math.max(1, Math.round(getPName(piece.params, 'cleanse', 1))), ctx.rng, {});
      ctx.player.dodgeStacks =
        (Number(ctx.player.dodgeStacks) || 0) + Math.max(1, Math.round(getPName(piece.params, 'dodge', 1)));
      pushActivate(piece, ctx, 'winged_boots', `Shoes: ${piece.name}`);
      piece.alive = false;
    });
  },
};

/** Whetstone2.tscn uses Whetstone.gd */
const whetstone2Port = { ...whetstonePort, handlerId: 'whetstone2' };

/** @type {ScriptHandler} */
const whetstone3Port = {
  handlerId: 'whetstone3',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    whetstonePort.onCombatStart(piece, ctx);
    const fac = getPName(piece.params, 'blockfactor', 20) / 100;
    for (const o of linked(ctx, piece)) {
      if (!(Number(o.blockGrant) > 0) && !canBeEmpoweredPiece(o)) continue;
      if (Number(o.blockGrant) > 0) {
        o.blockGrant = Math.round(o.blockGrant * (1 + fac));
      }
      if (canBeEmpoweredPiece(o) && fac) addBonusDamage(o, 0);
    }
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AN_ARMOR_PORTS = {
  dragonscale_armor: dragonscaleArmorPort,
  dragon_claws: dragonClawsPort,
  arcane_boots: arcaneBootsPort,
  dragonskin_boots: dragonskinBootsPort,
  stone_shoes: stoneShoesPort,
  winged_boots: wingedBootsPort,
  whetstone2: whetstone2Port,
  whetstone3: whetstone3Port,
};
