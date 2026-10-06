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
import { applyEffectDmgFactor, applyHealEfficiency } from '../actor-stats.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getP5, getPName } from '../params.js';
import { addAccuracy, addSpeed } from '../piece-stats.js';
import { gainStacks, getStackAmount } from '../stacks.js';
import { grantTimedSpeed } from '../timed-speed.js';
import { dealEffectDamage, dealHit, loseHealth } from './handlers.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { randInt } from '../rng.js';
import { rollItemChance } from '../chance.js';
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
  onPreCombatStart(piece, ctx) {
    const refundRate = getPName(piece.params, 'refund', getP3(piece.params, 25)) / 100;
    /** @type {Record<string, number>} */
    piece._usedStacks = {};
    for (const k of BUFF_KEYS) piece._usedStacks[k] = 0;
    piece._amuletRefundRate = refundRate;
    // Game onPrepare: connectToCharacterBuffs before combat-start spends.
    onBuffChanged(ctx.player, (ch) => {
      if (piece._amuletRefunding) return;
      if (!(ch.amount < 0) || !ch.used) return;
      if (!BUFF_KEYS.includes(String(ch.stack))) return;
      const buffType = String(ch.stack);
      const used = Math.abs(ch.amount);
      const rate = Number(piece._amuletRefundRate) || 0;
      piece._usedStacks[buffType] = (Number(piece._usedStacks[buffType]) || 0) + used * rate;
      const toRefund = Math.round(piece._usedStacks[buffType]);
      if (!(toRefund > 0)) return;
      piece._usedStacks[buffType] -= toRefund;
      piece._amuletRefunding = true;
      try {
        // Game giveStacks(..., self, event) — refund gains are *this amulet's*
        // (ItemMetrics / Combat Log origin), not the item that spent the buff.
        grantStacks(ctx.player, buffType, toRefund, {
          piece,
          originKey: piece.placementKey,
          originId: piece.itemId,
          t: ctx.t,
          silentLog: true,
        });
        pushBuffGrants(ctx.events, piece, ctx.player, ctx.t, 'amulet_of_agility', {
          [buffType]: toRefund,
        });
      } finally {
        piece._amuletRefunding = false;
      }
    });
  },
  onCombatStart(piece, ctx) {
    const speed = getPName(piece.params, 'speed', getP1(piece.params, 100)) / 100;
    const dur = Math.max(0, getPName(piece.params, 'dur', getP2(piece.params, 1)));
    const refundRate = Number(piece._amuletRefundRate) || getPName(piece.params, 'refund', 25) / 100;

    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    const untilT = ctx.t + dur;
    let n = 0;
    for (const other of ctx.pieces || []) {
      if (other.placementKey === piece.placementKey) continue;
      if (!links.some((l) => l.key === other.placementKey)) continue;
      // Item.hasCooldown() — exclude locked / listen-only CDs (999).
      const cd = Number(other.cooldown) || 0;
      if (!(cd > 0 && cd < 500)) continue;
      if (speed) {
        if (dur > 0) grantTimedSpeed(other, speed, untilT, `amulet_energy:${piece.placementKey}`);
        else addSpeed(other, speed);
      }
      n += 1;
    }
    pushActivate(piece, ctx, 'amulet_of_agility', `Accessory: ${piece.name}`);
    ctx.events.push({
      t: ctx.t,
      type: 'info',
      label: `${piece.name}: +${Math.round(speed * 100)}% speed ${dur}s ×${n} CD items, ${Math.round(refundRate * 100)}% used-buff refund`,
      meta: { category: 'adjacency', script: true, handler: 'amulet_of_agility' },
    });
  },
};

