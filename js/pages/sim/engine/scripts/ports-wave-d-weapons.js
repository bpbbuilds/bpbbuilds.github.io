/**
 * Band AG 198–199 — Wave D hard weapons deepened vs .gd.
 */

import {
  cleanseRandomDebuffs,
  grantStacks,
  grantTemporaryStacks,
  inflictRandomDebuffs,
  onBuffChanged,
  spendStacks,
  stealRandomBuff,
  useMana,
  BUFF_KEYS,
} from '../buff-economy.js';
import { grantInvuln, grantStun, healActor, isInvulnerable } from '../actor.js';
import { affectedTargets } from '../board-graph.js';
import { emitPathCharge } from '../charge-delivery.js';
import { getP1, getP2, getP3, getP4, getP5, getP6, getPName } from '../params.js';
import { effectDuration } from '../effect-duration.js';
import { addBonusDamage, addSpeed } from '../piece-stats.js';
import { gainStacks, getStackAmount } from '../stacks.js';
import { grantTimedSpeed, refreshTimedSpeed } from '../timed-speed.js';
import { grantTimedResistancePct } from '../timed-resistance.js';
import { deliverCharge, leaveCharge } from '../charge-delivery.js';
import { modifiedParamValue } from '../placement-instance.js';
import { itemHasType, pushActivate } from './ports-util.js';
import {
  countEmptyAffectCells,
  removeBuffsFraction,
  removeBlock,
  removeRandomBuffs,
  rollItemChance,
  rollItemChance2,
  stealBuffsFraction,
  weaponStrike,
} from './ports-wave-c-util.js';
import { rollPercent } from '../rng.js';
import { effectiveChance } from '../chance.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** @param {object} ctx @param {object} piece @param {string} type */
function countType(ctx, piece, type, color = null) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect)
    .filter((link) => !color || link.color === color);
  let n = 0;
  for (const other of ctx.pieces || []) {
    if (!links.some((l) => l.key === other.placementKey)) continue;
    if (itemHasType(ctx.itemsById.get(other.itemId), type)) n += 1;
  }
  return n;
}

/** @param {object} ctx @param {object} piece */
function linkedCount(ctx, piece) {
  return affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect).length;
}

/** @param {object} ctx @param {object} piece @param {(id: string) => boolean} pred */
function countPred(ctx, piece, pred) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  let n = 0;
  for (const other of ctx.pieces || []) {
    if (!links.some((l) => l.key === other.placementKey)) continue;
    if (pred(other.itemId)) n += 1;
  }
  return n;
}

