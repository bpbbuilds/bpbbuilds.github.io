/**
 * Band Y Phase 137 — heat / cold.
 */

import { tryUseStamina, healActor } from '../actor.js';
import {
  giveRandomBuffs,
  grantStacks,
  grantTemporaryStacks,
  inflictRandomDebuffs,
  cleanseRandomDebuffs,
  spendStacks,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { randInt } from '../rng.js';
import { gainStacks } from '../stacks.js';
import { dealHit } from './handlers.js';
import { afterEffectFinished, pushActivate, pushBuffGrants } from './ports-util.js';
import { eventFoeSide } from '../vs-board.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @type {ScriptHandler} */
export const devouringSpherePort = {
  handlerId: 'devouring_sphere',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._devourCold = Number(ctx.dummy.stacks.cold) || 0;
    piece._devourBlind = Number(ctx.dummy.stacks.blind) || 0;
    pushActivate(piece, ctx, 'devouring_sphere', `Accessory: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events } = ctx;
    pushActivate(piece, ctx, 'devouring_sphere', `Accessory: ${piece.name}`);
    const vamp = Math.max(
      1,
      Math.round(getPName(piece.params, 'vampirism', getP1(piece.params, 1))),
    );
    grantStacks(player, 'vampirism', vamp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const dam = Math.max(1, Math.round(getPName(piece.params, 'dam', getP2(piece.params, 4))));
    const ls = getPName(piece.params, 'lifesteal', 50) / 100;
    dummy.hp = Math.max(0, dummy.hp - dam);
    const healed = healActor(player, Math.round(dam * ls));
    events.push({
      t: t + 0.004,
      type: 'damage',
      target: 'dummy',
      amount: dam,
      label: `${piece.name}: ${dam} lifesteal hit`,
      meta: { category: 'damage', script: true, handler: 'devouring_sphere' },
    });
    if (healed > 0) {
      events.push({
        t: t + 0.006,
        type: 'heal',
        target: 'player',
        amount: healed,
        label: `${piece.name}: +${healed} HP`,
        meta: { category: 'heal', script: true, handler: 'devouring_sphere' },
      });
    }
    const coldNow = Number(dummy.stacks.cold) || 0;
    const blindNow = Number(dummy.stacks.blind) || 0;
    const coldDelta = coldNow - (Number(piece._devourCold) || 0);
    const blindDelta = blindNow - (Number(piece._devourBlind) || 0);
    const coldSpeed = getPName(piece.params, 'speed_cold', 5) / 100;
    const blindSpeed = getPName(piece.params, 'speed_blind', 5) / 100;
    if (coldDelta > 0) addSpeed(piece, coldDelta * coldSpeed);
    if (blindDelta > 0) addSpeed(piece, blindDelta * blindSpeed);
    piece._devourCold = coldNow;
    piece._devourBlind = blindNow;
    return true;
  },
};

/** Snowball.gd — onPrepare maxHP-gain malus on foe; onCombatStart Cold + consume. */
/** @type {ScriptHandler} */
export const snowballPort = {
  handlerId: 'snowball',
  family: 'consumable',
  onCombatStart(piece, ctx) {
    const { t, dummy, events, player, rng } = ctx;
    const redPct = getPName(piece.params, 'healthreduction', getP2(piece.params, 10));
    const malus = -Math.abs(redPct) / 100;
    if (malus) {
      dummy._maxHealthGain = (Number(dummy._maxHealthGain) || 0) + malus;
    }
    const cold = Math.max(1, Math.round(getPName(piece.params, 'cold', getP1(piece.params, 2))));
    gainStacks(dummy, 'cold', cold, { rng, opponent: player });
    piece.alive = false;
    piece.charges = 0;
    events.push({
      t,
      type: 'debuff',
      target: 'dummy',
      amount: cold,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${cold} Cold (consumed)`,
      meta: { category: 'debuff', stack: 'cold', script: true, handler: 'snowball' },
    });
    if (malus) {
      events.push({
        t: t + 0.002,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: foe max-HP gain ${Math.round(malus * 100)}%`,
        meta: { category: 'system', script: true, handler: 'snowball' },
      });
    }
  },
};

/** @type {ScriptHandler} */
export const burningBladePort = {
  handlerId: 'burning_blade',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    if (tryUseStamina(player, piece.staminaCost) === 'starve') {
      events.push({
        t,
        type: 'stamina',
        label: `${piece.name}: out of stamina`,
        meta: { category: 'stamina', script: true, starved: true },
      });
      return true;
    }
    pushActivate(piece, ctx, 'burning_blade', `Weapon: ${piece.name}`);
    const raw = randInt(piece.damageMin, piece.damageMax, rng);
    const hit = dealHit(piece, ctx, raw);
    if (hit.hit) {
      const heat = Math.max(1, Math.round(getPName(piece.params, 'heat', getP1(piece.params, 1))));
      grantStacks(player, 'heat', heat, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t: t + 0.01,
        type: 'buff',
        target: 'player',
        amount: heat,
        label: `${piece.name}: +${heat} Heat`,
        meta: { category: 'buff', stack: 'heat', script: true, handler: 'burning_blade' },
      });
    }
    return true;
  },
};

/** ElectricTorch.gd — CD Blind; charge adds speed to linked cooldown items. */
/** @type {ScriptHandler} */
export const electricTorchPort = {
  handlerId: 'electric_torch',
  family: 'unique',
  onCombatStart(piece) {
    piece._torchCharged = false;
    piece._torchSpeedKeys = [];
  },
  onChargeReceived(piece, ctx) {
    if ((piece.numCharges || 0) !== 1 || piece._torchCharged) return;
    piece._torchCharged = true;
    const speedBonus =
      getPName(piece.params, 'speed', getP1(piece.params, 5)) / 100;
    if (!(speedBonus > 0)) return;
    const { graph, itemsById, canAffect, pieces } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    /** @type {string[]} */
    const keys = [];
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const cat = itemsById.get(other.itemId);
      if (!(Number(cat?.cooldown ?? other.cooldown) > 0)) continue;
      addSpeed(other, speedBonus);
      keys.push(other.placementKey);
    }
    piece._torchSpeedKeys = keys;
    piece._torchSpeedBonus = speedBonus;
  },
  onChargeLeft(piece, ctx) {
    if ((piece.numCharges || 0) > 0) return;
    if (!piece._torchCharged) return;
    piece._torchCharged = false;
    const bonus = Number(piece._torchSpeedBonus) || 0;
    if (!(bonus > 0)) return;
    for (const other of ctx.pieces || []) {
      if (!(piece._torchSpeedKeys || []).includes(other.placementKey)) continue;
      addSpeed(other, -bonus);
    }
    piece._torchSpeedKeys = [];
    piece._torchSpeedBonus = 0;
  },
  onCooldownEffect(piece, ctx) {
    const { t, dummy, player, events, rng } = ctx;
    pushActivate(piece, ctx, 'electric_torch', `Accessory: ${piece.name}`);
    const blind = Math.max(1, Math.round(getPName(piece.params, 'blind', getP1(piece.params, 2))));
    const dur = Math.max(0.5, getPName(piece.params, 'dur_blind', getP2(piece.params, 3)));
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
        handler: 'electric_torch',
        temp: true,
        duration: dur,
      },
    });
    afterEffectFinished(piece, ctx, 'electric_torch', { activate: false });
    return true;
  },
};

/** @type {ScriptHandler} */
export const moltenGreatswordPort = {
  handlerId: 'molten_greatsword',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    if (tryUseStamina(player, piece.staminaCost) === 'starve') {
      events.push({
        t,
        type: 'stamina',
        label: `${piece.name}: out of stamina`,
        meta: { category: 'stamina', script: true, starved: true },
      });
      return true;
    }
    pushActivate(piece, ctx, 'molten_greatsword', `Weapon: ${piece.name}`);
    const raw = randInt(piece.damageMin, piece.damageMax, rng);
    const hit = dealHit(piece, ctx, raw);
    if (hit.hit) {
      const need = Math.max(1, Math.round(getPName(piece.params, 'heat', getP1(piece.params, 3))));
      if ((Number(player.stacks.heat) || 0) >= need) {
        const spent = spendStacks(player, 'heat', need, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        if (spent.spent > 0) {
          const emp = Math.max(1, Math.round(getPName(piece.params, 'empower', getP2(piece.params, 1))));
          grantStacks(player, 'empower', emp, {
            originKey: piece.placementKey,
            originId: piece.itemId,
          });
          events.push({
            t: t + 0.01,
            type: 'buff',
            target: 'player',
            amount: emp,
            label: `${piece.name}: Heat→Empower +${emp}`,
            meta: {
              category: 'buff',
              stack: 'empower',
              script: true,
              handler: 'molten_greatsword',
            },
          });
        }
      }
    }
    return true;
  },
};

/** @type {ScriptHandler} */
export const pocketSandPort = {
  handlerId: 'pocket_sand',
  family: 'consumable',
  onCombatStart(piece, ctx) {
    const { t, dummy, player, events, rng } = ctx;
    // Item.consume → activate() → Activations metric
    pushActivate(piece, ctx, 'pocket_sand', `Accessory: ${piece.name}`);
    const blind = Math.max(1, Math.round(getP1(piece.params, 2)));
    gainStacks(dummy, 'blind', blind, { rng, opponent: player });
    piece.alive = false;
    piece.charges = 0;
    events.push({
      t,
      type: 'debuff',
      target: eventFoeSide(piece),
      amount: blind,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${blind} Blind (consumed)`,
      meta: {
        category: 'debuff',
        stack: 'blind',
        script: true,
        handler: 'pocket_sand',
        consumed: true,
      },
    });
  },
};

