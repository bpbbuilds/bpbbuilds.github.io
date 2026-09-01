/**
 * Band AN — cubes / coil / trap / eat-o-matic / recombobulators.
 */

import { healActor } from '../actor.js';
import { applyHealEfficiency } from '../actor-stats.js';
import {
  cleanseRandomDebuffs,
  giveRandomBuffs,
  onBuffChanged,
  stealRandomBuff,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { advanceCooldownSeconds } from '../cooldown.js';
import { getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { getStackAmount } from '../stacks.js';
import { itemHasType, pushActivate } from './ports-util.js';
import { emitChargePulse } from '../charge-delivery.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

function linkedCd(ctx, piece) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  return (ctx.pieces || []).filter(
    (o) =>
      links.some((l) => l.key === o.placementKey) &&
      o.cooldown > 0 &&
      o.cooldown < 500,
  );
}

function firstLinkedCd(ctx, piece) {
  return linkedCd(ctx, piece)[0] || null;
}

function cubeAdvance(target, ctx, piece) {
  if (!target) return;
  const base = getPName(piece.params, 'cdadvance', 2);
  const pen = 1 - getPName(piece.params, 'penalty', 50) / 100;
  ctx._cubeAdv = ctx._cubeAdv || new Map();
  const prior = ctx._cubeAdv.get(target.placementKey);
  const amt = prior && prior !== piece.placementKey ? base * pen : base;
  ctx._cubeAdv.set(target.placementKey, piece.placementKey);
  advanceCooldownSeconds(target, amt, ctx);
}

/** @type {import('./handlers.js').ScriptHandler} */
const chromeCubePort = {
  handlerId: 'chrome_cube',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._cube = false;
    const th = getPName(piece.params, 'healtht', 50) / 100;
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      if (piece._cube || !payload?.hit?.hit) return;
      if (ctx.dummy.maxHp <= 0 || ctx.dummy.hp / ctx.dummy.maxHp >= th) return;
      piece._cube = true;
      cubeAdvance(firstLinkedCd(ctx, piece), ctx, piece);
      applyHealEfficiency(
        ctx.dummy,
        -getPName(piece.params, 'healreduction', 50) / 100,
        ctx,
        piece,
      );
      piece.alive = false;
    });
  },
};

/** @type {import('./handlers.js').ScriptHandler} */
const goldCubePort = {
  handlerId: 'gold_cube',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._cube = false;
    const th = getPName(piece.params, 'healtht', 50) / 100;
    ctx.bus?.on?.('player_damaged', () => {
      if (piece._cube) return;
      if (ctx.player.maxHp <= 0 || ctx.player.hp / ctx.player.maxHp >= th) return;
      piece._cube = true;
      cubeAdvance(firstLinkedCd(ctx, piece), ctx, piece);
      const regen = getStackAmount(ctx.player, 'regeneration');
      healActor(
        ctx.player,
        Math.max(1, Math.round(getPName(piece.params, 'heal', 8) + getPName(piece.params, 'heal_regen', 2) * regen)),
      );
      piece.alive = false;
    });
  },
};

/** @type {import('./handlers.js').ScriptHandler} */
const bismuthCubePort = {
  handlerId: 'bismuth_cube',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._bisAcc = 0;
    piece._bisUses = 0;
    const need = Math.max(1, Math.round(getPName(piece.params, 'buffs', 4)));
    const max = Math.max(1, Math.round(getPName(piece.params, 'max', 3)));
    const target = firstLinkedCd(ctx, piece);
    onBuffChanged(ctx.player, (ch) => {
      if (!(ch.amount > 0) || piece._bisUses >= max) return;
      piece._bisAcc += ch.amount;
      let n = 0;
      while (piece._bisAcc > need && piece._bisUses + n < max) {
        piece._bisAcc -= need;
        n += 1;
      }
      if (!n) return;
      piece._bisUses += n;
      if (target) {
        const base = getPName(piece.params, 'cdadvance', 2);
        const pen = 1 - getPName(piece.params, 'penalty', 50) / 100;
        ctx._cubeAdv = ctx._cubeAdv || new Map();
        const prior = ctx._cubeAdv.get(target.placementKey);
        const amt = prior && prior !== piece.placementKey ? base * pen : base;
        ctx._cubeAdv.set(target.placementKey, piece.placementKey);
        advanceCooldownSeconds(target, amt * n, ctx);
      }
      giveRandomBuffs(ctx.player, n, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    });
  },
};

