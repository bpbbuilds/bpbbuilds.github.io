/**
 * Band Y Phase 141 — pets / unique CD.
 */

import {
  cleanseRandomDebuffs,
  grantStacks,
  grantTemporaryStacks,
  stealRandomBuff,
} from '../buff-economy.js';
import { giveStamina } from '../actor.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { eventSideForPiece } from '../vs-board.js';
import { goobertPeerTick, prepareGoobertActivationTargets } from './ports-wave-d-goobert.js';
import { stealLife } from './handlers.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @type {ScriptHandler} */
export const squirrelPort = {
  handlerId: 'squirrel',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    let affected = 0;
    for (const link of links) {
      const item = ctx.pieces?.find((other) => other.placementKey === link.key);
      const catalog = ctx.itemsById.get(item?.itemId);
      if (itemHasType(catalog, 'pet') || itemHasType(catalog, 'food')) affected += 1;
    }
    const speed = getPName(piece.params, 'petspeed', getP1(piece.params, 0)) / 100;
    if (affected && speed) addSpeed(piece, affected * speed);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, rng } = ctx;
    const stolen = stealRandomBuff(dummy, player, 1, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'squirrel', stolen);
    pushActivate(piece, ctx, 'squirrel', `Pet: ${piece.name}`);
    return true;
  },
};

/** @type {ScriptHandler} */
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
    const stam = getPName(piece.params, 'stamina', getP2(piece.params, 0));
    const emp = getPName(piece.params, 'empower', getP3(piece.params, 0));
    const before = Number(player.stamina) || 0;
    giveStamina(player, stam);
    const gainedStamina = Math.max(0, (Number(player.stamina) || 0) - before);
    if (gainedStamina > 0) {
      events.push({
        t: t + 0.001,
        type: 'stamina',
        target: 'player',
        amount: gainedStamina,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${gainedStamina} stamina`,
        meta: { category: 'stamina', script: true, handler: 'rat_chef' },
      });
    }
    grantStacks(player, 'empower', emp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'rat_chef', emp ? { empower: emp } : {});
    // RatChef.gd activates only after stamina and Empower are applied.
    pushActivate(piece, ctx, 'rat_chef', `Pet: ${piece.name}`);
    return true;
  },
};

/** @type {ScriptHandler} */
export const bloodGoobertPort = {
  handlerId: 'blood_goobert',
  family: 'pet_like',
  onPrepare(piece, ctx) {
    prepareGoobertActivationTargets(piece, ctx);
  },
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
  onCooldownEffect() {
    return false;
  },
  onPeerActivated(piece, activated, ctx) {
    goobertPeerTick(piece, activated, ctx, () => {
      const { player } = ctx;
      const dam =
        Math.max(1, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 4)))) +
        (Number(player.stacks.vampirism) || 0);
      const ls = getPName(piece.params, 'lifesteal', 50) / 100;
      stealLife(piece, ctx, dam, ls);
      pushActivate(piece, ctx, 'blood_goobert', `Pet: ${piece.name}`);
    });
  },
};

/** @type {ScriptHandler} */
export const carrotGoobertPort = {
  handlerId: 'carrot_goobert',
  family: 'pet_like',
  onPrepare(piece, ctx) {
    prepareGoobertActivationTargets(piece, ctx);
    piece._carrotActive = false;
  },
  // Goobert.gd is peer-activation driven; it must not run as a timed CD.
  onCooldownEffect() {
    return false;
  },
  onPeerActivated(piece, activated, ctx) {
    goobertPeerTick(piece, activated, ctx, () => {
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
  rat_chef: ratChefPort,
  blood_goobert: bloodGoobertPort,
  carrot_goobert: carrotGoobertPort,
  spirit_bells: spiritBellsPort,
  paradise_birb: paradiseBirbPort,
};
