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
import { giveBuffPower } from '../buff-power.js';
import { getP1, getP2, getP3, getP5, getPName } from '../params.js';
import { modifiedParamValue } from '../placement-instance.js';
import { addSpeed } from '../piece-stats.js';
import { grantTimedSpeed } from '../timed-speed.js';
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

/** Whetstone3.gd inherits Whetstone.canAffect and adds Item.canBlock(). */
function canWhetstone3Target(other, item) {
  const id = String(item?.id || other?.itemId || '').toLowerCase();
  const canBlock =
    id === 'halberd' ||
    id === 'stoned' ||
    (id !== 'burning_coal' && id !== 'lump_of_coal' &&
      (Number(other?.blockGrant) > 0 || Number(item?.block) > 0));
  const isWeapon = /weapon/i.test(String(item?.type || '')) || other?.kind === 'weapon';
  const canDamage =
    Number(other?.damageMin) > 0 ||
    Number(other?.damageMax) > 0 ||
    Number(item?.damageMin) > 0 ||
    Number(item?.damageMax) > 0;
  return canBlock || (other?.empowerable !== false && isWeapon && canDamage);
}

/** @type {ScriptHandler} */
const dragonscaleArmorPort = {
  handlerId: 'dragonscale_armor',
  family: 'unique',
  onPrepare(piece, ctx) {
    const dr = getP1(piece.params, 15);
    const block = Number.isFinite(Number(piece.blockGrant))
      ? Number(piece.blockGrant)
      : getPName(piece.params, 'block', 8);
    const ownRage = (payload = {}, amount) => {
      if (payload.actor && payload.actor !== ctx.player) return;
      gainStacks(ctx.player, 'block', block);
      ctx.player.damageResistancePct = (Number(ctx.player.damageResistancePct) || 0) + amount;
      pushActivate(piece, ctx, 'dragonscale_armor', `Armor: ${piece.name}`);
    };
    ctx.bus?.on?.('battle_rage_started', (payload = {}) => ownRage(payload, dr));
    ctx.bus?.on?.('battle_rage_ended', (payload = {}) => {
      if (payload.actor && payload.actor !== ctx.player) return;
      ctx.player.damageResistancePct = (Number(ctx.player.damageResistancePct) || 0) - dr;
    });
  },
};

/** @type {ScriptHandler} */
const dragonClawsPort = {
  handlerId: 'dragon_claws',
  family: 'unique',
  onPrepare(piece, ctx) {
    ctx.player.stackResist = ctx.player.stackResist || {};
    ctx.player.stackResist.poison =
      (Number(ctx.player.stackResist.poison) || 0) +
      (Number.isFinite(Number(piece.chance)) ? Number(piece.chance) : 0);
    const spd = getP1(piece.params, 15) / 100;
    const hasCooldown = (other) => {
      const catalogItem = ctx.itemsById?.get?.(other.itemId);
      const cd = catalogItem?.cooldown ?? other.baseCooldown ?? other.cooldown;
      return cd > 0 && cd < 500;
    };
    const ownRage = (payload = {}, amount) => {
      if (payload.actor && payload.actor !== ctx.player) return;
      for (const o of linked(ctx, piece)) {
        if (hasCooldown(o)) addSpeed(o, amount);
      }
    };
    ctx.bus?.on?.('battle_rage_started', (payload = {}) => ownRage(payload, spd));
    ctx.bus?.on?.('battle_rage_ended', (payload = {}) => ownRage(payload, -spd));
  },
};

/** @type {ScriptHandler} */
const bindArcaneBoots = (piece, ctx) => {
  if (piece._arcaneBound) return;
  piece._arcaneBound = true;
    piece._arcane = false;
    // ArcaneBoots.gd stores healtht / 100 - 0.0001 and triggers strictly below it.
    const th = getPName(piece.params, 'healtht', 50) / 100 - 0.0001;
    const need = Math.max(1, Math.round(getPName(piece.params, 'manat', 4)));
    ctx.bus?.on?.('character_damaged', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
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
      piece.charges = 0;
    });
    ctx.bus?.on?.('player_damaged', (payload) => {
      if (piece._arcane) return;
      if (ctx.player.maxHp <= 0 || ctx.player.hp / ctx.player.maxHp >= th) return;
      // The player_damaged signal is a legacy alias; reuse the canonical
      // callback by emitting the source-shaped event through the same bus.
      ctx.bus?.emit?.('character_damaged', { ...payload, actor: ctx.player });
    });
};
const arcaneBootsPort = {
  handlerId: 'arcane_boots',
  family: 'unique',
  // ArcaneBoots.gd connects during onPrepare. Keep onCombatStart as an
  // idempotent compatibility alias for direct handler callers.
  onPrepare: bindArcaneBoots,
  onCombatStart: bindArcaneBoots,
};

