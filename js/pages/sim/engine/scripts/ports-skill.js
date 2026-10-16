/**
 * Band Y Phase 142 — skills / class uniques.
 */

import { healActor } from '../actor.js';
import {
  grantStacks,
  inflictRandomDebuffs,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { changeReflectStacks } from '../actor-stats.js';
import { gainStacks } from '../stacks.js';
import { advanceCooldownPercent } from '../cooldown.js';
import { stealLife } from './handlers.js';
import { itemHasType, afterEffectFinished, pushActivate } from './ports-util.js';
import { getScriptHandler } from './registry.js';
import { weaponStrike } from './ports-wave-c-util.js';
import { eventSideForPiece } from '../vs-board.js';

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
    const debuffs = Math.trunc(getPName(piece.params, 'debuffs', getP2(piece.params, 2)));
    inflictRandomDebuffs(dummy, debuffs, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      opponent: player,
    });
    const vamp = Math.trunc(getPName(piece.params, 'vampirism', getP3(piece.params, 2)));
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
  onPrepare(piece, ctx) {
    piece._scrollActs = 0;
    const { graph, itemsById, canAffect } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const darkSpeed = getPName(piece.params, 'speed_dark', getP2(piece.params, 10)) / 100;
    const secondary = links.filter((link) => link.color === 'secondary').length;
    if (secondary && darkSpeed) addSpeed(piece, secondary * darkSpeed);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect, pieces } = ctx;
    const maxActs = Math.trunc(getPName(piece.params, 'max', getP3(piece.params, 5)));
    const speedBonus = getPName(piece.params, 'speed', getP2(piece.params, 10)) / 100;
    piece._scrollActs = (Number(piece._scrollActs) || 0) + 1;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
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
    if (piece._scrollActs === maxActs) {
      afterEffectFinished(piece, ctx, 'spell_scroll_dark', { label: `Spell: ${piece.name}` });
    } else {
      pushActivate(piece, ctx, 'spell_scroll_dark', `Spell: ${piece.name}`);
    }
    return true;
  },
};

