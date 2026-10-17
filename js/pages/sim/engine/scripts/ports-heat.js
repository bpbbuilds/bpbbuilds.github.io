/**
 * Band Y Phase 137 — heat / cold.
 */

import { tryUseStamina } from '../actor.js';
import {
  giveRandomBuffs,
  grantStacks,
  grantTemporaryStacks,
  inflictRandomDebuffs,
  cleanseRandomDebuffs,
  onBuffChanged,
  spendStacks,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getP5, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { randInt } from '../rng.js';
import { gainStacks } from '../stacks.js';
import { dealHit, stealLife } from './handlers.js';
import { weaponStrike } from './ports-wave-c-util.js';
import { afterEffectFinished, pushActivate, pushBuffGrants } from './ports-util.js';
import { eventFoeSide } from '../vs-board.js';
import { burningSwordPort } from './ports-ap-onhit.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @type {ScriptHandler} */
export const devouringSpherePort = {
  handlerId: 'devouring_sphere',
  family: 'unique',
  onPrepare(piece, ctx) {
    const coldSpeed = Number(getPName(piece.params, 'speed_cold', getP3(piece.params, 5))) / 100;
    const blindSpeed = Number(getPName(piece.params, 'speed_blind', getP4(piece.params, 5))) / 100;
    onBuffChanged(ctx.dummy, (change) => {
      if (change.stack === 'cold' && coldSpeed) addSpeed(piece, change.amount * coldSpeed);
      if (change.stack === 'blind' && blindSpeed) addSpeed(piece, change.amount * blindSpeed);
    });
  },
  onCooldownEffect(piece, ctx) {
    const vamp = Number(getPName(piece.params, 'vampirism', getP1(piece.params, 1))) || 0;
    if (vamp) {
      grantStacks(ctx.player, 'vampirism', vamp, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    const dam = Number(getPName(piece.params, 'dam', getP5(piece.params, 10))) || 0;
    const ls = (Number(getPName(piece.params, 'lifesteal', getP2(piece.params, 100))) || 0) / 100;
    stealLife(piece, ctx, dam, ls);
    pushActivate(piece, ctx, 'devouring_sphere', `Accessory: ${piece.name}`);
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
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    burningSwordPort.onPrepare(piece, ctx);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'burning_blade');
  },
  onPreDealDamageEarly(piece, ctx, res) {
    burningSwordPort.onPreDealDamageEarly(piece, ctx, res);
  },
};

/** ElectricTorch.gd — CD Blind; charge adds speed to linked cooldown items. */
/** @type {ScriptHandler} */
export const electricTorchPort = {
  handlerId: 'electric_torch',
  family: 'unique',
  onPrepare(piece) {
    piece._torchCharged = false;
    piece._torchSpeedKeys = [];
    piece._torchSpeedBonus = 0;
  },
  onChargeReceived(piece, ctx) {
    if ((piece.numCharges || 0) !== 1 || piece._torchCharged) return;
    piece._torchCharged = true;
    const speedBonus =
      getPName(piece.params, 'speed', getP1(piece.params, 5)) / 100;
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
    const blind = Math.trunc(getPName(piece.params, 'blind', getP1(piece.params, 2)));
    const dur = getPName(piece.params, 'dur_blind', getP2(piece.params, 3));
    const granted = grantTemporaryStacks(dummy, 'blind', blind, dur, t, {
      rng,
      opponent: player,
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (granted.gained > 0) {
      events.push({
        t: t + 0.004,
        type: 'debuff',
        target: 'dummy',
        amount: granted.gained,
        label: `${piece.name}: +${granted.gained} Blind (${dur}s)`,
        meta: {
          category: 'debuff',
          stack: 'blind',
          script: true,
          handler: 'electric_torch',
          temp: true,
          duration: dur,
        },
      });
    }
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
    const blind = getP1(piece.params, 2);
    gainStacks(dummy, 'blind', blind, { rng, opponent: player });
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
    afterEffectFinished(piece, ctx, 'pocket_sand', {
      consume: true,
      label: `Accessory: ${piece.name}`,
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
    afterEffectFinished(piece, ctx, 'lump_of_coal', { label: `Gem: ${piece.name}` });
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
};