/** HolySpear.gd */
/** @type {ScriptHandler} */
export const holySpearPort = {
  handlerId: 'holy_spear',
  family: 'weapon_base',
  onPrepare(piece, ctx) {
    const empty = countEmptyAffectCells(ctx, piece);
    const holy = countType(ctx, piece, 'holy');
    const slots = empty + holy;
    const per = Math.trunc(getPName(piece.params, 'blockremoval', getP1(piece.params, 0)));
    piece._blockStrip = per * slots;
    piece._cleanses = slots;
    piece._spearState = 'Inactive';
    piece._spearUsedAt = null;

    const manaCost = Math.trunc(getPName(piece.params, 'manat', getP2(piece.params, 0)));
    const eventTime = (payload = null) => {
      if (Number.isFinite(Number(payload?.t))) return Number(payload.t);
      if (Number.isFinite(Number(piece._lastSimT))) return Number(piece._lastSimT);
      return Number(ctx.t) || 0;
    };
    const tryTrigger = (nowT = eventTime(), triggerEvent = null) => {
      const at = Number(nowT) || 0;
      if (piece._spearState !== 'Inactive') return;
      if (isInvulnerable(ctx.player, at)) return;
      if ((ctx.player.stacks.mana || 0) < manaCost) return;

      // HolySpear.gd sets Active and creates invulnerability before spending
      // Mana. The source timer then owns the Active -> Used transition.
      piece._spearState = 'Active';
      const baseDuration = getPName(
        piece.params,
        'dur_invu',
        getPName(piece.params, 'dur_invuln', getP4(piece.params, 0)),
      );
      const duration = modifiedParamValue(piece, baseDuration, 'dur_invu');
      grantInvuln(ctx.player, duration, at, {
        sourceId: piece.itemId,
        sourceKey: piece.placementKey,
        bus: ctx.bus,
      });
      piece._spearWasInvulnerable = isInvulnerable(ctx.player, at);
      piece._spearUsedAt = at + Math.max(0, duration);
      useMana(ctx.player, manaCost, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        triggerEvent,
      });
      const speed = getPName(piece.params, 'speed', getP3(piece.params, 0)) / 100;
      grantTimedSpeed(piece, speed, piece._spearUsedAt, 'holy_spear');
    };
    piece._tryHolySpear = tryTrigger;
    piece._spearWasInvulnerable = isInvulnerable(ctx.player, Number(ctx.t) || 0);
    piece._holySpearTick = (nowT) => {
      const at = Number(nowT) || 0;
      piece._lastSimT = at;
      if (piece._spearState === 'Active' && piece._spearUsedAt != null && at >= piece._spearUsedAt) {
        piece._spearState = 'Used';
      }
      const was = piece._spearWasInvulnerable;
      const current = isInvulnerable(ctx.player, at);
      piece._spearWasInvulnerable = current;
      if (was && !current) tryTrigger(at, { actor: ctx.player, t: at, reason: 'invulnerable_end' });
    };
    onBuffChanged(ctx.player, (change) => {
      if (change.stack !== 'mana') return;
      tryTrigger(eventTime(), change);
    });
    ctx.bus?.on?.('character_mana_changed', (payload = {}) => {
      if (payload.actor && payload.actor !== ctx.player) return;
      tryTrigger(eventTime(payload), payload);
    });
    ctx.bus?.on?.('character_invulnerable_end', (payload = {}) => {
      if (payload.actor && payload.actor !== ctx.player) return;
      tryTrigger(eventTime(payload), payload);
    });
  },
  onTick(piece, ctx) {
    piece._holySpearTick?.(ctx.t);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'holy_spear');
  },
  onPreDealDamageLate(piece, ctx, hit) {
    if (hit?.hit) {
      if (piece._blockStrip) removeBlock(ctx.dummy, piece._blockStrip, ctx, piece);
      const n = Math.trunc(piece._cleanses || 0);
      if (n) {
        cleanseRandomDebuffs(ctx.player, n, ctx.rng, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
      }
    }
  },
};

