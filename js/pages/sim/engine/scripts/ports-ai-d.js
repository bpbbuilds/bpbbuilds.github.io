/**
 * Band AI Wave D — accessory deepen from Items/*.gd.
 * Do not mark inventory DEEP here.
 */

import {
  BUFF_KEYS,
  giveRandomBuffs,
  grantStacks,
  onBuffChanged,
  stealRandomBuff,
  stealStack,
  useRegeneration,
} from '../buff-economy.js';
import { applyHealEfficiency } from '../actor-stats.js';
import { affectedTargets } from '../board-graph.js';
import { emitPathCharge } from '../charge-delivery.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { rollPercent } from '../rng.js';
import { getStackAmount } from '../stacks.js';
import { grantTimedSpeed } from '../timed-speed.js';
import { itemHasType, afterEffectFinished, pushActivate, pushBuffGrants } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/**
 * multiplyBuffsLimit(.gd) — grant proportional buff stacks capped by limit.
 * @param {import('../actor.js').SimActor} actor
 * @param {number} fraction
 * @param {number} limit
 * @param {object} opts
 * @returns {Record<string, number>}
 */
function multiplyBuffsLimit(actor, fraction, limit, opts = {}) {
  const frac = Math.max(0, Number(fraction) || 0);
  const cap = Math.max(0, Math.round(limit) || 0);
  if (!(frac > 0) || !(cap > 0)) return {};

  /** @type {Record<string, number>} */
  const unlimited = {};
  let sum = 0;
  for (const k of BUFF_KEYS) {
    const prior = getStackAmount(actor, /** @type {any} */ (k));
    if (!(prior > 0)) continue;
    const withBonus = prior * frac;
    unlimited[k] = withBonus;
    sum += withBonus;
  }
  const sumRounded = Math.round(sum);
  if (!(sumRounded > 0)) return {};

  const totalToGive = Math.min(cap, sumRounded);
  const limitFactor = totalToGive / sumRounded;
  /** @type {Record<string, number>} */
  const buffsToGive = {};
  /** @type {Record<string, number>} */
  const overflow = {};
  let totalGiven = 0;
  for (const [k, withBonus] of Object.entries(unlimited)) {
    const limited = withBonus * limitFactor;
    const guaranteed = Math.floor(limited);
    buffsToGive[k] = guaranteed;
    overflow[k] = limited - guaranteed;
    totalGiven += guaranteed;
  }
  let overflowBuffs = totalToGive - totalGiven;
  const sorted = Object.keys(overflow).sort((a, b) => overflow[b] - overflow[a]);
  for (const k of sorted) {
    if (overflowBuffs <= 0) break;
    buffsToGive[k] = (buffsToGive[k] || 0) + 1;
    overflowBuffs -= 1;
  }

  /** @type {Record<string, number>} */
  const granted = {};
  for (const [k, n] of Object.entries(buffsToGive)) {
    if (!(n > 0)) continue;
    grantStacks(actor, k, n, opts);
    granted[k] = n;
  }
  return granted;
}

/**
 * AmuletofAlchemy.gd — start random buffs; linked potion activate → chance delayed re-trigger.
 * Gap: no potion_emptied bus — peer activate ≈ emptied. Threshold potions that skip
 * activatePiece will not refill. Delay uses pendingCharges as a timer.
 * @type {ScriptHandler}
 */
export const amuletOfAlchemyPort = {
  handlerId: 'amulet_of_alchemy',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events, rng } = ctx;
    const num = Math.max(1, Math.round(getPName(piece.params, 'buffs', getP1(piece.params, 3))));
    const picked = giveRandomBuffs(player, num, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'amulet_of_alchemy', picked);
    pushActivate(piece, ctx, 'amulet_of_alchemy', `Accessory: ${piece.name}`);
  },
  onPeerActivated(listener, activated, ctx) {
    if (!itemHasType(ctx.itemsById.get(activated.itemId), 'potion')) return;
    const chance =
      Number(ctx.itemsById.get(listener.itemId)?.chance) || Number(listener.chance) || 70;
    if (!rollPercent(chance, ctx.rng)) return;
    const delay = Math.max(
      0.1,
      getPName(listener.params, 'delay', getP2(listener.params, 2.5)),
    );
    if (!listener.pendingCharges) listener.pendingCharges = [];
    listener.pendingCharges.push({
      at: (ctx.t || 0) + delay,
      meta: {
        alchemyPotionKey: activated.placementKey,
        emitterKey: listener.placementKey,
      },
    });
    ctx.events.push({
      t: ctx.t + 0.002,
      type: 'info',
      label: `${listener.name}: queue ${activated.name} refill +${delay.toFixed(1)}s`,
      meta: { category: 'system', script: true, handler: 'amulet_of_alchemy' },
    });
  },
  onChargeReceived(piece, ctx, meta) {
    const key = meta?.alchemyPotionKey;
    if (!key) return;
    const potion = (ctx.pieces || []).find((p) => p.placementKey === key);
    if (!potion) return;
    // Gap: .gd triggerPotion() does not re-consume; activatePiece may.
    const wasAlive = potion.alive;
    const wasCharges = potion.charges;
    if (potion.charges != null && potion.charges <= 0) potion.charges = 1;
    potion.alive = true;
    if (typeof ctx.activatePiece === 'function') {
      ctx.activatePiece(potion, ctx);
    }
    potion.alive = wasAlive;
    potion.charges = wasCharges;
    pushActivate(piece, ctx, 'amulet_of_alchemy', `Accessory: ${piece.name} refill`);
  },
};

