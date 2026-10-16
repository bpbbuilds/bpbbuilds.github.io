/**
 * Band AI Wave C (2/2) — pet deepen from Items/*.gd.
 * Do not mark inventory DEEP here.
 */

import {
  giveLeastBuffs,
  grantStacks,
  onBuffChanged,
  BUFF_KEYS,
} from '../buff-economy.js';
import { PLAYER_STAMINA_REGEN } from '../actor.js';
import { applyStaminaRegeneration } from '../actor-stats.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { modifiedParamValue } from '../placement-instance.js';
import { grantTimedResistancePct } from '../timed-resistance.js';
import { eventSideForPiece } from '../vs-board.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';
import { linkedWith } from './ports-ai-c-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/** Robodog.gd — Lucky+Heat; uncharged CD grows baseCooldown; charge resets. */
/** @type {ScriptHandler} */
export const robodogPort = {
  handlerId: 'robodog',
  family: 'custom_cd',
  onPrepare(piece) {
    // Robodog.gd starts with its charged-state visuals disabled.
    piece._roboCharged = false;
  },
  onCombatStart(piece) {
    piece._roboBaseCd = Number(piece.baseCooldown ?? piece.cooldown) || 0;
  },
  onChargeReceived(piece) {
    // resetBaseCooldown() when charged
    const base = Number(piece._roboBaseCd) || Number(piece.baseCooldown) || 0;
    piece.baseCooldown = base;
    piece.cooldown = base;
    if (Number(piece.numCharges) === 1) piece._roboCharged = true;
  },
  onChargeLeft(piece) {
    if (Number(piece.numCharges) === 0) piece._roboCharged = false;
  },
  onCooldownEffect(piece, ctx) {
    const luck = Math.max(0, Math.trunc(getPName(piece.params, 'luck', getP1(piece.params, 0))));
    const heat = Math.max(0, Math.trunc(getPName(piece.params, 'heat', getP2(piece.params, 0))));
    if (luck > 0) {
      grantStacks(ctx.player, 'lucky', luck, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    if (heat > 0) {
      grantStacks(ctx.player, 'heat', heat, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    // .gd: grow base CD only while numCharges == 0
    if ((piece.numCharges || 0) === 0) {
      const grow = Math.max(0, getPName(piece.params, 'cdincrease', getP3(piece.params, 0)));
      const next = (Number(piece.baseCooldown ?? piece.cooldown) || 0) + grow;
      piece.baseCooldown = next;
      piece.cooldown = next;
      pushActivate(piece, ctx, 'robodog', `Pet: ${piece.name}`);
    }
    // grantStacks already combat-logs; activation is only emitted for the source's
    // uncharged branch (Lucky/Heat still happen on every cooldown).
    return true;
  },
};

/** Sloth lives in ports-threshold.js (Exclusive/Sloth.gd). */

/** ThornElemental.gd — spikes limit/crit prepare; CD spikes. */
/** @type {ScriptHandler} */
export const thornElementalPort = {
  handlerId: 'thorn_elemental',
  family: 'pet_like',
  onPrepare(piece, ctx) {
    const lim = getPName(piece.params, 'spikedam', 100) / 100;
    ctx.player.effectSpikesLimit = (Number(ctx.player.effectSpikesLimit) || 0) + lim;
    ctx.player.rangedSpikesLimit = (Number(ctx.player.rangedSpikesLimit) || 0) + lim;
    const natureN = linkedWith(ctx, piece, (o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'nature'),
    ).length;
    const crit = (Number(piece.chance) || getPName(piece.params, 'chance', 5)) * natureN;
    if (crit) ctx.player._spikesCritChance = (Number(ctx.player._spikesCritChance) || 0) + crit;
  },
  onCooldownEffect(piece, ctx) {
    const spikes = Math.trunc(getPName(piece.params, 'spikes', getP1(piece.params, 2)));
    grantStacks(ctx.player, 'spikes', spikes, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushActivate(piece, ctx, 'thorn_elemental', `Pet: ${piece.name}`);
    return true;
  },
};

/** Turtle.gd — LeatherHelm DR timer; shield damblock; CD block+%maxHP. */
/** @type {ScriptHandler} */
export const turtlePort = {
  handlerId: 'turtle',
  family: 'pet_like',
  onPrepare(piece, ctx) {
    const extra = getP2(piece.params, 0) / 100;
    for (const { other } of linkedWith(ctx, piece, (o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'shield'),
    )) {
      const prior = Number(other.paramMult?.damblock);
      const multiplier = Number.isFinite(prior) && prior !== 0 ? prior : 1;
      other.paramMult = { ...(other.paramMult || {}), damblock: multiplier + extra };
    }
  },
  onPreCombatStart(piece, ctx) {
    const dr = Number(getP1(piece.params, 0)) || 0;
    if (!dr) return;
    const duration = modifiedParamValue(
      piece,
      getPName(piece.params, 'dur', getP3(piece.params, 0)),
      'dur',
    );
    const untilT = (Number(ctx.t) || 0) + duration;
    const tag = `turtle:${piece.placementKey || piece.itemId}`;
    grantTimedResistancePct(ctx.player, dr, untilT, `${tag}:owner`);
    grantTimedResistancePct(ctx.dummy, dr, untilT, `${tag}:opponent`);
  },
  onCombatStart(piece, ctx) {
    pushActivate(piece, ctx, 'turtle', `Pet: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    const catalog = ctx.itemsById.get(piece.itemId);
    const baseBlock = Number.isFinite(Number(piece.blockGrant))
      ? Number(piece.blockGrant)
      : Number(catalog?.block) || 0;
    const maxHealthBlock = getP4(piece.params, 0) / 100;
    const block = Math.max(0, Math.round(baseBlock + player.maxHp * maxHealthBlock));
    if (block > 0) {
      gainStacks(player, 'block', block);
      events.push({
        t: t + 0.004,
        type: 'buff',
        target: eventSideForPiece(piece),
        amount: block,
        label: `${piece.name}: +${block} Block`,
        meta: { category: 'buff', stack: 'block', script: true, handler: 'turtle' },
      });
    }
    pushActivate(piece, ctx, 'turtle', `Pet: ${piece.name}`);
    return true;
  },
};

/** Wolpertinger.gd — pet speed; stamina-regen on buff change; least buffs CD. */
/** @type {ScriptHandler} */
export const wolpertingerPort = {
  handlerId: 'wolpertinger',
  family: 'pet_like',
  onPreCombatStart(piece, ctx) {
    const { player } = ctx;
    // Game onPrepare: getP1() * character().baseStaminaRegen / 100 — not live regen after malus.
    const perBuff = (getP1(piece.params, 0.7) / 100) * PLAYER_STAMINA_REGEN;
    if (!(perBuff > 0)) return;
    const origin = {
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      name: piece.name,
    };
    onBuffChanged(player, (ch) => {
      // Game: no amount>0 guard — spends also reduce stamina regen.
      if (!ch.amount || !BUFF_KEYS.includes(String(ch.stack))) return;
      applyStaminaRegeneration(player, ch.amount * perBuff, ctx, origin);
    });
  },
  onCombatStart(piece, ctx) {
    const { t, events } = ctx;
    const pets = linkedWith(ctx, piece, (o) => {
      const item = ctx.itemsById.get(o.itemId);
      return o.kind === 'pet' || itemHasType(item, 'pet');
    });
    const speedPct = getP3(piece.params, 15) / 100;
    if (pets.length && speedPct) {
      addSpeed(piece, pets.length * speedPct);
      events.push({
        t: t + 0.01,
        type: 'info',
        label: `${piece.name}: +${Math.round(pets.length * speedPct * 100)}% speed (${pets.length} pets)`,
        meta: { category: 'adjacency', script: true, handler: 'wolpertinger' },
      });
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    pushActivate(piece, ctx, 'wolpertinger', `Pet: ${piece.name}`);
    const num = Math.max(1, Math.round(getP2(piece.params, 3)));
    const picked = giveLeastBuffs(player, num, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'wolpertinger', picked);
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const WAVE_AI_C_PORTS_B = {
  robodog: robodogPort,
  thorn_elemental: thornElementalPort,
  turtle: turtlePort,
  wolpertinger: wolpertingerPort,
};
