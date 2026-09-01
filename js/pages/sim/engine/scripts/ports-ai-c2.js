/**
 * Band AI Wave C (2/2) — pet deepen from Items/*.gd.
 * Do not mark inventory DEEP here.
 */

import {
  giveAllBuffs,
  giveLeastBuffs,
  grantStacks,
  onBuffChanged,
  BUFF_KEYS,
} from '../buff-economy.js';
import { grantStun, PLAYER_STAMINA_REGEN } from '../actor.js';
import { applyStaminaRegeneration } from '../actor-stats.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { grantTimedSpeed } from '../timed-speed.js';
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
  onCombatStart(piece) {
    piece._roboBaseCd = Number(piece.baseCooldown ?? piece.cooldown) || 0;
  },
  onChargeReceived(piece) {
    // resetBaseCooldown() when charged
    const base = Number(piece._roboBaseCd) || Number(piece.baseCooldown) || 0;
    piece.baseCooldown = base;
    piece.cooldown = base;
  },
  onCooldownEffect(piece, ctx) {
    const luck = Math.max(1, Math.round(getPName(piece.params, 'luck', getP1(piece.params, 1))));
    const heat = Math.max(0, Math.round(getPName(piece.params, 'heat', getP2(piece.params, 1))));
    grantStacks(ctx.player, 'lucky', luck, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (heat > 0) {
      grantStacks(ctx.player, 'heat', heat, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    // .gd: grow base CD only while numCharges == 0
    if ((piece.numCharges || 0) === 0) {
      const grow = Math.max(0, getPName(piece.params, 'cdincrease', 0.5));
      const next = (Number(piece.baseCooldown ?? piece.cooldown) || 0) + grow;
      piece.baseCooldown = next;
      piece.cooldown = next;
    }
    // grantStacks already combat-logs; no summary buff (Lucky meter was double-counting).
    return true;
  },
};

/** Sloth.gd — slow neighbors; start maxHP; awaken/amulet buff+stun. */
/** @type {ScriptHandler} */
export const slothPort = {
  handlerId: 'sloth',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const slow = getPName(piece.params, 'speed', 10) / 100;
    for (const { other } of linkedWith(ctx, piece)) {
      if (other.cooldown > 0 || other.baseCooldown > 0) addSpeed(other, -slow);
    }
    const links = linkedWith(ctx, piece);
    const basePct = getPName(piece.params, 'maxhealth_base', getP1(piece.params, 10));
    const perPct = getPName(piece.params, 'maxhealth_item', getP2(piece.params, 2));
    const pct = (basePct + links.length * perPct) / 100;
    const hp = Math.max(1, Math.round(ctx.player.maxHp * pct));
    ctx.player.maxHp += hp;
    ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + hp);
    ctx.events.push({
      t: ctx.t,
      type: 'heal',
      target: 'player',
      amount: hp,
      label: `${piece.name}: +${hp} max HP`,
      meta: { category: 'heal', script: true, handler: 'sloth' },
    });
    pushActivate(piece, ctx, 'sloth', `Pet: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'sloth', `Pet: ${piece.name}`);
    // Gap: awaken trigger() not wired from history — set piece._awakenNow for big path
    if (piece._awakenNow) {
      piece._awakenNow = false;
      const n = Math.max(1, Math.round(getPName(piece.params, 'buffs', getP3(piece.params, 1))));
      const picked = giveAllBuffs(player, n, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      pushBuffGrants(events, piece, player, t, 'sloth', picked);
      grantStun(ctx.dummy, Math.max(0.5, getPName(piece.params, 'dur_stun', 2)), t);
      piece.alive = false;
      piece.charges = 0;
    } else {
      const n = Math.max(
        1,
        Math.round(getPName(piece.params, 'buffs_amulet', getPName(piece.params, 'buffs', 1))),
      );
      const picked = giveAllBuffs(player, n, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
      pushBuffGrants(events, piece, player, t, 'sloth', picked);
      grantStun(
        ctx.dummy,
        Math.max(
          0.5,
          getPName(piece.params, 'dur_stun_amulet', getPName(piece.params, 'dur_stun', 1)),
        ),
        t,
      );
    }
    return true;
  },
};

/** ThornElemental.gd — spikes limit/crit prepare; CD spikes. */
/** @type {ScriptHandler} */
export const thornElementalPort = {
  handlerId: 'thorn_elemental',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const lim = getPName(piece.params, 'spikedam', 100) / 100;
    ctx.player.meleeSpikesLimit = Math.max(Number(ctx.player.meleeSpikesLimit) || 0, lim);
    // Gap: rangedSpikesLimit + spikes-crit not in takeDamage (spikes canCrit:false)
    const natureN = linkedWith(ctx, piece, (o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'nature'),
    ).length;
    const crit = (Number(piece.chance) || getPName(piece.params, 'chance', 5)) * natureN;
    if (crit) ctx.player._spikesCritChance = (Number(ctx.player._spikesCritChance) || 0) + crit;
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'thorn_elemental', `Pet: ${piece.name}`);
    const spikes = Math.max(1, Math.round(getPName(piece.params, 'spikes', getP1(piece.params, 2))));
    grantStacks(player, 'spikes', spikes, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: spikes,
      label: `${piece.name}: +${spikes} Spikes`,
      meta: { category: 'buff', stack: 'spikes', script: true, handler: 'thorn_elemental' },
    });
    return true;
  },
};

/** Turtle.gd — LeatherHelm DR timer; shield damblock; CD block+%maxHP. */
/** @type {ScriptHandler} */
export const turtlePort = {
  handlerId: 'turtle',
  family: 'pet_like',
  onCombatStart(piece, ctx) {
    const extra = getPName(piece.params, 'bonus_damblock', 10) / 100;
    for (const { other } of linkedWith(ctx, piece, (o) =>
      itemHasType(ctx.itemsById.get(o.itemId), 'shield'),
    )) {
      // Gap: modifyParam damblock unsupported — boost shield blockGrant as proxy
      other.blockGrant = Math.max(
        0,
        Math.round((Number(other.blockGrant) || 0) * (1 + extra) + extra * 5),
      );
    }
    const dr = Math.max(0, getP1(piece.params, 10));
    if (dr) {
      ctx.player.damageResistancePct = (Number(ctx.player.damageResistancePct) || 0) + dr;
      // .gd also applies damReduction to opponent — skipped (would tank dummy)
      const dur = Math.max(0.5, getPName(piece.params, 'dur', 3));
      grantTimedSpeed(piece, 1e-6, ctx.t + dur, 'turtle_dr');
      const prev = piece._onTimedSpeedEnd;
      piece._onTimedSpeedEnd = (tag, e) => {
        prev?.(tag, e);
        if (tag === 'turtle_dr') {
          ctx.player.damageResistancePct = Math.max(
            0,
            (Number(ctx.player.damageResistancePct) || 0) - dr,
          );
        }
      };
    }
    pushActivate(piece, ctx, 'turtle', `Pet: ${piece.name}`);
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'turtle', `Pet: ${piece.name}`);
    const frac =
      getPName(piece.params, 'block2', getPName(piece.params, 'maxhealthblock', 5)) / 100;
    const block =
      Math.max(1, Math.round(piece.blockGrant || getP2(piece.params, 4))) +
      Math.round(player.maxHp * frac);
    gainStacks(player, 'block', block);
    events.push({
      t: t + 0.004,
      type: 'buff',
      target: 'player',
      amount: block,
      label: `${piece.name}: +${block} Block`,
      meta: { category: 'buff', stack: 'block', script: true, handler: 'turtle' },
    });
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
  sloth: slothPort,
  thorn_elemental: thornElementalPort,
  turtle: turtlePort,
  wolpertinger: wolpertingerPort,
};
