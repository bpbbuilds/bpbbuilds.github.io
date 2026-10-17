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
import { applyHealEfficiency, applyUnhealing } from '../actor-stats.js';
import { affectedTargets } from '../board-graph.js';
import { chargeEnterSchedule, buildScriptChargePath } from '../charge-path.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { modifiedParamValue } from '../placement-instance.js';
import { addSpeed } from '../piece-stats.js';
import { rollPercent } from '../rng.js';
import { getStackAmount } from '../stacks.js';
import { grantTimedResistancePct } from '../timed-resistance.js';
import { giveTempMaxHp } from './ports-ap-start.js';
import { itemHasType, afterEffectFinished, pushActivate, pushBuffGrants } from './ports-util.js';
import { eventSideForPiece } from '../vs-board.js';

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
export function multiplyBuffsLimit(actor, fraction, limit, opts = {}) {
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
  onPrepare(piece, ctx) {
    const healAmp = getPName(piece.params, 'healamp', getP1(piece.params, 10)) / 100;
    if (healAmp) {
      applyHealEfficiency(ctx.player, healAmp, ctx, piece);
    }
  },
  onCombatStart(piece, ctx) {
    const { t, player, events } = ctx;
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
  onPrepare(piece, ctx) {
    const { graph, itemsById, canAffect, player } = ctx;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    const speed = getPName(piece.params, 'darkspeed', getP1(piece.params, 20)) / 100;
    if (links.length && speed) addSpeed(piece, links.length * speed);
    piece._hodActivated = false;
    const need = Math.trunc(getPName(piece.params, 'regent', getP2(piece.params, 7)));
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
      const reactionCtx = { ...ctx, t: Number(player._simT) || ctx.t };
      const hp = Math.trunc(getPName(piece.params, 'maxhealth', getP3(piece.params, 100)));
      giveTempMaxHp(piece, reactionCtx, 'heart_of_darkness', hp);
      const emp = Math.trunc(getPName(piece.params, 'empower', 4));
      grantStacks(player, 'empower', emp, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      const unh = getPName(piece.params, 'healreduction', 40) / 100;
      if (unh) applyUnhealing(ctx.dummy, unh, reactionCtx, piece);
      pushActivate(piece, ctx, 'heart_of_darkness', `Accessory: ${piece.name} filled`);
    });
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, dummy, events, rng } = ctx;
    const num = Math.trunc(
      getPName(piece.params, 'buffsteal', getPName(piece.params, 'steal', getP3(piece.params, 2))),
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
    // HeartofDarkness.gd steals its buffs before activating.
    pushActivate(piece, ctx, 'heart_of_darkness', `Accessory: ${piece.name}`);
    return true;
  },
};

