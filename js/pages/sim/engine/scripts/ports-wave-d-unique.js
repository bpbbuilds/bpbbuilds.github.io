/**
 * Band AE Wave D — uniques / pets / potions.
 */

import {
  giveLeastBuffs,
  giveRandomBuffs,
  grantStacks,
  onBuffChanged,
  useMana,
  BUFF_KEYS,
  DEBUFF_KEYS,
} from '../buff-economy.js';
import { grantStun, healActor, tryUseStamina, gainMaxStaminaTemporary, giveStamina } from '../actor.js';
import { applyHealEfficiency } from '../actor-stats.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addAccuracy, addSpeed } from '../piece-stats.js';
import { gainStacks, getStackAmount } from '../stacks.js';
import { grantTimedSpeed } from '../timed-speed.js';
import { dealHit } from './handlers.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { randInt } from '../rng.js';
import { emitChargePulse } from '../charge-delivery.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/**
 * AmuletOfAgility.gd (display: Amulet of Energy) —
 * timed speed to CD items; refund `refund%` of *used* buff spends (fractional accrual).
 */
/** @type {ScriptHandler} */
export const amuletOfAgilityPort = {
  handlerId: 'amulet_of_agility',
  family: 'synergy_aura',
  onCombatStart(piece, ctx) {
    const speed = getPName(piece.params, 'speed', getP1(piece.params, 15)) / 100;
    const dur = Math.max(0, getPName(piece.params, 'dur', 1));
    const refundRate = getPName(piece.params, 'refund', 25) / 100;
    /** @type {Record<string, number>} */
    piece._usedStacks = {};
    for (const k of BUFF_KEYS) piece._usedStacks[k] = 0;

    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    const untilT = ctx.t + dur;
    for (const other of ctx.pieces || []) {
      if (other.placementKey === piece.placementKey) continue;
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (!(other.baseCooldown > 0 || other.cooldown > 0)) continue;
      if (speed) {
        if (dur > 0) grantTimedSpeed(other, speed, untilT, `amulet_energy:${piece.placementKey}`);
        else addSpeed(other, speed);
      }
    }
    // Game: amount < 0 && event.getParam("used") → accumulate used*refund, round-refund.
    onBuffChanged(ctx.player, (ch) => {
      if (piece._amuletRefunding) return;
      if (!(ch.amount < 0) || !ch.used) return;
      if (!BUFF_KEYS.includes(String(ch.stack))) return;
      const buffType = String(ch.stack);
      const used = Math.abs(ch.amount);
      piece._usedStacks[buffType] = (Number(piece._usedStacks[buffType]) || 0) + used * refundRate;
      const toRefund = Math.round(piece._usedStacks[buffType]);
      if (!(toRefund > 0)) return;
      piece._usedStacks[buffType] -= toRefund;
      piece._amuletRefunding = true;
      try {
        grantStacks(ctx.player, buffType, toRefund, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      } finally {
        piece._amuletRefunding = false;
      }
    });
    pushActivate(piece, ctx, 'amulet_of_agility', `Accessory: ${piece.name}`);
    ctx.events.push({
      t: ctx.t,
      type: 'info',
      label: `${piece.name}: +${Math.round(speed * 100)}% speed ${dur}s (CD items), ${Math.round(refundRate * 100)}% used-buff refund`,
      meta: { category: 'adjacency', script: true, handler: 'amulet_of_agility' },
    });
  },
};

/** Bewitchment.gd — mana → least debuffs + type adj bonus. */
/** @type {ScriptHandler} */
export const bewitchmentPort = {
  handlerId: 'bewitchment',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'bewitchment', `Accessory: ${piece.name}`);
    const cost = Math.max(1, Math.round(getPName(piece.params, 'manat', getPName(piece.params, 'mana', 3))));
    if ((ctx.player.stacks.mana || 0) < cost) return true;
    useMana(ctx.player, cost, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    let n = Math.max(1, Math.round(getPName(piece.params, 'debuffs', getP2(piece.params, 1))));
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    for (const other of ctx.pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const it = ctx.itemsById.get(other.itemId);
      if (itemHasType(it, 'nature') || itemHasType(it, 'dark') || itemHasType(it, 'ice')) n += 1;
    }
    // Least: prefer debuffs opponent already has few of
    const sorted = [...DEBUFF_KEYS].sort(
      (a, b) => getStackAmount(ctx.dummy, /** @type {any} */ (a)) - getStackAmount(ctx.dummy, /** @type {any} */ (b)),
    );
    for (let i = 0; i < n; i++) {
      const stack = sorted[i % sorted.length];
      grantStacks(ctx.dummy, stack, 1, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        rng: ctx.rng,
        opponent: ctx.player,
      });
    }
    return true;
  },
};

