/**
 * Band Y Phase 142 — skills / class uniques.
 */

import { healActor } from '../actor.js';
import {
  grantStacks,
  inflictRandomDebuffs,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { itemHasType, afterEffectFinished, pushActivate } from './ports-util.js';
import { getScriptHandler } from './registry.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @type {ScriptHandler} */
export const darkRitualPort = {
  handlerId: 'dark_ritual',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { graph, itemsById, canAffect } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const speed = getPName(piece.params, 'speed', getP1(piece.params, 5)) / 100;
    if (links.length && speed) addSpeed(piece, links.length * speed);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, rng } = ctx;
    pushActivate(piece, ctx, 'dark_ritual', `Skill: ${piece.name}`);
    const debuffs = Math.max(1, Math.round(getPName(piece.params, 'debuffs', getP2(piece.params, 2))));
    inflictRandomDebuffs(dummy, debuffs, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      opponent: player,
    });
    const vamp = Math.max(1, Math.round(getPName(piece.params, 'vamp', getP3(piece.params, 2))));
    grantStacks(player, 'vampirism', vamp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: vamp,
      label: `${piece.name}: +${vamp} Vampirism`,
      meta: { category: 'buff', stack: 'vampirism', script: true, handler: 'dark_ritual' },
    });
    afterEffectFinished(piece, ctx, 'dark_ritual', { activate: false });
    return true;
  },
};

/** @type {ScriptHandler} */
export const spellScrollDarkPort = {
  handlerId: 'spell_scroll_dark',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._scrollActs = 0;
    const { graph, itemsById, canAffect } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const speed = getPName(piece.params, 'darkspeed', getP1(piece.params, 5)) / 100;
    if (links.length && speed) addSpeed(piece, links.length * speed);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect, pieces } = ctx;
    pushActivate(piece, ctx, 'spell_scroll_dark', `Spell: ${piece.name}`);
    const maxActs = Math.max(1, Math.round(getPName(piece.params, 'max', getP3(piece.params, 5))));
    const speedBonus = getPName(piece.params, 'speed', getP2(piece.params, 10)) / 100;
    piece._scrollActs = (Number(piece._scrollActs) || 0) + 1;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (!(other.cooldown > 0)) continue;
      addSpeed(other, speedBonus);
    }
    gainStacks(player, 'blind', 1);
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: 1,
      label: `${piece.name}: +1 Blind (self)`,
      meta: { category: 'buff', stack: 'blind', script: true, handler: 'spell_scroll_dark' },
    });
    if ((Number(piece._scrollActs) || 0) >= maxActs) {
      piece.alive = false;
      piece.charges = 0;
    }
    return true;
  },
};

/** Dragon Knight — peer activate haste (approx CD empower). */
/** @type {ScriptHandler} */
export const dragonKnightPort = {
  handlerId: 'dragon_knight',
  family: 'unique',
  onPeerActivated(listener, activated, ctx) {
    const { t, events } = ctx;
    addSpeed(activated, getP1(listener.params, 5) / 100);
    events.push({
      t,
      type: 'info',
      itemId: listener.itemId,
      placementKey: listener.placementKey,
      label: `${listener.name}: haste → ${activated.name}`,
      meta: { category: 'adjacency', script: true, handler: 'dragon_knight' },
    });
  },
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'dragon_knight', `Skill: ${piece.name}`);
    return true;
  },
};

/** @type {ScriptHandler} */
export const echoingBattlecryPort = {
  handlerId: 'echoing_battlecry',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { graph, itemsById, canAffect, pieces, rng } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    /** @type {string[]} */
    const keys = links.map((l) => l.key);
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = keys[i];
      keys[i] = keys[j];
      keys[j] = tmp;
    }
    piece._echoQueue = keys;
    const speed = getPName(piece.params, 'speed', getP1(piece.params, 5)) / 100;
    if (keys.length && speed) addSpeed(piece, keys.length * speed);
  },
  onCooldownEffect(piece, ctx) {
    const { t, events, pieces } = ctx;
    pushActivate(piece, ctx, 'echoing_battlecry', `Skill: ${piece.name}`);
    /** @type {string[]} */
    const q = piece._echoQueue || [];
    const key = q.pop();
    piece._echoQueue = q;
    if (key) {
      const other = (pieces || []).find((p) => p.placementKey === key);
      if (other) {
        const h = getScriptHandler(other.itemId);
        if (h?.onCombatStart) h.onCombatStart(other, ctx);
        events.push({
          t: t + 0.004,
          type: 'info',
          label: `${piece.name}: replay start → ${other.name}`,
          meta: { category: 'system', script: true, handler: 'echoing_battlecry' },
        });
      }
    }
    if (!q.length) {
      piece.alive = false;
      piece.charges = 0;
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const cthulhuPort = {
  handlerId: 'cthulhu',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const { graph, itemsById, canAffect, pieces } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const speed = getPName(piece.params, 'speed', getP1(piece.params, 5)) / 100;
    if (links.length && speed) addSpeed(piece, links.length * speed);
    piece._cthulhuFoods = (pieces || [])
      .filter(
        (p) =>
          links.some((l) => l.key === p.placementKey) &&
          itemHasType(itemsById.get(p.itemId), 'food'),
      )
      .map((p) => p.placementKey);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, rng, pieces } = ctx;
    pushActivate(piece, ctx, 'cthulhu', `Pet: ${piece.name}`);
    const dam = Math.max(1, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 6))));
    const ls = getPName(piece.params, 'lifesteal', 40) / 100;
    dummy.hp = Math.max(0, dummy.hp - dam);
    const healed = healActor(player, Math.round(dam * ls));
    events.push({
      t: t + 0.004,
      type: 'damage',
      target: 'dummy',
      amount: dam,
      label: `${piece.name}: ${dam} lifesteal`,
      meta: { category: 'damage', script: true, handler: 'cthulhu' },
    });
    if (healed > 0) {
      events.push({
        t: t + 0.006,
        type: 'heal',
        target: 'player',
        amount: healed,
        label: `${piece.name}: +${healed} HP`,
        meta: { category: 'heal', script: true, handler: 'cthulhu' },
      });
    }
    const foods = piece._cthulhuFoods || [];
    if (foods.length) {
      const key = foods[Math.floor(rng() * foods.length)];
      const food = (pieces || []).find((p) => p.placementKey === key);
      if (food) {
        const h = getScriptHandler(food.itemId);
        if (h?.onCooldownEffect) h.onCooldownEffect(food, ctx);
      }
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const digDeeperPort = {
  handlerId: 'dig_deeper',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, dummy, player, events, rng } = ctx;
    const blind = Math.max(1, Math.round(getPName(piece.params, 'blind', getP1(piece.params, 2))));
    gainStacks(dummy, 'blind', blind, { rng, opponent: player });
    events.push({
      t,
      type: 'debuff',
      target: 'dummy',
      amount: blind,
      label: `${piece.name}: +${blind} Blind`,
      meta: { category: 'debuff', stack: 'blind', script: true, handler: 'dig_deeper' },
    });
  },
};

/** @type {Record<string, ScriptHandler>} */
export const SKILL_PORTS = {
  dark_ritual: darkRitualPort,
  spell_scroll_dark: spellScrollDarkPort,
  dragon_knight: dragonKnightPort,
  echoing_battlecry: echoingBattlecryPort,
  cthulhu: cthulhuPort,
  dig_deeper: digDeeperPort,
};
