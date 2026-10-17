/**
 * Band Y Phases 138 + 140 — accuracy / damage aura CD + star-aura pets.
 */

import {
  giveRandomBuffs,
  grantStacks,
  grantTemporaryStacks,
  onBuffChanged,
  useLucky,
  useRegeneration,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP, getP1, getP2, getP3, getP4, getP5, getP6, getPName } from '../params.js';
import { addBonusDamage, addBonusDamageFactor, addSpeed } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { applyFatigueDamage } from '../fatigue.js';
import { itemHasType, afterEffectFinished, pushActivate, pushBuffGrants } from './ports-util.js';
import { getScriptHandler } from './registry.js';
import { weaponStrike } from './ports-wave-c-util.js';
import { giveTempMaxHp } from './ports-ap-start.js';
import { empowerLinkedWeapons, goobertPeerTick } from './ports-wave-d-goobert.js';
import { canBeEmpoweredPiece } from './food-helpers.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @type {ScriptHandler} */
export const knifeToMeetYouPort = {
  handlerId: 'knife_to_meet_you',
  family: 'synergy_aura',
  onPrepare(piece, ctx) {
    const { pieces, graph, itemsById, canAffect } = ctx;
    const daggerSpeed = getPName(piece.params, 'speed', getP1(piece.params, 0)) / 100;
    const per = getPName(piece.params, 'speed2', getP2(piece.params, 0)) / 100;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const sameSide = (other) => piece.side == null || other.side === piece.side;
    const isDagger = (other) => String(other.name || itemsById.get(other.itemId)?.name || '')
      .toLowerCase()
      .includes('dagger');
    const daggers = (pieces || []).filter(
      (other) => other.placementKey !== piece.placementKey && sameSide(other) && isDagger(other),
    );
    for (const other of daggers) addSpeed(other, daggerSpeed);
    const linkedDaggers = daggers.filter((other) => links.some((link) => link.key === other.placementKey));
    if (per) addSpeed(piece, linkedDaggers.length * per);
  },
  onCooldownEffect(piece, ctx) {
    const { pieces } = ctx;
    const damFactor = getPName(piece.params, 'dam', getP2(piece.params, 0)) / 100;
    for (const other of pieces || []) {
      if (piece.side != null && other.side !== piece.side) continue;
      if (!canBeEmpoweredPiece(other)) continue;
      addBonusDamageFactor(other, damFactor);
    }
    afterEffectFinished(piece, ctx, 'knife_to_meet_you', { activate: false });
    return true;
  },
};

