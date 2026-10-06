/**
 * Band Y Phases 138 + 140 — accuracy / damage aura CD + star-aura pets.
 */

import {
  giveRandomBuffs,
  grantStacks,
  grantTemporaryStacks,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addBonusDamage, addSpeed } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { itemHasType, afterEffectFinished, pushActivate, pushBuffGrants } from './ports-util.js';
import { getScriptHandler } from './registry.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @type {ScriptHandler} */
export const knifeToMeetYouPort = {
  handlerId: 'knife_to_meet_you',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const { t, events, pieces, graph, itemsById, canAffect } = ctx;
    const daggerSpeed = getPName(piece.params, 'speed', getP1(piece.params, 10)) / 100;
    const per = getPName(piece.params, 'speed2', getP2(piece.params, 5)) / 100;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let n = 0;
    for (const other of pieces || []) {
      if (other.placementKey === piece.placementKey) continue;
      const item = itemsById.get(other.itemId);
      const isDagger =
        itemHasType(item, 'dagger') ||
        String(other.name || '')
          .toLowerCase()
          .includes('dagger');
      if (isDagger && daggerSpeed) {
        addSpeed(other, daggerSpeed);
        n += 1;
      }
    }
    if (links.length && per) addSpeed(piece, links.length * per);
    events.push({
      t,
      type: 'info',
      label: `${piece.name}: dagger haste (${n})`,
      meta: { category: 'adjacency', script: true, handler: 'knife_to_meet_you' },
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, events, pieces } = ctx;
    pushActivate(piece, ctx, 'knife_to_meet_you', `Weapon: ${piece.name}`);
    const dam = Math.max(1, Math.round(getPName(piece.params, 'dam', getP3(piece.params, 1))));
    for (const other of pieces || []) {
      if (other.empowerable === false) continue;
      if (!(other.damageMax > 0 || other.damageMin > 0 || other.kind === 'weapon')) continue;
      addBonusDamage(other, dam);
    }
    events.push({
      t: t + 0.004,
      type: 'info',
      label: `${piece.name}: +${dam} dmg board`,
      meta: { category: 'adjacency', script: true, handler: 'knife_to_meet_you' },
    });
    afterEffectFinished(piece, ctx, 'knife_to_meet_you', { activate: false });
    return true;
  },
};

/** Scissorswords — temporary Blind approx on CD. */
/** @type {ScriptHandler} */
export const scissorswordsPort = {
  handlerId: 'scissorswords',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, dummy, player, events, rng } = ctx;
    pushActivate(piece, ctx, 'scissorswords', `Weapon: ${piece.name}`);
    const blind = Math.max(1, Math.round(getP1(piece.params, 2)));
    const dur = Math.max(0.5, getPName(piece.params, 'dur', getP2(piece.params, 2)));
    grantTemporaryStacks(dummy, 'blind', blind, dur, t, {
      rng,
      opponent: player,
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t: t + 0.004,
      type: 'debuff',
      target: 'dummy',
      amount: blind,
      label: `${piece.name}: +${blind} Blind (${dur}s)`,
      meta: {
        category: 'debuff',
        stack: 'blind',
        script: true,
        handler: 'scissorswords',
        temp: true,
        duration: dur,
      },
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const steelGoobertPort = {
  handlerId: 'steel_goobert',
  family: 'pet_like',
  onPrepare(piece, ctx) {
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    piece._steelGoobertWeapons = new Set(
      links.filter((link) => link.color === 'secondary').map((link) => link.key),
    );
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect, pieces } = ctx;
    pushActivate(piece, ctx, 'steel_goobert', `Pet: ${piece.name}`);
    const dam = Math.max(1, Math.round(getP2(piece.params, 2)));
    for (const other of pieces || []) {
      if (!piece._steelGoobertWeapons?.has(other.placementKey)) continue;
      if (!(other.damageMax > 0 || other.kind === 'weapon')) continue;
      addBonusDamage(other, dam);
    }
    const block = Math.max(1, Math.round(piece.blockGrant || getP1(piece.params, 6)));
    gainStacks(player, 'block', block);
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'steel_goobert' },
    });
    return true;
  },
};