const MANA_CRYSTAL_CHARGE_CELLS = [
  [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -2, y: 0 }, { x: -3, y: 0 }],
  [{ x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: -2 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
];

/** ManaCrystal.gd sendCharge for one of its four explicit directional paths. */
function emitManaCrystalCharge(piece, ctx, speedFactor = 1) {
  const { t, events, player, graph, itemsById, pieces } = ctx;
  const item = itemsById.get(piece.itemId);
  const boardPiece = graph?.pieces?.get(piece.placementKey);
  if (!item || !boardPiece) return;
  const mana1 = Number(getPName(piece.params, 'mana1', getP1(piece.params, 1)));
  const mana2 = Number(getPName(piece.params, 'mana2', getP2(piece.params, 2)));
  const rawDur = Number(getPName(piece.params, 'dur', getP3(piece.params, 2)));
  const durPerTile = Number.isFinite(rawDur) ? rawDur / Math.max(0.01, Number(speedFactor) || 1) : 2;
  const actor = eventSideForPiece(piece);
  const placement = { x: boardPiece.x, y: boardPiece.y, r: boardPiece.r, key: piece.placementKey };

  for (let i = 0; i < MANA_CRYSTAL_CHARGE_CELLS.length; i += 1) {
    const pathId = `mana-crystal:${piece.placementKey}:${t}:${i}`;
    const path = buildScriptChargePath({
      pathId,
      item,
      placement,
      startT: t,
      collisionCells: MANA_CRYSTAL_CHARGE_CELLS[i],
      refCollision: { x: 0, y: 0 },
      durPerTile,
    });
    if (!path) continue;
    for (const cell of path.cells) {
      const targetKey = graph.filled.get(cell.cell) || null;
      cell.targetKey = targetKey && targetKey !== piece.placementKey ? targetKey : null;
    }
    events.push({
      t,
      type: 'charge',
      actor,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: emitCharge`,
      meta: { category: 'charge', phase: 'start', pathId, chargePath: path, handler: 'mana_crystal' },
    });

    let lastKey = null;
    for (const step of chargeEnterSchedule(path.cells.length, durPerTile)) {
      const cell = path.cells[step.cellIndex];
      const targetKey = cell?.targetKey || null;
      const target = targetKey ? pieces?.find((candidate) => candidate.placementKey === targetKey) : null;
      const enterT = t + (step.enterT || 0);
      if (targetKey !== lastKey) {
        if (lastKey) {
          const previous = pieces?.find((candidate) => candidate.placementKey === lastKey);
          if (previous) {
            previous.pendingChargeLeaves = previous.pendingChargeLeaves || [];
            previous.pendingChargeLeaves.push({
              at: enterT,
              meta: { pathId, cellIndex: step.cellIndex, emitterKey: piece.placementKey },
            });
          }
        }
        if (target) {
          target.pendingCharges = target.pendingCharges || [];
          target.pendingCharges.push({
            at: enterT,
            meta: { pathId, cellIndex: step.cellIndex, emitterKey: piece.placementKey },
          });
          const targetItem = itemsById.get(target.itemId);
          const amount = itemHasType(targetItem, 'magic') ? mana2 : mana1;
          if (Number.isFinite(amount)) {
            grantStacks(player, 'mana', amount, {
              originKey: piece.placementKey,
              originId: piece.itemId,
            });
            if (amount) {
              events.push({
                t: enterT,
                type: 'buff',
                target: actor,
                amount,
                label: `${piece.name}: +${amount} Mana (${target.name})`,
                meta: { category: 'buff', stack: 'mana', script: true, handler: 'mana_crystal' },
              });
            }
          }
        }
        lastKey = targetKey;
      }
      events.push({
        t: enterT,
        type: 'charge',
        actor,
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: target ? `${piece.name}: charge → ${target.name}` : `${piece.name}: charge cell`,
        meta: {
          category: 'charge',
          phase: step.cellIndex >= path.cells.length ? 'end' : 'cell',
          pathId,
          cellIndex: step.cellIndex,
          cell: cell?.cell,
          targetKey: targetKey || undefined,
          handler: 'mana_crystal',
        },
      });
    }
    if (lastKey) {
      const previous = pieces?.find((candidate) => candidate.placementKey === lastKey);
      if (previous) {
        previous.pendingChargeLeaves = previous.pendingChargeLeaves || [];
        previous.pendingChargeLeaves.push({
          at: t + path.duration,
          meta: { pathId, cellIndex: path.cells.length, emitterKey: piece.placementKey },
        });
      }
    }
    events.push({
      t: t + path.duration,
      type: 'charge',
      actor,
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `${piece.name}: charge end`,
      meta: { category: 'charge', phase: 'end', pathId, handler: 'mana_crystal' },
    });
  }
}

export const manaCrystalPort = {
  handlerId: 'mana_crystal',
  family: 'unique',
  emitCharge(piece, ctx, speedFactor = 1) {
    pushActivate(piece, ctx, 'mana_crystal', `Accessory: ${piece.name}`);
    emitManaCrystalCharge(piece, ctx, speedFactor);
  },
  onCooldownEffect(piece, ctx) {
    manaCrystalPort.emitCharge(piece, ctx);
    ctx.bus?.emit?.('charge_emitted', { piece, t: ctx.t });
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
  onPrepare(piece, ctx) {
    const rawChance = piece.chance ?? ctx.itemsById?.get?.(piece.itemId)?.chance;
    const chance = Number.isFinite(Number(rawChance)) ? Number(rawChance) : 0;
    ctx.player.critResistance = (Number(ctx.player.critResistance) || 0) + chance;
    ctx.player.stunResistance = (Number(ctx.player.stunResistance) || 0) + chance;
    piece._spiritBellsPrepared = true;
  },
  onPreCombatStart(piece, ctx) {
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
    const durBase = modifiedParamValue(
      piece,
      getPName(piece.params, 'dur_base', getP2(piece.params, 2)),
      'dur_base',
    );
    const durBonus = modifiedParamValue(
      piece,
      getPName(piece.params, 'dur_bonus', getP3(piece.params, 1)),
      'dur_bonus',
    );
    const dur = durBase + durBonus * distinct.size;
    piece._spiritBellsDuration = dur;
    const dr = getPName(piece.params, 'damreduction', getP1(piece.params, 30));
    if (dr && dur > 0) {
      const tag = `spirit_bells:${piece.placementKey || piece.itemId}`;
      piece._spiritBellsBuffsActive = (Number(piece._spiritBellsBuffsActive) || 0) + 1;
      piece.state = piece._spiritBellsBuffsActive;
      const previous = player._onTimedResistEnd;
      player._onTimedResistEnd = (endedTag, entry) => {
        previous?.(endedTag, entry);
        if (endedTag !== tag) return;
        piece._spiritBellsBuffsActive = Math.max(
          0,
          (Number(piece._spiritBellsBuffsActive) || 1) - 1,
        );
        piece.state = piece._spiritBellsBuffsActive;
      };
      grantTimedResistancePct(player, dr, (Number(t) || 0) + dur, tag);
      events.push({
        t: t + 0.002,
        type: 'info',
        label: `${piece.name}: −${dr}% dmg ${dur.toFixed(1)}s (${distinct.size} pets)`,
        meta: { category: 'system', script: true, handler: 'spirit_bells' },
      });
    }
  },
  onCombatStart(piece, ctx) {
    pushActivate(piece, ctx, 'spirit_bells', `Accessory: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    const frac = getPName(piece.params, 'buffs', getP1(piece.params, 30)) / 100;
    const granted = multiplyBuffsLimit(player, frac, 1000, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'spirit_bells', granted);
    afterEffectFinished(piece, ctx, 'spirit_bells', {
      label: `Accessory: ${piece.name}`,
    });
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
    const catalogBlock = Number(ctx.itemsById?.get?.(piece.itemId)?.block);
    const baseBlock = Number.isFinite(Number(piece.blockGrant))
      ? Number(piece.blockGrant)
      : Number.isFinite(catalogBlock)
        ? catalogBlock
        : getPName(piece.params, 'block', getP1(piece.params, 0));
    const block = Math.max(0, Math.round(baseBlock));
    grantStacks(player, 'block', block, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushActivate(piece, ctx, 'stone_badge', `Badge: ${piece.name}`);
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
