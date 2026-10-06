/**
 * Band Y Phase 141 — pets / unique CD.
 */

import { healActor } from '../actor.js';
import {
  cleanseRandomDebuffs,
  grantStacks,
  grantTemporaryStacks,
  stealRandomBuff,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { eventSideForPiece } from '../vs-board.js';
import { goobertPeerTick } from './ports-wave-d-goobert.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @type {ScriptHandler} */
export const squirrelPort = {
  handlerId: 'squirrel',
  family: 'pet_like',
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, rng } = ctx;
    pushActivate(piece, ctx, 'squirrel', `Pet: ${piece.name}`);
    const stolen = stealRandomBuff(dummy, player, 1, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'squirrel', stolen);
    return true;
  },
};

/** @type {ScriptHandler} */
export const turtlePort = {
  handlerId: 'turtle',
  family: 'pet_like',
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'turtle', `Pet: ${piece.name}`);
    const frac = getPName(piece.params, 'maxhealthblock', getP1(piece.params, 5)) / 100;
    const block =
      Math.max(1, Math.round(piece.blockGrant || getP2(piece.params, 4))) +
      Math.round(player.maxHp * frac);
    gainStacks(player, 'block', block);
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'turtle' },
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const ratChefPort = {
  handlerId: 'rat_chef',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect, pieces } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let foods = 0;
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (itemHasType(itemsById.get(other.itemId), 'food')) foods += 1;
    }
    if (foods > 0) {
      grantStacks(player, 'regeneration', foods, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t,
        type: 'buff',
        target: 'player',
        amount: foods,
        label: `${piece.name}: +${foods} Regen`,
        meta: { category: 'buff', stack: 'regeneration', script: true, handler: 'rat_chef' },
      });
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'rat_chef', `Pet: ${piece.name}`);
    const stam = Math.max(1, Math.round(getP1(piece.params, 2)));
    const emp = Math.max(1, Math.round(getP2(piece.params, 1)));
    player.stamina = Math.min(player.maxStamina || 20, (player.stamina || 0) + stam);
    grantStacks(player, 'empower', emp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: emp,
      label: `${piece.name}: +${stam} stam +${emp} Empower`,
      meta: { category: 'buff', stack: 'empower', script: true, handler: 'rat_chef' },
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const bloodGoobertPort = {
  handlerId: 'blood_goobert',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const vamp = Math.max(
      1,
      Math.round(getPName(piece.params, 'vampirism', getP3(piece.params, 5))),
    );
    grantStacks(ctx.player, 'vampirism', vamp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushActivate(piece, ctx, 'blood_goobert', `Pet: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events } = ctx;
    pushActivate(piece, ctx, 'blood_goobert', `Pet: ${piece.name}`);
    const dam =
      Math.max(1, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 4)))) +
      (Number(player.stacks.vampirism) || 0);
    const ls = getPName(piece.params, 'lifesteal', 50) / 100;
    dummy.hp = Math.max(0, dummy.hp - dam);
    const healed = healActor(player, Math.round(dam * ls));
    events.push({
      t: t + 0.004,
      type: 'damage',
      target: 'dummy',
      amount: dam,
      label: `${piece.name}: ${dam} lifesteal`,
      meta: { category: 'damage', script: true, handler: 'blood_goobert' },
    });
    if (healed > 0) {
      events.push({
        t: t + 0.006,
        type: 'heal',
        target: 'player',
        amount: healed,
        label: `${piece.name}: +${healed} HP`,
        meta: { category: 'heal', script: true, handler: 'blood_goobert' },
      });
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const carrotGoobertPort = {
  handlerId: 'carrot_goobert',
  family: 'pet_like',
  onPrepare(piece) {
    piece._goobertActs = 0;
    piece._carrotActive = false;
  },
  // Goobert.gd is peer-activation driven; it must not run as a timed CD.
  onCooldownEffect() {
    return false;
  },
  onPeerActivated(piece, _activated, ctx) {
    goobertPeerTick(piece, ctx, () => {
      const { t, player, events, rng } = ctx;
      piece._carrotActive = true;
      const originData = {
        originKey: piece.placementKey,
        originId: piece.itemId,
        rng,
        opponent: ctx.dummy,
      };
      const cleanse = Math.max(1, Math.round(getP2(piece.params, 4)));
      cleanseRandomDebuffs(player, cleanse, rng, originData);
      const emp = Math.max(1, Math.round(getP3(piece.params, 2)));
      const dur = Math.max(0.5, getPName(piece.params, 'dur', getP4(piece.params, 8)));
      grantTemporaryStacks(player, 'empower', emp, dur, t, originData);
      const side = eventSideForPiece(piece);
      events.push({
        t: t + 0.004,
        type: 'buff',
        actor: side,
        target: side,
        amount: emp,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${emp} Empower (${dur}s)`,
        meta: {
          category: 'buff',
          stack: 'empower',
          script: true,
          handler: 'carrot_goobert',
          temp: true,
          duration: dur,
        },
      });
      // Goobert.doCooldownEffect() calls activate() after its effects.
      pushActivate(piece, ctx, 'carrot_goobert', `Pet: ${piece.name}`);
      piece._carrotActive = false;
    });
  },
};

/** Spirit Bells — buff limit multiply approx as giveAllBuffs. */
/** @type {ScriptHandler} */
export const spiritBellsPort = {
  handlerId: 'spirit_bells',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'spirit_bells', `Accessory: ${piece.name}`);
    const n = Math.max(1, Math.round(getP1(piece.params, 1)));
    grantStacks(player, 'lucky', n, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    grantStacks(player, 'mana', n, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    grantStacks(player, 'regeneration', n, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: n,
      label: `${piece.name}: buff ceiling +${n}`,
      meta: { category: 'buff', script: true, handler: 'spirit_bells' },
    });
    piece.alive = false;
    piece.charges = 0;
    return true;
  },
};

/** @type {ScriptHandler} */
export const paradiseBirbPort = {
  handlerId: 'paradise_birb',
  family: 'pet_like',
  onCombatStart(piece) {
    piece._birbActs = 0;
  },
  onCooldownEffect(piece, ctx) {
    const { t, events, graph, itemsById, canAffect, pieces } = ctx;
    pushActivate(piece, ctx, 'paradise_birb', `Pet: ${piece.name}`);
    const maxActs = Math.max(1, Math.round(getPName(piece.params, 'max', getP2(piece.params, 4))));
    const speedBonus = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
    const acts = Number(piece._birbActs) || 0;
    if (acts < maxActs) {
      const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
      for (const other of pieces || []) {
        if (other.placementKey === piece.placementKey) continue;
        if (!links.some((l) => l.key === other.placementKey)) continue;
        if (!(other.cooldown > 0)) continue;
        addSpeed(other, speedBonus);
      }
      piece._birbActs = acts + 1;
      if (piece._birbActs >= maxActs) {
        piece.alive = false;
        piece.charges = 0;
      }
    }
    events.push({
      t: t + 0.004,
      type: 'info',
      label: `${piece.name}: speed pulse`,
      meta: { category: 'adjacency', script: true, handler: 'paradise_birb' },
    });
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const PET_PORTS = {
  squirrel: squirrelPort,
  turtle: turtlePort,
  rat_chef: ratChefPort,
  blood_goobert: bloodGoobertPort,
  carrot_goobert: carrotGoobertPort,
  spirit_bells: spiritBellsPort,
  paradise_birb: paradiseBirbPort,
};