/** FrozenFlame.gd — ice block; heat→cold; cold→crit on secondary. */
/** @type {ScriptHandler} */
export const frozenFlamePort = {
  handlerId: 'frozen_flame',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    let ice = 0;
    /** @type {object | null} */
    let secondary = null;
    for (const other of ctx.pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (itemHasType(ctx.itemsById.get(other.itemId), 'ice')) ice += 1;
      if (!secondary && (other.damageMax > 0 || other.damageMin > 0)) secondary = other;
    }
    const per = Math.max(1, Math.round(piece.blockGrant || getP1(piece.params, 4)));
    if (ice) gainStacks(ctx.player, 'block', per * ice);
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack === 'heat' && ch.amount > 0) {
        grantStacks(ctx.dummy, 'cold', ch.amount, {
          originKey: piece.placementKey,
          originId: piece.itemId,
          rng: ctx.rng,
          opponent: ctx.player,
        });
      }
      if (ch.stack === 'cold' && ch.amount > 0 && secondary) {
        addAccuracy(secondary, 5 * ch.amount);
        secondary.critChance = (Number(secondary.critChance) || 0) + 5 * ch.amount;
      }
    });
  },
};

/** Gigawatz.gd */
/** @type {ScriptHandler} */
export const gigawatzPort = {
  handlerId: 'gigawatz',
  family: 'pet_like',
  onCombatStart(piece) {
    piece._gigaActs = 0;
    piece._gigaChargeSpeed = 0;
  },
  onChargeReceived(piece) {
    const max = getPName(piece.params, 'max', 0.5);
    const step = getPName(piece.params, 'speed', 5) / 100;
    if ((piece._gigaChargeSpeed || 0) + step <= max + 1e-9) {
      addSpeed(piece, step);
      piece._gigaChargeSpeed = (piece._gigaChargeSpeed || 0) + step;
    }
  },
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'gigawatz', `Pet: ${piece.name}`);
    emitChargePulse(piece, ctx, { label: `${piece.name}: charge` });
    grantStacks(ctx.dummy, 'blind', Math.max(1, Math.round(getP1(piece.params, 1))), {
      originKey: piece.placementKey,
      originId: piece.itemId,
      rng: ctx.rng,
      opponent: ctx.player,
    });
    const base = Math.max(1, Math.round(getPName(piece.params, 'dam', piece.damageMin || 4)));
    dealHit(piece, ctx, base + (piece._gigaActs || 0));
    piece._gigaActs = (piece._gigaActs || 0) + 1;
    return true;
  },
};

/** HogusBogus.gd — 3-phase shallow. */
/** @type {ScriptHandler} */
export const hogusBogusPort = {
  handlerId: 'hogus_bogus',
  family: 'unique',
  onCombatStart(piece) {
    piece._hogusPhase = 0;
  },
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'hogus_bogus', `Accessory: ${piece.name}`);
    const phase = piece._hogusPhase || 0;
    if (phase === 0) {
      const cost = Math.max(1, Math.round(piece.staminaCost || getPName(piece.params, 'stamina', 2)));
      if (tryUseStamina(ctx.player, cost) === 'starve') return true;
      const picked = giveRandomBuffs(ctx.player, Math.max(1, Math.round(getP1(piece.params, 2))), ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, 'hogus_bogus', picked, 0.003);
    } else if (phase === 1) {
      grantStun(ctx.dummy, Math.max(0.5, getPName(piece.params, 'dur_stun', 1.5)), ctx.t);
      grantStun(ctx.player, Math.max(0.5, getPName(piece.params, 'dur_stunself', 0.5)), ctx.t);
    } else {
      const pct = getPName(piece.params, 'heal', getP2(piece.params, 20)) / 100;
      const heal = Math.max(1, Math.round((ctx.dummy.hp || ctx.dummy.maxHp) * pct));
      healActor(ctx.player, heal);
    }
    piece._hogusPhase = (phase + 1) % 3;
    return true;
  },
};