/** Bewitchment.gd — mana → least debuffs + type adj bonus. */
/** @type {ScriptHandler} */
export const bewitchmentPort = {
  handlerId: 'bewitchment',
  family: 'unique',
  onPrepare(piece, ctx) {
    const counts = { nature: 0, dark: 0, ice: 0 };
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    for (const link of links) {
      const item = ctx.itemsById.get(link.id);
      if (itemHasType(item, 'nature')) counts.nature += 1;
      if (itemHasType(item, 'dark')) counts.dark += 1;
      if (itemHasType(item, 'ice')) counts.ice += 1;
    }
    // Bewitchment.gd caches getAffectedItems() in onPrepare. The cached type
    // counts must not change when a later combat mutation changes the board.
    piece._bewitchmentTypeCounts = counts;
  },
  onCooldownEffect(piece, ctx) {
    const cost = Math.max(1, Math.round(getPName(piece.params, 'manat', getPName(piece.params, 'mana', 3))));
    const spent = useMana(ctx.player, cost, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (!(spent?.spent > 0)) return true;

    const counts = piece._bewitchmentTypeCounts || { nature: 0, dark: 0, ice: 0 };
    const chance = Number(ctx.itemsById.get(piece.itemId)?.chance) || Number(piece.chance) || 0;
    const leastStacks = Object.fromEntries(
      DEBUFF_KEYS.map((key) => [key, getStackAmount(ctx.dummy, /** @type {any} */ (key))]),
    );
    const picked = { poison: 0, blind: 0, cold: 0 };
    const base = Math.max(1, Math.round(getPName(piece.params, 'debuffs', getP2(piece.params, 1))));
    for (let i = 0; i < base; i += 1) {
      const least = Math.min(...DEBUFF_KEYS.map((key) => leastStacks[key]));
      const pool = DEBUFF_KEYS.filter((key) => leastStacks[key] === least);
      const stack = pool[Math.floor(ctx.rng() * pool.length)] || pool[0];
      leastStacks[stack] += 1;
      picked[stack] += 1;
    }
    const bonusRules = [
      ['nature', 'poison', getPName(piece.params, 'poison', getP3(piece.params, 2))],
      ['dark', 'blind', getPName(piece.params, 'blind', getP4(piece.params, 1))],
      ['ice', 'cold', getPName(piece.params, 'cold', getP5(piece.params, 1))],
    ];
    for (const [type, debuff, amount] of bonusRules) {
      if (counts[type] > 0 && rollItemChance(piece, ctx.rng, chance * counts[type])) {
        picked[debuff] += Math.max(0, Math.round(amount));
      }
    }
    for (const [stack, amount] of Object.entries(picked)) {
      if (!(amount > 0)) continue;
      // The source gives the complete least-stack map after its type bonuses
      // are added, preserving one causal origin per debuff type.
      grantStacks(ctx.dummy, stack, amount, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        rng: ctx.rng,
        opponent: ctx.player,
      });
    }
    pushActivate(piece, ctx, 'bewitchment', `Accessory: ${piece.name}`);
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
  family: 'unique',
  onPrepare(piece, ctx) {
    const effectDmg = getPName(piece.params, 'dam', 5) / 100;
    if (!(effectDmg > 0)) return;
    const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
    let bonusEffectDmg = 0;
    for (const link of links) {
      const item = ctx.itemsById.get(link.id);
      bonusEffectDmg += effectDmg * (itemHasType(item, 'spell') ? 2 : 1);
    }
    applyEffectDmgFactor(ctx.player, bonusEffectDmg, ctx, piece);
    piece._wandEffectDmgFactor = bonusEffectDmg;
  },
  onCooldownEffect(piece, ctx) {
    const healthUsed = Math.max(
      0,
      Math.trunc(getPName(piece.params, 'healtht', getP1(piece.params, 7))),
    );
    const healthEvent = loseHealth(piece, ctx, healthUsed);
    if (healthEvent) {
      // WandofDissonance.gd uses descriptor.minDam, not the mutable item
      // damage range (socketed/gem bonuses must not change this raw effect).
      const catalog = ctx.itemsById?.get(piece.itemId);
      const raw = Math.max(0, Number(catalog?.damageMin) || Number(piece.damageMin) || 0);
      dealEffectDamage(piece, ctx, raw, { parentId: healthEvent.eventId });

      const available = [
        ['mana', getPName(piece.params, 'mana', getP2(piece.params, 4))],
        ['lucky', getPName(piece.params, 'luck', getP3(piece.params, 3))],
        ['regeneration', getPName(piece.params, 'regen', getP4(piece.params, 3))],
      ];
      let maxStacks = 0;
      let maxBuffs = [];
      for (const [stack, amount] of available) {
        const stacks = getStackAmount(ctx.player, /** @type {any} */ (stack));
        if (stacks > maxStacks) {
          maxStacks = stacks;
          maxBuffs = [[stack, amount]];
        } else if (stacks === maxStacks) {
          maxBuffs.push([stack, amount]);
        }
      }
      const picked = maxBuffs[Math.floor(ctx.rng() * maxBuffs.length)] || available[0];
      const [stack, amount] = picked;
      grantStacks(ctx.player, /** @type {any} */ (stack), Math.max(0, Math.trunc(amount)), {
        originKey: piece.placementKey,
        originId: piece.itemId,
        parentId: healthEvent.eventId,
      });
    }
    // Source calls Item.activate() after the effect chain, even when the
    // health gate prevents the damage/buff branch.
    pushActivate(piece, ctx, 'wand_of_dissonance', `Accessory: ${piece.name}`);
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