/** @type {ScriptHandler} */
const dragonskinBootsPort = {
  handlerId: 'dragonskin_boots',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._hasActivated = false;
    ctx.player.stackResist = ctx.player.stackResist || {};
    const chance = Number.isFinite(Number(piece.chance))
      ? Number(piece.chance)
      : 20;
    ctx.player.stackResist.cold =
      (Number(ctx.player.stackResist.cold) || 0) + chance;
    const cleanse = Math.trunc(getPName(piece.params, 'p1', 1));
    const empower = Math.trunc(getPName(piece.params, 'p2', 1));
    const block = Number.isFinite(Number(piece.blockGrant))
      ? Number(piece.blockGrant)
      : getPName(piece.params, 'block', 4);
    ctx.bus?.on?.('battle_rage_started', (payload = {}) => {
      if (payload.actor && payload.actor !== ctx.player) return;
      cleanseRandomDebuffs(ctx.player, cleanse, ctx.rng, {});
      grantStacks(ctx.player, 'empower', empower, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      gainStacks(ctx.player, 'block', block);
    });
  },
};

/** @type {ScriptHandler} */
const bindStoneShoes = (piece, ctx) => {
  if (piece._stoneBound) return;
  piece._stoneBound = true;
    piece._stone = false;
    const th = getP1(piece.params, 40) / 100 - 0.0001;
    ctx.bus?.on?.('character_damaged', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
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
      const catalogBlock = Number(ctx.itemsById?.get?.(piece.itemId)?.block);
      const block = Number.isFinite(Number(piece.blockGrant))
        ? Number(piece.blockGrant)
        : Number.isFinite(catalogBlock)
          ? catalogBlock
          : getPName(piece.params, 'block', 0);
      gainStacks(ctx.player, 'block', Math.max(0, Math.round(block)));
      const factor = getPName(piece.params, 'damreduction', 15) / 100;
      ctx.dummy.rangedDmgFactor = (Number(ctx.dummy.rangedDmgFactor) || 0) - factor;
      applyEffectDmgFactor(ctx.dummy, -factor, ctx, piece);
      const duration = modifiedParamValue(
        piece,
        getPName(piece.params, 'dur', getP5(piece.params, 7)),
        'dur',
      );
      piece._stoneUntil = ctx.t + Math.max(0.1, duration);
      pushActivate(piece, ctx, 'stone_shoes', `Shoes: ${piece.name}`);
      piece.alive = false;
    });
    ctx.bus?.on?.('player_damaged', (payload) => {
      if (piece._stone) return;
      if (ctx.player.maxHp <= 0 || ctx.player.hp / ctx.player.maxHp >= th) return;
      ctx.bus?.emit?.('character_damaged', { ...payload, actor: ctx.player });
    });
};
const stoneShoesPort = {
  handlerId: 'stone_shoes',
  family: 'unique',
  // StoneShoes.gd connects during onPrepare.
  onPrepare: bindStoneShoes,
  onCombatStart: bindStoneShoes,
  onTick(piece, ctx) {
    if (piece._stoneUntil == null || ctx.t < piece._stoneUntil || piece._stoneRestored) return;
    const factor = getPName(piece.params, 'damreduction', 35) / 100;
    ctx.dummy.rangedDmgFactor = (Number(ctx.dummy.rangedDmgFactor) || 0) + factor;
    ctx.dummy.effectDmgFactor = (Number(ctx.dummy.effectDmgFactor) || 0) + factor;
    piece._stoneRestored = true;
  },
};

/** @type {ScriptHandler} */
const bindWingedBoots = (piece, ctx) => {
  if (piece._wingBound) return;
  piece._wingBound = true;
    piece._wing = false;
    const th = getPName(piece.params, 'healtht', 50) / 100;
    ctx.bus?.on?.('character_damaged', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
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
    ctx.bus?.on?.('player_damaged', (payload) => {
      if (piece._wing) return;
      if (ctx.player.maxHp <= 0 || ctx.player.hp / ctx.player.maxHp >= th) return;
      ctx.bus?.emit?.('character_damaged', { ...payload, actor: ctx.player });
    });
};
const wingedBootsPort = {
  handlerId: 'winged_boots',
  family: 'unique',
  // WingedBoots.gd connects during onPrepare.
  onPrepare: bindWingedBoots,
  onCombatStart: bindWingedBoots,
};

/** Whetstone2.tscn uses Whetstone.gd */
const whetstone2Port = { ...whetstonePort, handlerId: 'whetstone2' };

/** @type {ScriptHandler} */
const whetstone3Port = {
  handlerId: 'whetstone3',
  family: 'synergy_aura',
  onPrepare(piece, ctx) {
    const factor = getPName(piece.params, 'blockfactor', getP2(piece.params, 0)) / 100;
    for (const other of linked(ctx, piece)) {
      giveBuffPower(other, 'block', factor);
    }
  },
  onCombatStart(piece, ctx) {
    whetstonePort.onCombatStart(piece, ctx, canWhetstone3Target);
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