/** HyperHedgehog.gd */
/** @type {ScriptHandler} */
export const hyperHedgehogPort = {
  handlerId: 'hyper_hedgehog',
  family: 'pet_like',
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'hyper_hedgehog', `Pet: ${piece.name}`);
    const rel = ctx.player.maxHp > 0 ? ctx.player.hp / ctx.player.maxHp : 1;
    if (rel < 0.5) {
      grantStacks(ctx.player, 'spikes', Math.max(1, Math.round(getP3(piece.params, 2))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      gainStacks(ctx.player, 'block', Math.max(1, Math.round(getPName(piece.params, 'block', 4))));
      grantStacks(ctx.player, 'empower', 1, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    const spikes = ctx.player.stacks.spikes || 0;
    const emp = ctx.player.stacks.empower || 0;
    const perS = Number(getPName(piece.params, 'dam_spikes', getP1(piece.params, 1))) || 1;
    const perE = Number(getPName(piece.params, 'dam_empower', getP2(piece.params, 1))) || 1;
    const raw =
      randInt(piece.damageMin || 3, piece.damageMax || 6, ctx.rng) +
      Math.round(spikes * perS + emp * perE);
    dealHit(piece, ctx, raw);
    return true;
  },
};

/** InnerPower.gd */
/** @type {ScriptHandler} */
export const innerPowerPort = {
  handlerId: 'inner_power',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    const luck = Math.max(1, Math.round(getPName(piece.params, 'lucky', getP1(piece.params, 2))));
    const emp = Math.max(1, Math.round(getPName(piece.params, 'empower', getP2(piece.params, 1))));
    grantStacks(ctx.player, 'lucky', luck, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    grantStacks(ctx.player, 'empower', emp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    piece._innerHealAmp = 0;
    piece._innerSpeed = 0;
    const maxSpeed = getPName(piece.params, 'maxspeed', 0.5);
    onBuffChanged(ctx.player, (ch) => {
      if (ch.stack === 'lucky' && ch.amount > 0) {
        piece._innerHealAmp = (piece._innerHealAmp || 0) + ch.amount * 0.05;
        applyHealEfficiency(ctx.player, ch.amount * 0.05, ctx, piece);
      }
      if (ch.stack === 'empower' && ch.amount > 0) {
        const step = 0.05 * ch.amount;
        const room = Math.max(0, maxSpeed - (piece._innerSpeed || 0));
        const apply = Math.min(step, room);
        if (apply > 0) {
          const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
          for (const other of ctx.pieces || []) {
            if (!links.some((l) => l.key === other.placementKey)) continue;
            addSpeed(other, apply);
          }
          piece._innerSpeed = (piece._innerSpeed || 0) + apply;
        }
      }
    });
  },
};

/** WandOfDissonance.gd */
/** @type {ScriptHandler} */
export const wandOfDissonancePort = {
  handlerId: 'wand_of_dissonance',
  family: 'pet_like',
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'wand_of_dissonance', `Weapon: ${piece.name}`);
    const hpCost = Math.max(1, Math.round(getP1(piece.params, 5)));
    ctx.player.hp = Math.max(1, ctx.player.hp - hpCost);
    let raw = randInt(piece.damageMin || 6, piece.damageMax || 12, ctx.rng);
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    for (const other of ctx.pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      if (itemHasType(ctx.itemsById.get(other.itemId), 'dark')) raw = Math.round(raw * 1.25);
    }
    dealHit(piece, ctx, raw);
    const subset = ['mana', 'lucky', 'regeneration'];
    const have = subset
      .map((k) => ({ k, n: getStackAmount(ctx.player, /** @type {any} */ (k)) }))
      .sort((a, b) => b.n - a.n);
    if (have[0]) {
      grantStacks(ctx.player, have[0].k, 1, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    return true;
  },
};

/** RainbowPotion.gd */
/** @type {ScriptHandler} */
export const rainbowPotionPort = {
  handlerId: 'rainbow_potion',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    let books = 0;
    let staffs = 0;
    for (const other of ctx.pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const id = String(other.itemId || '');
      if (/book/i.test(id)) books += 1;
      if (/staff/i.test(id)) staffs += 1;
    }
    if (books) {
      const mana = Math.max(1, Math.round(getPName(piece.params, 'mana', getP1(piece.params, 4)))) * books;
      grantStacks(ctx.player, 'mana', mana, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      ctx.player.stamina = Math.min(ctx.player.maxStamina, ctx.player.stamina + books);
    }
    if (staffs) {
      const picked = giveRandomBuffs(ctx.player, Math.max(1, staffs * Math.round(getP2(piece.params, 1))), ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, 'rainbow_potion', picked);
    }
    if (!books && !staffs) {
      grantStacks(ctx.player, 'mana', Math.max(1, Math.round(getP1(piece.params, 4))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    onBuffChanged(ctx.player, (ch) => {
      if (!(ch.amount < 0) || !BUFF_KEYS.includes(String(ch.stack))) return;
      for (const other of ctx.pieces || []) {
        if (!/potion/i.test(String(other.itemId || ''))) continue;
        if (!other.alive) continue;
        const h = ctx.activatePiece ? null : null;
        void h;
        // Soft-trigger: mark spent potions for activatePiece if available
        if (typeof ctx.activatePiece === 'function' && other.cooldown > 0) {
          other.triggerTime = 0;
        }
      }
    });
    piece.alive = false;
    piece.charges = 0;
  },
};

/** PerpetuumMobile.gd */
/** @type {ScriptHandler} */
export const perpetuumMobilePort = {
  handlerId: 'perpetuum_mobile',
  family: 'unique',
  onPreCombatStart(piece, ctx) {
    /** @type {Record<string, number>} */
    piece._usedStacks = {};
    for (const k of BUFF_KEYS) piece._usedStacks[k] = 0;
    piece._staminaUsed = 0;

    const speed = getPName(piece.params, 'speed', getP4(piece.params, 30)) / 100;
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    for (const other of ctx.pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const item = ctx.itemsById.get(other.itemId);
      if (
        itemHasType(item, 'engineering') ||
        /cog|resistor|battery|wrench/i.test(other.itemId)
      ) {
        if (speed) addSpeed(other, speed);
      }
    }

    onBuffChanged(ctx.player, (ch) => {
      if (!(ch.amount < 0) || !ch.used) return;
      if (!BUFF_KEYS.includes(String(ch.stack))) return;
      const buffType = String(ch.stack);
      piece._usedStacks[buffType] =
        (Number(piece._usedStacks[buffType]) || 0) + Math.abs(ch.amount);
    });
    ctx.player._combatBus?.on?.('stamina_used', (payload) => {
      if (payload?.actor !== ctx.player) return;
      piece._staminaUsed =
        (Number(piece._staminaUsed) || 0) + (Number(payload.amount) || 0);
    });
  },
  onCombatStart(piece, ctx) {
    const stam = Number(getPName(piece.params, 'stamina', getP1(piece.params, 2))) || 2;
    gainMaxStaminaTemporary(ctx.player, stam, { filled: false });
    pushActivate(piece, ctx, 'perpetuum_mobile', `Accessory: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    pushActivate(piece, ctx, 'perpetuum_mobile', `Accessory: ${piece.name}`);
    const buffRefund =
      getPName(piece.params, 'refund_buffs', getP2(piece.params, 30)) / 100;
    const stamRefund =
      getPName(piece.params, 'refund_stamina', getP3(piece.params, 30)) / 100;

    for (const buffType of BUFF_KEYS) {
      const used = Number(piece._usedStacks?.[buffType]) || 0;
      const toRefund = Math.round(used * buffRefund);
      if (toRefund <= 0) continue;
      piece._usedStacks[buffType] = used - toRefund;
      grantStacks(ctx.player, buffType, toRefund, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, 'perpetuum_mobile', {
        [buffType]: toRefund,
      });
    }

    const stamGive = Math.round((Number(piece._staminaUsed) || 0) * stamRefund);
    if (stamGive > 0) giveStamina(ctx.player, stamGive);
    piece._staminaUsed = 0;
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const WAVE_D_UNIQUE_PORTS = {
  amulet_of_agility: amuletOfAgilityPort,
  bewitchment: bewitchmentPort,
  frozen_flame: frozenFlamePort,
  gigawatz: gigawatzPort,
  hogus_bogus: hogusBogusPort,
  hyper_hedgehog: hyperHedgehogPort,
  inner_power: innerPowerPort,
  wand_of_dissonance: wandOfDissonancePort,
  rainbow_potion: rainbowPotionPort,
  perpetuum_mobile: perpetuumMobilePort,
};