/** Automanaton.gd */
/** @type {ScriptHandler} */
export const automanatonPort = {
  handlerId: 'automanaton',
  family: 'on_hit',
  // Automanaton.gd connects its low-health listener during onPrepare.
  onPrepare(piece, ctx) {
    piece._autoLowHp = false;
    piece._autoLowHpTrigger = (t = ctx.t) => {
      if (piece._autoLowHp) return;
      const thresh = getPName(piece.params, 'healtht', 50) / 100 - 0.0001;
      const rel = ctx.player.maxHp > 0 ? ctx.player.hp / ctx.player.maxHp : 1;
      if (!(rel < thresh)) return;
      piece._autoLowHp = true;
      const speed = getPName(piece.params, 'speed', 10) / 100;
      const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
      for (const other of ctx.pieces || []) {
        if (!links.some((l) => l.key === other.placementKey)) continue;
        grantTimedSpeed(other, speed, t + Math.max(1, getPName(piece.params, 'dur_dmgreduction', 3)), 'automanaton');
        const manaAmp = Number(piece.chance2) || getPName(piece.params, 'chance2', 0);
        if (manaAmp) {
          other.buffAmplificationChances = other.buffAmplificationChances || {};
          other.buffAmplificationChances.mana =
            (Number(other.buffAmplificationChances.mana) || 0) + manaAmp;
        }
      }
      const resistDur = Math.max(1, getPName(piece.params, 'dur_dmgreduction', 3));
      grantTimedResistancePct(ctx.player, getPName(piece.params, 'dmgreduction', 20), t + resistDur, 'automanaton');
      grantStacks(ctx.player, 'block', Math.max(1, Math.round(piece.blockGrant || getP2(piece.params, 4))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    };
    ctx.bus?.on?.('character_damaged', (payload) => {
      if (payload?.actor && payload.actor !== ctx.player) return;
      piece._autoLowHpTrigger(payload?.t ?? ctx.t);
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'automanaton');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const cost = Math.max(1, Math.round(getPName(piece.params, 'manat', getPName(piece.params, 'mana', 2))));
    if ((ctx.player.stacks.mana || 0) >= cost) {
      useMana(ctx.player, cost, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      const blind = Math.max(1, Math.round(getPName(piece.params, 'blind', 1)));
      const durBlind = Math.max(0.5, getPName(piece.params, 'dur_blind', 2));
      grantTemporaryStacks(ctx.dummy, 'blind', blind, durBlind, ctx.t, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        rng: ctx.rng,
        opponent: ctx.player,
      });
      if (rollItemChance(piece, ctx.rng)) {
        grantStun(ctx.dummy, Math.max(0.5, effectDuration(piece, 'dur_stun', 1)), ctx.t);
      }
      const cleanse = Math.max(1, Math.round(getPName(piece.params, 'cleanse', 1)));
      cleanseRandomDebuffs(ctx.player, cleanse, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
  },
};

/** Bazooka.gd */
/** @type {ScriptHandler} */
export const bazookaPort = {
  handlerId: 'bazooka',
  family: 'on_hit',
  onPrepare(piece, ctx) {
    piece._bazoUses = 0;
    piece._stunResist = false;
    const chance =
      Number(ctx.itemsById.get(piece.itemId)?.chance) || Number(piece.chance) || 0;
    const luckNeeded = Math.max(
      1,
      Math.round(getPName(piece.params, 'luckt', getP3(piece.params, 10))),
    );
    onBuffChanged(ctx.player, (change) => {
      if (change?.stack !== 'lucky' || !change.amount) return;
      const lucky = Number(ctx.player.stacks.lucky) || 0;
      if (change.amount > 0 && !piece._stunResist && lucky >= luckNeeded) {
        ctx.player.stunResistance = (Number(ctx.player.stunResistance) || 0) + chance;
        piece._stunResist = true;
      } else if (change.amount < 0 && piece._stunResist && lucky < luckNeeded) {
        ctx.player.stunResistance = Math.max(
          0,
          (Number(ctx.player.stunResistance) || 0) - chance,
        );
        piece._stunResist = false;
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'bazooka');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const max = Math.max(1, Math.round(getPName(piece.params, 'max', getP6(piece.params, 5))));
    if ((piece._bazoUses || 0) >= max) return;
    const need = Math.max(1, Math.round(getPName(piece.params, 'heatt', getP1(piece.params, 1))));
    if ((ctx.player.stacks.heat || 0) < need) return;
    spendStacks(ctx.player, 'heat', need, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    piece._bazoUses = (piece._bazoUses || 0) + 1;
    const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', getP2(piece.params, 2))));
    grantStacks(ctx.player, 'lucky', luck, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    grantStacks(ctx.player, 'block', Math.max(0, Math.round(Number(piece.blockGrant) || 0)), {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    grantStun(ctx.dummy, effectDuration(piece, 'dur_stun', getP4(piece.params, 0.6)), ctx.t, { rng: ctx.rng });
    grantStun(ctx.player, effectDuration(piece, 'dur_stunself', getP5(piece.params, 0.4)), ctx.t, { rng: ctx.rng });
  },
};

/** Chainsaw.gd */
/** @type {ScriptHandler} */
export const chainsawPort = {
  handlerId: 'chainsaw',
  family: 'on_hit',
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'chainsaw');
  },
  onPrepare(piece) {
    piece._chainsawCharged = false;
  },
  onChargeReceived(piece) {
    if ((piece.numCharges || 0) === 1) piece._chainsawCharged = true;
  },
  onChargeLeft(piece) {
    if ((piece.numCharges || 0) === 0) piece._chainsawCharged = false;
  },
  onPreDealDamageEarly(piece, ctx, damageRes) {
    if (!damageRes?.hit) return;
    const fraction = Math.max(0, getPName(piece.params, 'buffs', 5) / 100);
    const limit = 1000;
    if ((piece.numCharges || 0) > 0) {
      stealBuffsFraction(ctx.dummy, ctx.player, fraction, limit, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    } else {
      removeBuffsFraction(ctx.dummy, fraction, limit, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    // Item.reduceSpeed() mutates the saw's own speed scale, not the
    // opponent actor. The modifier persists after the successful hit.
    addSpeed(piece, -getPName(piece.params, 'slow', 5) / 100);
  },
};

/** CupcakeDragon.gd */
/** @type {ScriptHandler} */
export const cupcakeDragonPort = {
  handlerId: 'cupcake_dragon',
  family: 'on_hit',
  onPrepare(piece, ctx) {
    const n = countType(ctx, piece, 'food');
    const speed = getPName(piece.params, 'speed', 10) / 100;
    if (n && speed) addSpeed(piece, n * speed);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'cupcake_dragon');
  },
  onPreDealDamageEarly(piece, ctx, hit) {
    if (!hit?.hit) return;
    const removeN = Math.max(1, Math.round(getPName(piece.params, 'remove', 1)));
    removeMostDragonBuffs(ctx.player, ctx.dummy, removeN, ctx.rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    const gainN = Math.max(1, Math.round(getPName(piece.params, 'gain', 1)));
    const pool = mostDragonBuffs(ctx.dummy, ctx.rng);
    if (!pool.length) return;
    const choice = pool[Math.floor(ctx.rng() * pool.length)] || pool[0];
    grantStacks(ctx.player, choice, gainN, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  },
};

/**
 * Cupcake Dragon follows the source getMostStacks() list: only the tied
 * highest buff types are candidates, and removal can span that list.
 */
function mostDragonBuffs(actor, rng) {
  let best = 0;
  for (const stack of BUFF_KEYS) best = Math.max(best, getStackAmount(actor, /** @type {any} */ (stack)) || 0);
  if (best <= 0) return [];
  const pool = BUFF_KEYS.filter((stack) => getStackAmount(actor, /** @type {any} */ (stack)) === best);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function removeMostDragonBuffs(sourceTypes, target, num, rng, opts) {
  let left = Math.max(0, Math.round(num));
  for (const stack of mostDragonBuffs(sourceTypes, rng)) {
    if (left <= 0) break;
    const current = getStackAmount(target, /** @type {any} */ (stack));
    const take = Math.min(current, left);
    const spent = spendStacks(target, stack, take, { ...opts, hostileStrip: true, rng });
    left -= spent.spent || 0;
  }
}

/** PrismaticSword.gd */
/** @type {ScriptHandler} */
export const prismaticSwordPort = {
  handlerId: 'prismatic_sword',
  family: 'on_hit',
  onPrepare(piece, ctx) {
    const magic = countType(ctx, piece, 'magic');
    const holy = countType(ctx, piece, 'holy');
    const dark = countType(ctx, piece, 'dark');
    const vamp = countType(ctx, piece, 'vampiric') || countType(ctx, piece, 'vamp');
    const speed = getPName(piece.params, 'speed', 5) / 100;
    if (magic) addSpeed(piece, speed * magic);
    piece._prismHoly = holy;
    piece._prismDark = dark;
    piece._prismVamp = vamp;
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'prismatic_sword');
  },
  onPreDealDamageEarly(piece, ctx, hit) {
    if (!hit?.hit) return;
    const damPer = getPName(piece.params, 'dam', getP3(piece.params, 0));
    if (piece._prismHoly && damPer) addBonusDamage(piece, damPer * piece._prismHoly);
    const baseChance2 = Number(piece.chance2) || Number(ctx.itemsById?.get?.(piece.itemId)?.chance2) || 0;
    if (piece._prismDark && rollItemChance2(piece, ctx.rng, baseChance2 * piece._prismDark)) {
      const n = Math.max(0, Math.trunc(getPName(piece.params, 'debuffs', getP4(piece.params, 0))));
      inflictRandomDebuffs(ctx.dummy, n, ctx.rng, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        opponent: ctx.player,
      });
    }
  },
  onPreDealDamageLate(piece, ctx, hit) {
    if (!hit?.hit || !(piece._prismVamp > 0)) return;
    const ls = getPName(piece.params, 'lifesteal', 0) / 100;
    const healed = healActor(ctx.player, Math.ceil((Number(hit.damage) || 0) * ls * piece._prismVamp));
    if (healed > 0) {
      ctx.events.push({
        t: ctx.t + 0.008,
        type: 'heal',
        target: 'player',
        amount: healed,
        label: `${piece.name}: lifesteal +${healed}`,
        meta: { category: 'heal', script: true, handler: 'prismatic_sword' },
      });
    }
  },
};

/** StoneGolem.gd */
function activateStoneGolem(piece, ctx) {
  if (piece._stoneRegenDone) return;
  const need = getPName(
    piece.params,
    'regen',
    getPName(piece.params, 'regent', getP2(piece.params, 3)),
  );
  if (getStackAmount(ctx.player, 'regeneration') < need) return;
  const used = spendStacks(ctx.player, 'regeneration', need, {
    originKey: piece.placementKey,
    originId: piece.itemId,
  });
  if (used.spent < need) return;

  // StoneGolem.gd uses getBlock() (the item's tooltip Block value), not p3.
  const block = Number(piece.blockGrant) || 0;
  grantStacks(ctx.player, 'block', block, {
    originKey: piece.placementKey,
    originId: piece.itemId,
  });
  const cd = getP4(piece.params, 0);
  piece.baseCooldown = cd;
  piece.cooldown = cd;
  piece._stoneRegenDone = true;
}

/** @type {ScriptHandler} */
export const stoneGolemPort = {
  handlerId: 'stone_golem',
  family: 'on_hit',
  onPrepare(piece, ctx) {
    // StoneGolem.gd connects during onPrepare, before any combat-start effects
    // can grant Regeneration.
    piece._stoneRegenDone = false;
    onBuffChanged(ctx.player, (change) => {
      if (change.stack === 'regeneration' && change.amount > 0) {
        activateStoneGolem(piece, ctx);
      }
    });
  },
  onPreCombatStart(piece, ctx) {
    const n = countPred(ctx, piece, (id) => /bag_of_stones|stone_bag/i.test(id));
    const per = getPName(piece.params, 'bonusdam', getP1(piece.params, 1));
    if (n) addBonusDamage(piece, n * per);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'stone_golem');
  },
  onPreDealDamageEarly(piece, ctx, hit) {
    if (!hit?.hit) return;
    const emp = getPName(piece.params, 'empower', 1);
    grantStacks(ctx.player, 'empower', emp, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    if (rollItemChance(piece, ctx.rng)) {
      grantStun(ctx.dummy, effectDuration(piece, 'dur_stun', 1), ctx.t, { rng: ctx.rng });
    }
  },
};

/** WaterElemental.gd */
/** @type {ScriptHandler} */
export const waterElementalPort = {
  handlerId: 'water_elemental',
  family: 'on_hit',
  onPrepare(piece, ctx) {
    const ice = countType(ctx, piece, 'ice', 'secondary');
    const speed = getPName(piece.params, 'speed', 5) / 100;
    if (ice) addSpeed(piece, speed * ice);
    piece._manaSpent = 0;
    piece._waterStage = 0;
    piece._waterNatureCount = countType(ctx, piece, 'nature', 'primary');
    piece._waterAffectedCount = linkedCount(ctx, piece);
    onBuffChanged(ctx.player, (change) => {
      if (change.stack !== 'mana' || change.amount >= 0 || !change.used) return;
      piece._manaSpent = (piece._manaSpent || 0) + Math.abs(change.amount);
      const before = piece._waterStage || 0;
      const t1 = Math.max(0, Math.round(getPName(piece.params, 'manat1', 10)));
      const t2 = Math.max(0, Math.round(getPName(piece.params, 'manat2', 20)));
      const t3 = Math.max(0, Math.round(getPName(piece.params, 'manat3', 30)));
      if (piece._waterStage === 0 && piece._manaSpent >= t1) piece._waterStage = 1;
      if (piece._waterStage === 1 && piece._manaSpent >= t2) {
        piece._waterStage = 2;
        addBonusDamage(piece, getPName(piece.params, 'dam', 0));
      }
      if (piece._waterStage === 2 && piece._manaSpent >= t3) piece._waterStage = 3;
      if (before !== piece._waterStage) {
        ctx.events.push({
          t: ctx.t,
          type: 'info',
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          label: `${piece.name}: stage ${piece._waterStage}`,
          meta: { category: 'system', script: true, handler: 'water_elemental' },
        });
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'water_elemental');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    let manaGain = Math.max(0, Math.round(getPName(piece.params, 'mana', 0)));
    const chance = effectiveChance(piece, 0) * (piece._waterAffectedCount ?? linkedCount(ctx, piece));
    if (piece._waterNatureCount && rollPercent(chance, ctx.rng)) {
      manaGain += Math.max(0, Math.round(getPName(piece.params, 'mana2', 0)));
    }
    grantStacks(ctx.player, 'mana', manaGain, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if ((piece._waterStage || 0) >= 1) {
      const heal = modifiedParamValue(
        piece,
        getPName(piece.params, 'heal', getP4(piece.params, 0)),
        'heal',
      );
      healActor(ctx.player, Math.max(0, Math.round(heal)));
    }
    if ((piece._waterStage || 0) >= 3) {
      grantStacks(ctx.dummy, 'cold', Math.max(0, Math.round(getPName(piece.params, 'cold', 0))), {
        originKey: piece.placementKey,
        originId: piece.itemId,
        rng: ctx.rng,
        opponent: ctx.player,
      });
    }
  },
};

/** LightningStaff.gd — path sendCharge + cell dam */
function emitLightningStaffCharge(piece, ctx, speedFactor = 1) {
  const flat = getPName(piece.params, 'dam_flat', getP5(piece.params, 0));
  const perTile = getPName(piece.params, 'dam_tile', getP6(piece.params, 0));
  let chargedTarget = null;
  emitPathCharge(piece, ctx, {
    speedFactor,
    durPerTile: modifiedParamValue(
      piece,
      getPName(piece.params, 'dur', getP4(piece.params, 0)),
      'dur',
    ),
    label: `${piece.name}: sendCharge`,
    onCellEnter(target, step) {
      const previousValue = flat + (step.cellIndex - 2) * perTile;
      const nextValue = previousValue + perTile;
      if (chargedTarget) {
        if (chargedTarget === target) {
          addBonusDamage(chargedTarget, perTile, { removable: false });
        } else {
          addBonusDamage(chargedTarget, -previousValue, { removable: false });
        }
      }
      if (target && target !== chargedTarget) {
        addBonusDamage(target, nextValue, { removable: false });
      }
      chargedTarget = target || null;
    },
    onPathEnd(step) {
      if (!chargedTarget) return;
      const previousValue = flat + (step.cellIndex - 2) * perTile;
      addBonusDamage(chargedTarget, -previousValue, { removable: false });
      chargedTarget = null;
    },
  });
}

/** @type {ScriptHandler} */
export const lightningStaffPort = {
  handlerId: 'lightning_staff',
  family: 'on_hit',
  emitCharge(piece, ctx, speedFactor = 1) {
    pushActivate(piece, ctx, 'lightning_staff', `Weapon: ${piece.name}`);
    emitLightningStaffCharge(piece, ctx, speedFactor);
  },
  onPrepare(piece) {
    piece._litHits = 0;
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'lightning_staff');
  },
  onPreDealDamageEarly(piece, ctx, res) {
    void res;
    const cost = Math.trunc(getPName(piece.params, 'manat', getP1(piece.params, 0)));
    const spent = useMana(ctx.player, cost, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (spent?.spent === cost) {
      addBonusDamage(piece, getPName(piece.params, 'dam', getP2(piece.params, 0)));
    }
    piece._litHits = (piece._litHits || 0) + 1;
    const every = getPName(piece.params, 'num', getP3(piece.params, 0));
    if (piece._litHits !== every) return;
    piece._litHits = 0;
    pushActivate(piece, ctx, 'lightning_staff', `Weapon: ${piece.name}`);
    emitLightningStaffCharge(piece, ctx);
    ctx.bus?.emit?.('charge_emitted', { piece, t: ctx.t });
  },
};

/** ThunderDrake.gd — exact Lightning target filter, hit threshold, charge cycle, and timer. */
/** @type {ScriptHandler} */
export const thunderDrakePort = {
  handlerId: 'thunder_drake',
  family: 'on_hit',
  onPrepare(piece, ctx) {
    piece._drakeHits = 0;
    piece._drakeBuffOn = false;
    piece._drakeBuffUntil = null;
    piece._drakeTargets = drakeTargets(piece, ctx);
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'thunder_drake');
  },
  onTick(piece, ctx) {
    if (!piece._drakeBuffOn || piece._drakeBuffUntil == null) return;
    if (ctx.t + 1e-9 < piece._drakeBuffUntil) return;
    endDrakeBuff(piece, ctx);
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    piece._drakeHits = (piece._drakeHits || 0) + 1;
    const every = Math.trunc(getPName(piece.params, 'hits', getP1(piece.params, 3)));
    if (every <= 0 || piece._drakeHits !== every) return;
    piece._drakeHits = 0;

    const targets = getDrakeTargets(piece, ctx);
    const tag = `drake:${piece.placementKey}`;
    const speed = getPName(piece.params, 'speed', getP3(piece.params, 20)) / 100;
    const durBase = modifiedParamValue(
      piece,
      getPName(piece.params, 'dur', getP2(piece.params, 2)),
      'dur',
    );
    const dur = scaleDrakeDuration(piece, durBase);
    const until = ctx.t + Math.max(0, dur);

    if (piece._drakeBuffOn) {
      for (const { target } of targets) {
        leaveCharge(target, ctx, { emitterKey: piece.placementKey });
        deliverCharge(target, ctx, { emitterKey: piece.placementKey });
        restartDrakeSpeed(target, until, tag);
      }
    } else {
      piece._drakeBuffOn = true;
      for (const { target, multiplicity } of targets) {
        grantTimedSpeed(target, speed * multiplicity, until, tag);
        deliverCharge(target, ctx, { emitterKey: piece.placementKey });
      }
    }
    piece._drakeBuffUntil = until;
  },
};

/** @param {object} piece @param {object} ctx */
function drakeTargets(piece, ctx) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  const source = ctx.graph?.pieces?.get?.(piece.placementKey);
  const counts = new Map();
  for (const mark of source?.affectCells || []) {
    if (mark.color !== 'lightning') continue;
    const key = ctx.graph?.filled?.get?.(mark.cell);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return (ctx.pieces || [])
    .filter((target) => links.some((link) => link.key === target.placementKey))
    .map((target) => ({
      target,
      multiplicity: Math.max(1, counts.get(target.placementKey) || 0),
    }));
}

/** @param {object} piece @param {object} ctx */
function getDrakeTargets(piece, ctx) {
  if (Array.isArray(piece._drakeTargets)) return piece._drakeTargets;
  const targets = drakeTargets(piece, ctx);
  piece._drakeTargets = targets;
  return targets;
}

/** @param {object} piece @param {number} base */
function scaleDrakeDuration(piece, base) {
  const factor = Number(piece.effectDurationFactor);
  return base * (Number.isFinite(factor) && factor > 0 ? factor : 1);
}

/** @param {object} target @param {number} until @param {string} tag */
function restartDrakeSpeed(target, until, tag) {
  const existing = (target._timedSpeeds || []).find((entry) => entry.tag === tag);
  if (existing) existing.untilT = until;
}

/** @param {object} piece @param {object} ctx */
function endDrakeBuff(piece, ctx) {
  const targets = getDrakeTargets(piece, ctx);
  for (const { target } of targets) {
    leaveCharge(target, ctx, { emitterKey: piece.placementKey });
  }
  piece._drakeBuffOn = false;
  piece._drakeBuffUntil = null;
}

/** @type {Record<string, ScriptHandler>} */
export const WAVE_D_WEAPON_PORTS = {
  holy_spear: holySpearPort,
  automanaton: automanatonPort,
  bazooka: bazookaPort,
  chainsaw: chainsawPort,
  cupcake_dragon: cupcakeDragonPort,
  prismatic_sword: prismaticSwordPort,
  stone_golem: stoneGolemPort,
  water_elemental: waterElementalPort,
  lightning_staff: lightningStaffPort,
  thunder_drake: thunderDrakePort,
};