/** Scissorswords — temporary Blind approx on CD. */
/** @type {ScriptHandler} */
export const scissorswordsPort = {
  handlerId: 'scissorswords',
  family: 'unique',
  onPrepare(piece, ctx) {
    piece._lsLit = false;
    piece._lsBlindDmg = 0;
    piece._lsBlindUntil = 0;
    piece._ssRegenNeeded = Math.trunc(getPName(piece.params, 'regent', getP1(piece.params, 0)));
    piece._ssBlind = Math.trunc(getPName(piece.params, 'blind', getP3(piece.params, 0)));
    piece._ssBlindDuration = getPName(piece.params, 'dur_blind', getP4(piece.params, 0));
    piece._ssBlindDamage = getPName(piece.params, 'dam_blind', getP2(piece.params, 0));
    piece._ssBonusDamage = getPName(piece.params, 'dam', getP6(piece.params, 0));
    piece._ssLuckNeeded = Math.trunc(getPName(piece.params, 'luckt', getP5(piece.params, 0)));
    piece._ssLuck = Math.trunc(getPName(piece.params, 'luck', getP(piece.params, 6, 0)));
    piece._ssRegen = Math.trunc(getPName(piece.params, 'regen', getP(piece.params, 7, 0)));

    const applyBlindDamage = (change) => {
      if (change.stack !== 'blind') return;
      addBonusDamage(piece, Number(change.amount) * piece._ssBlindDamage, { removable: false });
    };
    const startBlindingLight = (nowT = Number.isFinite(Number(ctx.player._simT)) ? ctx.player._simT : ctx.t) => {
      const { player, dummy } = ctx;
      if (piece._lsLit || player.stacks.regeneration < piece._ssRegenNeeded) return;
      piece._lsLit = true;
      useRegeneration(player, piece._ssRegenNeeded, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      const duration = piece._ssBlindDuration;
      piece._lsBlindUntil = nowT + duration;
      grantTemporaryStacks(dummy, 'blind', piece._ssBlind, duration, nowT, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      grantTemporaryStacks(player, 'blind', piece._ssBlind, duration, nowT, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      pushActivate(piece, { ...ctx, t: nowT }, 'scissorswords', `Weapon: ${piece.name}`, {
        playCombatAni: false,
        source: 'blinding_light',
      });
    };
    onBuffChanged(ctx.player, (change) => {
      if (change.stack !== 'regeneration' || change.amount < 0) return;
      startBlindingLight();
    });
    onBuffChanged(ctx.dummy, applyBlindDamage);
    piece._ssStartBlindingLight = (nowT) => startBlindingLight(nowT);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'scissorswords');
  },
  onDealtDamage(piece, ctx, hit) {
    if (hit?.hit) {
      if ((Number(ctx.player.stacks.lucky) || 0) >= piece._ssLuckNeeded) {
        useLucky(ctx.player, piece._ssLuckNeeded, { originKey: piece.placementKey, originId: piece.itemId });
        addBonusDamage(piece, piece._ssBonusDamage);
        grantStacks(ctx.player, 'regeneration', piece._ssRegen, { originKey: piece.placementKey, originId: piece.itemId });
      }
    } else {
      grantStacks(ctx.player, 'lucky', piece._ssLuck, { originKey: piece.placementKey, originId: piece.itemId });
    }
  },
  onTick(piece, ctx) {
    if (piece._lsLit && ctx.t + 1e-9 >= piece._lsBlindUntil) {
      piece._lsLit = false;
      piece._ssStartBlindingLight?.(ctx.t);
    }
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

/** CorruptedCrystal.gd — add one to the opponent's fatigue source, apply it now. */
/** @type {ScriptHandler} */
export const corruptedCrystalPort = {
  handlerId: 'corrupted_crystal',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, dummy, events } = ctx;
    dummy.bonusFatigueDamage = (Number(dummy.bonusFatigueDamage) || 0) + 1;
    const counter = Math.max(0, Math.round(Number(ctx.fatigue?.counter) || 0));
    const dam = Math.max(1, counter + dummy.bonusFatigueDamage);
    applyFatigueDamage(dummy, dam);
    events.push({
      t,
      type: 'damage',
      target: 'dummy',
      amount: dam,
      label: `${piece.name}: ${dam} fatigue`,
      meta: { category: 'damage', script: true, handler: 'corrupted_crystal', fatigue: true },
    });
    pushActivate(piece, ctx, 'corrupted_crystal', `Gem: ${piece.name}`);
    return true;
  },
};

/** @type {ScriptHandler} */
export const rainbowGoobertBerserkerPort = {
  handlerId: 'rainbow_goobert_berserker',
  family: 'pet_like',
  onPrepare(piece) {
    piece._goobertActs = 0;
  },
  onCooldownEffect() {
    return false;
  },
  onPeerActivated(listener, _activated, ctx) {
    goobertPeerTick(listener, ctx, () => {
      const { player, dummy, events, rng, t, itemsById } = ctx;
      const block = Number(listener.block ?? itemsById.get(listener.itemId)?.block) || 0;
      if (block > 0) gainStacks(player, 'block', block);

      giveTempMaxHp(
        listener,
        ctx,
        'rainbow_goobert_berserker',
        getPName(listener.params, 'maxhealth', getP2(listener.params, 0)),
      );

      const vamp = getP3(listener.params, 0);
      if (vamp > 0) {
        grantStacks(player, 'vampirism', vamp, {
          originKey: listener.placementKey,
          originId: listener.itemId,
        });
      }

      const buffCount = getP4(listener.params, 0);
      const picked = giveRandomBuffs(player, buffCount, rng, {
        originKey: listener.placementKey,
        originId: listener.itemId,
      });
      pushBuffGrants(events, listener, player, t, 'rainbow_goobert_berserker', picked, 0.004);

      const blind = getPName(listener.params, 'blind', getP6(listener.params, 0));
      if (blind > 0) gainStacks(dummy, 'blind', blind, { rng, opponent: player });

      empowerLinkedWeapons(
        listener,
        ctx,
        'rainbow_goobert_berserker',
        getP5(listener.params, 0),
      );
      pushActivate(listener, ctx, 'rainbow_goobert_berserker', `Pet: ${listener.name}`);
    });
  },
};

/** @type {ScriptHandler} */
export const speakWithAnimalsPort = {
  handlerId: 'speak_with_animals',
  family: 'synergy_aura',
  onCooldownEffect(piece, ctx) {
    const { t, events, graph, itemsById, canAffect, pieces } = ctx;
    const chanceRaw = itemsById.get(piece.itemId)?.chance ?? piece.chance ?? 0;
    const chance = Number(chanceRaw);
    const chancePercent = Number.isFinite(chance) ? chance : 0;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      other.doubleActivationChance =
        (Number(other.doubleActivationChance) || 0) + chancePercent / 100;
    }
    pushActivate(piece, ctx, 'speak_with_animals', `Skill: ${piece.name}`);
    events.push({
      t: t + 0.004,
      type: 'info',
      label: `${piece.name}: +${chancePercent}% double activate`,
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
  // AmuletoftheWild.gd raises both spikes limits in onPrepare, before any
  // cooldown or combat-start damage can consume them.
  onPrepare(piece, ctx) {
    const lim = getPName(piece.params, 'spikedam', 0) / 100;
    if (!lim) return;
    ctx.player.meleeSpikesLimit = (Number(ctx.player.meleeSpikesLimit) || 0) + lim;
    ctx.player.rangedSpikesLimit = (Number(ctx.player.rangedSpikesLimit) || 0) + lim;
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect, pieces } = ctx;
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
      if (!itemHasType(itemsById.get(other.itemId), 'pet')) continue;
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
    afterEffectFinished(piece, ctx, 'amulet_of_the_wild', {
      label: `Accessory: ${piece.name}`,
    });
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