/** @type {import('./handlers.js').ScriptHandler} */
const coilPort = {
  handlerId: 'coil',
  family: 'unique',
  onChargeReceived(piece, ctx) {
    piece._coilN = (piece._coilN || 0) + 1;
    const max = Math.max(1, Math.round(getPName(piece.params, 'max', 4)));
    if (piece._coilN > max) return;
    stealRandomBuff(ctx.dummy, ctx.player, Math.max(1, Math.round(getPName(piece.params, 'buffs', 1))), ctx.rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (piece._coilN >= max) piece.alive = false;
  },
};

/** @type {import('./handlers.js').ScriptHandler} */
const conTrapTronPort = {
  handlerId: 'con_trap_tron',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._trap = false;
    const malus = getPName(piece.params, 'speed', 20) / 100;
    const target = firstLinkedCd(ctx, piece);
    if (target) addSpeed(target, -malus);
    const th = getPName(piece.params, 'healtht', 50) / 100;
    ctx.bus?.on?.('player_damaged', () => {
      if (piece._trap) return;
      if (ctx.player.maxHp <= 0 || ctx.player.hp / ctx.player.maxHp >= th) return;
      piece._trap = true;
      emitChargePulse(piece, ctx, { label: `${piece.name}: charge` });
      const item = firstLinkedCd(ctx, piece);
      if (item) {
        let adv = getPName(piece.params, 'cdadvance_base', 2);
        if (item.kind !== 'weapon') adv += getPName(piece.params, 'cdadvance_bonus', 1);
        advanceCooldownSeconds(item, adv, ctx);
      }
      pushActivate(piece, ctx, 'con_trap_tron', `Gadget: ${piece.name}`);
    });
  },
};

/** @type {import('./handlers.js').ScriptHandler} */
const eatOMaticPort = {
  handlerId: 'eat_o_matic',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const foods = (ctx.pieces || []).filter((o) => itemHasType(ctx.itemsById.get(o.itemId), 'food'));
    const primary = linkedCd(ctx, piece).find((o) => itemHasType(ctx.itemsById.get(o.itemId), 'food')) || foods[0];
    piece._eatPrimary = primary;
    if (primary) addSpeed(primary, getPName(piece.params, 'speed', 20) / 100);
    piece._eatOthers = foods.filter((f) => f !== primary);
  },
  onChargeReceived(piece, ctx) {
    const primary = piece._eatPrimary;
    if (primary) addSpeed(primary, getPName(piece.params, 'speed2', 15) / 100);
    for (const f of piece._eatOthers || []) addSpeed(f, getPName(piece.params, 'speed3', 8) / 100);
  },
};

function recombPort(id) {
  return {
    handlerId: id,
    family: 'unique',
    onCooldownEffect(piece, ctx) {
      // Shop fuse out of scope — combat CD: 1 buff + 1 cleanse (Recombobulator.gd).
      giveRandomBuffs(ctx.player, 1, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      cleanseRandomDebuffs(ctx.player, 1, ctx.rng, {});
      pushActivate(piece, ctx, id, `Gadget: ${piece.name}`);
      return true;
    },
  };
}

/** @type {Record<string, import('./handlers.js').ScriptHandler>} */
export const AN_GADGET_PORTS = {
  chrome_cube: chromeCubePort,
  gold_cube: goldCubePort,
  bismuth_cube: bismuthCubePort,
  coil: coilPort,
  con_trap_tron: conTrapTronPort,
  eat_o_matic: eatOMaticPort,
  stable_recombobulator: recombPort('stable_recombobulator'),
  unstable_recombobulator: recombPort('unstable_recombobulator'),
};