/** Corrupted Crystal — fatigue approx as direct damage. */
/** @type {ScriptHandler} */
export const corruptedCrystalPort = {
  handlerId: 'corrupted_crystal',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, dummy, events } = ctx;
    pushActivate(piece, ctx, 'corrupted_crystal', `Gem: ${piece.name}`);
    const dam = Math.max(1, Math.round(getP1(piece.params, 3)));
    dummy.hp = Math.max(0, dummy.hp - dam);
    events.push({
      t: t + 0.004,
      type: 'damage',
      target: 'dummy',
      amount: dam,
      label: `${piece.name}: ${dam} fatigue`,
      meta: { category: 'damage', script: true, handler: 'corrupted_crystal' },
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const rainbowGoobertBerserkerPort = {
  handlerId: 'rainbow_goobert_berserker',
  family: 'pet_like',
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, rng, graph, itemsById, canAffect, pieces } = ctx;
    pushActivate(piece, ctx, 'rainbow_goobert_berserker', `Pet: ${piece.name}`);
    const block = Math.max(1, Math.round(piece.blockGrant || getP1(piece.params, 8)));
    gainStacks(player, 'block', block);
    const hp = Math.max(1, Math.round(getP2(piece.params, 10)));
    player.maxHp += hp;
    player.hp = Math.min(player.maxHp, player.hp + hp);
    const vamp = Math.max(1, Math.round(getP3(piece.params, 1)));
    grantStacks(player, 'vampirism', vamp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const num = Math.max(1, Math.round(getPName(piece.params, 'buffs', 2)));
    const picked = giveRandomBuffs(player, num, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'rainbow_goobert_berserker', picked, 0.004);
    const blind = Math.max(1, Math.round(getPName(piece.params, 'blind', 1)));
    gainStacks(dummy, 'blind', blind, { rng, opponent: player });
    const dam = Math.max(1, Math.round(getPName(piece.params, 'dam', 2)));
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (other.empowerable === false) continue;
      if (!(other.damageMax > 0)) continue;
      addBonusDamage(other, dam);
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const speakWithAnimalsPort = {
  handlerId: 'speak_with_animals',
  family: 'synergy_aura',
  onCooldownEffect(piece, ctx) {
    const { t, events, graph, itemsById, canAffect, pieces } = ctx;
    pushActivate(piece, ctx, 'speak_with_animals', `Skill: ${piece.name}`);
    const chance = Number(itemsById.get(piece.itemId)?.chance) || 25;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      other.doubleAttackEffectChance =
        (Number(other.doubleAttackEffectChance) || 0) + chance / 100;
    }
    events.push({
      t: t + 0.004,
      type: 'info',
      label: `${piece.name}: +${chance}% double activate`,
      meta: { category: 'adjacency', script: true, handler: 'speak_with_animals' },
    });
    return true;
  },
};

/** @type {ScriptHandler} */
export const wolfEmblemPort = {
  handlerId: 'wolf_emblem',
  family: 'unique',
  onPreCombatStart(piece, ctx) {
    const item = ctx.itemsById.get(piece.itemId);
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    const pets = links.filter((l) => l.color === 'secondary').length;
    const bonus =
      (Number(item?.chance ?? piece.chance) || 0) +
      pets * (Number(item?.chance2) || 0);
    if (!bonus) return;
    for (const other of ctx.pieces || []) {
      if (!links.some((l) => l.key === other.placementKey && l.color === 'primary')) continue;
      other.critChance = (Number(other.critChance) || 0) + bonus;
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'wolf_emblem', `Accessory: ${piece.name}`);
    const th = Math.max(1, Math.round(getPName(piece.params, 'blockt', getP1(piece.params, 10))));
    const emp = Math.max(1, Math.round(getPName(piece.params, 'empower', getP2(piece.params, 1))));
    if ((Number(player.stacks.block) || 0) >= th) {
      grantStacks(player, 'empower', emp, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t: t + 0.004,
        type: 'buff',
        target: 'player',
        amount: emp,
        label: `${piece.name}: +${emp} Empower`,
        meta: { category: 'buff', stack: 'empower', script: true, handler: 'wolf_emblem' },
      });
    } else {
      const block = Math.max(1, Math.round(piece.blockGrant || getP3(piece.params, 6)));
      gainStacks(player, 'block', block);
      events.push({
        t: t + 0.004,
        type: 'buff',
        target: 'player',
        amount: block,
        label: `${piece.name}: +${block} Block`,
        meta: { category: 'buff', stack: 'block', script: true, handler: 'wolf_emblem' },
      });
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const amuletOfTheWildPort = {
  handlerId: 'amulet_of_the_wild',
  family: 'unique',
  onPreCombatStart(piece, ctx) {
    const lim = getPName(piece.params, 'spikedam', 0) / 100;
    if (!lim) return;
    ctx.player.meleeSpikesLimit = Math.max(Number(ctx.player.meleeSpikesLimit) || 0, lim);
    ctx.player.rangedSpikesLimit = Math.max(Number(ctx.player.rangedSpikesLimit) || 0, lim);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect, pieces } = ctx;
    pushActivate(piece, ctx, 'amulet_of_the_wild', `Accessory: ${piece.name}`);
    const spikes = Math.max(1, Math.round(getPName(piece.params, 'spikes', getP1(piece.params, 1))));
    grantStacks(player, 'spikes', spikes, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t: t + 0.002,
      type: 'buff',
      target: 'player',
      amount: spikes,
      label: `${piece.name}: +${spikes} Spikes`,
      meta: { category: 'buff', stack: 'spikes', script: true, handler: 'amulet_of_the_wild' },
    });
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (other.itemId === 'amulet_of_the_wild') continue;
      if (other._wildTriggered) continue;
      const h = getScriptHandler(other.itemId);
      if (!h?.onCooldownEffect) continue;
      other._wildTriggered = true;
      try {
        h.onCooldownEffect(other, ctx);
      } finally {
        other._wildTriggered = false;
      }
    }
    piece.alive = false;
    piece.charges = 0;
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AURA_PORTS = {
  knife_to_meet_you: knifeToMeetYouPort,
  scissorswords: scissorswordsPort,
  steel_goobert: steelGoobertPort,
  corrupted_crystal: corruptedCrystalPort,
  rainbow_goobert_berserker: rainbowGoobertBerserkerPort,
  speak_with_animals: speakWithAnimalsPort,
  wolf_emblem: wolfEmblemPort,
  amulet_of_the_wild: amuletOfTheWildPort,
};