/**
 * AmuletofLife.gd — prepare heal amp; start giveMaxHealth.
 * @type {ScriptHandler}
 */
export const amuletOfLifePort = {
  handlerId: 'amulet_of_life',
  family: 'start_buff',
  onCombatStart(piece, ctx) {
    const { t, player, events } = ctx;
    const healAmp = getPName(piece.params, 'healamp', getP1(piece.params, 10)) / 100;
    if (healAmp) {
      applyHealEfficiency(player, healAmp, ctx, piece);
    }
    const hp = Math.max(
      1,
      Math.round(getPName(piece.params, 'maxhealth', getP2(piece.params, 20))),
    );
    player.maxHp += hp;
    player.hp = Math.min(player.maxHp, player.hp + hp);
    events.push({
      t,
      type: 'heal',
      target: 'player',
      amount: hp,
      label: `${piece.name}: +${hp} max HP`,
      meta: {
        category: 'heal',
        script: true,
        handler: 'amulet_of_life',
        playerHp: player.hp,
        maxHp: player.maxHp,
      },
    });
    pushActivate(piece, ctx, 'amulet_of_life', `Accessory: ${piece.name}`);
  },
};

/**
 * HeartofDarkness.gd — dark speed; steal prioritizing regen; once: spend regen → maxHP/empower/foe unhealing.
 * @type {ScriptHandler}
 */