/**
 * LumpofCoal.gd (inventory mode) — once after CD (3s):
 * giveRandomBuffs(1) + inflictRandomDebuffs(1) then onAfterEffectFinished() → consume.
 * (Socketed weapon/armor modes use different hooks; not this path.)
 */
/** @type {ScriptHandler} */
export const lumpOfCoalPort = {
  handlerId: 'lump_of_coal',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, rng } = ctx;
    pushActivate(piece, ctx, 'lump_of_coal', `Gem: ${piece.name}`);
    const buffs = giveRandomBuffs(player, 1, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'lump_of_coal', buffs);
    inflictRandomDebuffs(dummy, 1, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      opponent: player,
    });
    events.push({
      t: t + 0.006,
      type: 'info',
      label: `${piece.name}: random debuff (consumed)`,
      meta: { category: 'system', script: true, handler: 'lump_of_coal', consumed: true },
    });
    afterEffectFinished(piece, ctx, 'lump_of_coal', { activate: false });
    return true;
  },
};

/** ChiliPepper.gd — every CD: +getP1 Heat, heal getP2; if Heat ≥ getP3 cleanse 1. */
/** @type {ScriptHandler} */
export const chiliPepperPort = {
  handlerId: 'chili_pepper',
  family: 'custom_cd',
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    pushActivate(piece, ctx, 'chili_pepper', `Food: ${piece.name}`);
    const heat = Math.max(
      1,
      Math.round(getPName(piece.params, 'heat', getP1(piece.params, 1))),
    );
    grantStacks(player, 'heat', heat, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t: t + 0.001,
      type: 'buff',
      target: 'player',
      amount: heat,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: +${heat} Heat`,
      meta: { category: 'buff', stack: 'heat', script: true, handler: 'chili_pepper' },
    });
    const healAmt = Math.max(
      1,
      Math.round(getPName(piece.params, 'heal', getP2(piece.params, 5))),
    );
    const healed = healActor(player, healAmt);
    events.push({
      t: t + 0.002,
      type: 'heal',
      target: 'player',
      amount: healed,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: heal ${healed}`,
      meta: { category: 'heal', script: true, handler: 'chili_pepper' },
    });
    const need = Math.max(
      1,
      Math.round(getPName(piece.params, 'heatt', getP3(piece.params, 10))),
    );
    if ((Number(player.stacks?.heat) || 0) >= need) {
      cleanseRandomDebuffs(player, 1, rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      events.push({
        t: t + 0.003,
        type: 'info',
        label: `${piece.name}: cleanse 1 debuff`,
        meta: { category: 'system', script: true, handler: 'chili_pepper' },
      });
    }
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const HEAT_PORTS = {
  devouring_sphere: devouringSpherePort,
  snowball: snowballPort,
  burning_blade: burningBladePort,
  electric_torch: electricTorchPort,
  molten_greatsword: moltenGreatswordPort,
  pocket_sand: pocketSandPort,
  lump_of_coal: lumpOfCoalPort,
  chili_pepper: chiliPepperPort,
};