/** Dragon Knight — peer activate haste (approx CD empower). */
/** @type {ScriptHandler} */
export const dragonKnightPort = {
  handlerId: 'dragon_knight',
  family: 'unique',
  onPrepare(piece, ctx) {
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    piece._dragonKnightKeys = new Set(
      (ctx.pieces || [])
        .filter((other) =>
          other.placementKey !== piece.placementKey &&
          links.some((link) => link.key === other.placementKey) &&
          (ctx.itemsById.get(other.itemId)?.canActivate !== false &&
            other.canActivate !== false),
        )
        .map((other) => other.placementKey),
    );
  },
  onPreCombatStart(piece, ctx) {
    changeReflectStacks(
      ctx.player,
      Math.max(0, Math.round(getPName(piece.params, 'reflect', getP2(piece.params, 4)))),
      ctx,
      piece,
    );
  },
  onCombatStart(piece, ctx) {
    grantStacks(ctx.player, 'heat', Math.max(0, Math.round(getPName(piece.params, 'heat', getP1(piece.params, 5)))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushActivate(piece, ctx, 'dragon_knight', `Weapon: ${piece.name}`);
  },
  onPeerActivated(listener, activated, ctx) {
    if (!(listener._dragonKnightKeys instanceof Set)) return;
    if (!listener._dragonKnightKeys.has(activated?.placementKey)) {
      return;
    }
    advanceCooldownPercent(
      listener,
      getPName(listener.params, 'advance', getP4(listener.params, 15)),
      ctx,
    );
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'dragon_knight');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const heal = Math.max(0, Math.round(getPName(piece.params, 'heal', getP3(piece.params, 7))));
    if (!heal) return;
    const got = healActor(ctx.player, heal);
    if (got <= 0) return;
    const side = eventSideForPiece(piece);
    ctx.events.push({
      t: ctx.t + 0.002,
      type: 'heal',
      actor: side,
      target: side,
      amount: got,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${got} HP`,
      meta: { category: 'heal', script: true, handler: 'dragon_knight' },
    });
  },
};

/** EchoingBattlecry.gd — prepare: haste × start-of-battle links; CD replays starts. */
/** @type {ScriptHandler} */
export const echoingBattlecryPort = {
  handlerId: 'echoing_battlecry',
  family: 'unique',
  onPrepare(piece, ctx) {
    const { graph, itemsById, canAffect, rng } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    /** @type {string[]} */
    const keys = links.map((l) => l.key);
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor((typeof rng === 'function' ? rng() : Math.random()) * (i + 1));
      const tmp = keys[i];
      keys[i] = keys[j];
      keys[j] = tmp;
    }
    piece._echoQueue = keys;
    const speed = getPName(piece.params, 'speed', getP1(piece.params, 65)) / 100;
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
        h?.onPreCombatStart?.(other, ctx);
        if (h?.onCombatStart) h.onCombatStart(other, ctx);
        h?.onPostCombatStart?.(other, ctx);
        events.push({
          t: t + 0.004,
          type: 'info',
          label: `${piece.name}: replay start → ${other.name}`,
          meta: { category: 'system', script: true, handler: 'echoing_battlecry' },
        });
      }
    }
    if (!q.length) {
      afterEffectFinished(piece, ctx, 'echoing_battlecry', { activate: false });
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const cthulhuPort = {
  handlerId: 'cthulhu',
  family: 'pet_like',
  onPrepare(piece, ctx) {
    const { graph, itemsById, canAffect, pieces } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const speed = getPName(piece.params, 'speed', getP1(piece.params, 5)) / 100;
    if (links.length && speed) addSpeed(piece, links.length * speed);
    piece._cthulhuFoods = [];
    for (const food of pieces || []) {
      if (!links.some((link) => link.key === food.placementKey)) continue;
      if (!itemHasType(itemsById.get(food.itemId), 'food')) continue;
      piece._cthulhuFoods.push(food.placementKey);
      markCthulhuFoodDark(food);
    }
  },
  onAffectedItemAdded(_piece, ctx, item) {
    const catalog = ctx.itemsById?.get?.(item?.itemId ?? item?.id) || item;
    if (itemHasType(catalog, 'food')) markCthulhuFoodDark(item);
  },
  onAffectedItemRemoved(_piece, ctx, item) {
    const catalog = ctx.itemsById?.get?.(item?.itemId ?? item?.id) || item;
    if (!itemHasType(catalog, 'food') || !item || !Array.isArray(item._dynamicTypes)) return;
    item._dynamicTypes = item._dynamicTypes.filter(
      (type) => String(type).toLowerCase() !== 'dark',
    );
  },
  onCooldownEffect(piece, ctx) {
    const { rng, pieces } = ctx;
    const dam = Math.max(1, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 6))));
    const ls = getPName(piece.params, 'lifesteal', 40) / 100;
    stealLife(piece, ctx, dam, ls);
    pushActivate(piece, ctx, 'cthulhu', `Pet: ${piece.name}`);
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

/** @param {object | null | undefined} item */
function markCthulhuFoodDark(item) {
  if (!item) return;
  const dynamicTypes = Array.isArray(item._dynamicTypes) ? item._dynamicTypes : [];
  if (!dynamicTypes.some((type) => String(type).toLowerCase() === 'dark')) {
    dynamicTypes.push('dark');
  }
  item._dynamicTypes = dynamicTypes;
}

/** @type {ScriptHandler} */
export const digDeeperPort = {
  handlerId: 'dig_deeper',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, dummy, player, events, rng } = ctx;
    const blind = Math.round(getPName(piece.params, 'blind', getP1(piece.params, 2)));
    if (blind) gainStacks(dummy, 'blind', blind, { rng, opponent: player });
    if (!blind) return;
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