export const heartOfDarknessPort = {
  handlerId: 'heart_of_darkness',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { graph, itemsById, canAffect, player, events, t } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const speed = getPName(piece.params, 'darkspeed', getP1(piece.params, 20)) / 100;
    if (links.length && speed) addSpeed(piece, links.length * speed);
    piece._hodActivated = false;
    const need = Math.max(1, Math.round(getPName(piece.params, 'regent', getP2(piece.params, 7))));
    onBuffChanged(player, (ch) => {
      if (piece._hodActivated) return;
      if (ch.stack !== 'regeneration' || !(ch.amount > 0)) return;
      if (getStackAmount(player, 'regeneration') < need) return;
      piece._hodActivated = true;
      if (
        useRegeneration(player, need, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        }).spent <= 0
      ) {
        piece._hodActivated = false;
        return;
      }
      const hp = Math.max(
        1,
        Math.round(getPName(piece.params, 'maxhealth', getP3(piece.params, 100))),
      );
      player.maxHp += hp;
      player.hp = Math.min(player.maxHp, player.hp + hp);
      const emp = Math.max(1, Math.round(getPName(piece.params, 'empower', 4)));
      grantStacks(player, 'empower', emp, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      const unh = getPName(piece.params, 'healreduction', 40) / 100;
      if (unh) ctx.dummy.unhealing = (Number(ctx.dummy.unhealing) || 0) + unh;
      events.push({
        t: ctx.t || t,
        type: 'heal',
        target: 'player',
        amount: hp,
        label: `${piece.name}: regen gate +${hp} max HP +${emp} Empower`,
        meta: { category: 'heal', script: true, handler: 'heart_of_darkness' },
      });
      pushActivate(piece, ctx, 'heart_of_darkness', `Accessory: ${piece.name} filled`);
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, rng } = ctx;
    pushActivate(piece, ctx, 'heart_of_darkness', `Accessory: ${piece.name}`);
    const num = Math.max(
      1,
      Math.round(
        getPName(piece.params, 'buffsteal', getPName(piece.params, 'steal', getP3(piece.params, 2))),
      ),
    );
    /** @type {Record<string, number>} */
    const stolen = {};
    let left = num;
    while (left > 0 && getStackAmount(dummy, 'regeneration') > 0) {
      const r = stealStack(dummy, player, 'regeneration', 1, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      if (!(r.stolen > 0)) break;
      stolen.regeneration = (stolen.regeneration || 0) + r.stolen;
      left -= 1;
    }
    if (left > 0) {
      const rest = stealRandomBuff(dummy, player, left, rng, {
        availableBuffs: BUFF_KEYS,
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      for (const [k, n] of Object.entries(rest)) {
        stolen[k] = (stolen[k] || 0) + n;
      }
    }
    pushBuffGrants(events, piece, player, t, 'heart_of_darkness', stolen);
    return true;
  },
};

/**
 * ManaCrystal.gd — emitPathCharge; mana1 / mana2(magic) when charge enters a new peer.
 * @type {ScriptHandler}
 */
export const manaCrystalPort = {
  handlerId: 'mana_crystal',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, events, player } = ctx;
    pushActivate(piece, ctx, 'mana_crystal', `Accessory: ${piece.name}`);
    const mana1 = Math.max(1, Math.round(getPName(piece.params, 'mana1', getP1(piece.params, 1))));
    const mana2 = Math.max(1, Math.round(getPName(piece.params, 'mana2', getP2(piece.params, 2))));
    const durPerTile = getPName(piece.params, 'dur', getP3(piece.params, 2)) || 2;
    /** @type {string | null} */
    let lastKey = null;
    emitPathCharge(piece, ctx, {
      durPerTile,
      label: `${piece.name}: emitCharge`,
      onCellEnter(target, step) {
        if (!target) {
          lastKey = null;
          return;
        }
        const key = target.placementKey;
        if (key === lastKey) return;
        lastKey = key;
        const tgtItem = ctx.itemsById.get(target.itemId);
        const amt = itemHasType(tgtItem, 'magic') ? mana2 : mana1;
        grantStacks(player, 'mana', amt, {
          originKey: piece.placementKey,
          originId: piece.itemId,
        });
        events.push({
          t: t + (step.enterT || 0),
          type: 'buff',
          target: 'player',
          amount: amt,
          label: `${piece.name}: +${amt} Mana (${target.name})`,
          meta: {
            category: 'buff',
            stack: 'mana',
            script: true,
            handler: 'mana_crystal',
          },
        });
      },
    });
    return true;
  },
};

/**
 * SpiritBells.gd — LeatherHelm DR × distinct pets; CD multiplyBuffsLimit.
 * Gap: shop spirit-companion weight / unlimited companions not simulated.
 * @type {ScriptHandler}
 */
export const spiritBellsPort = {
  handlerId: 'spirit_bells',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect, pieces } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    /** @type {Set<string>} */
    const distinct = new Set();
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const item = itemsById.get(other.itemId);
      if (!(other.kind === 'pet' || itemHasType(item, 'pet'))) continue;
      distinct.add(String(other.itemId));
    }
    const durBase = Math.max(0.1, getPName(piece.params, 'dur_base', getP2(piece.params, 2)));
    const durBonus = Math.max(0, getPName(piece.params, 'dur_bonus', getP3(piece.params, 1)));
    const dur = durBase + durBonus * distinct.size;
    const dr = Math.max(
      0,
      getPName(piece.params, 'damreduction', getP1(piece.params, 30)),
    );
    if (dr) {
      player.damageResistancePct = (Number(player.damageResistancePct) || 0) + dr;
      grantTimedSpeed(piece, 1e-6, t + dur, 'spirit_bells_dr');
      const prev = piece._onTimedSpeedEnd;
      piece._onTimedSpeedEnd = (tag, e) => {
        prev?.(tag, e);
        if (tag === 'spirit_bells_dr') {
          player.damageResistancePct = Math.max(
            0,
            (Number(player.damageResistancePct) || 0) - dr,
          );
        }
      };
      events.push({
        t: t + 0.002,
        type: 'info',
        label: `${piece.name}: −${dr}% dmg ${dur.toFixed(1)}s (${distinct.size} pets)`,
        meta: { category: 'system', script: true, handler: 'spirit_bells' },
      });
    }
    pushActivate(piece, ctx, 'spirit_bells', `Accessory: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'spirit_bells', `Accessory: ${piece.name}`);
    const frac = getPName(piece.params, 'buffs', getP1(piece.params, 30)) / 100;
    const granted = multiplyBuffsLimit(player, frac, 1000, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'spirit_bells', granted);
    afterEffectFinished(piece, ctx, 'spirit_bells', { activate: false });
    return true;
  },
};

/**
 * StoneBadge.gd — CD giveBlock via grantStacks (armor-style).
 * Gap: onShopEntered goldValue → generate Stone / cheap items; ItemBook class filter.
 * @type {ScriptHandler}
 */
export const stoneBadgePort = {
  handlerId: 'stone_badge',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'stone_badge', `Badge: ${piece.name}`);
    const block = Math.max(
      1,
      Math.round(piece.blockGrant || getPName(piece.params, 'block', getP1(piece.params, 4))),
    );
    grantStacks(player, 'block', block, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'stone_badge' },
    });
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AI_D_PORTS = {
  amulet_of_alchemy: amuletOfAlchemyPort,
  amulet_of_life: amuletOfLifePort,
  heart_of_darkness: heartOfDarknessPort,
  mana_crystal: manaCrystalPort,
  spirit_bells: spiritBellsPort,
  stone_badge: stoneBadgePort,
};
