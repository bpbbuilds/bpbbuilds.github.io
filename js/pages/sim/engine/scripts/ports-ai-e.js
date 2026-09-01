/**
 * Band AI Wave E — skill / spell deepenings (DoubleRainbow / FullBodyProtection /
 * NoRushPlease / Thornburst).
 */

import { grantStun } from '../actor.js';
import {
  giveRandomBuffs,
  grantStacks,
  onBuffChanged,
} from '../buff-economy.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getPName } from '../params.js';
import { addSpeed } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { grantTimedSpeed } from '../timed-speed.js';
import { itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/**
 * DoubleRainbow.gd — onPrepare: buff-amp on gainsBuffs links + holy secondary speed;
 * CD: giveRandomBuffs(1).
 * @type {ScriptHandler}
 */
export const doubleRainbowPort = {
  handlerId: 'double_rainbow',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, events, graph, itemsById, canAffect, pieces } = ctx;
    const amp = Math.max(0, Number(piece.chance) || getPName(piece.params, 'chance', 15));
    const speedPer = getPName(piece.params, 'speed', getP1(piece.params, 35)) / 100;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let holy = 0;
    for (const link of links) {
      const other = (pieces || []).find((p) => p.placementKey === link.key);
      if (!other) continue;
      if (link.color !== 'secondary') {
        // Primary: gainsBuffs → amplify all buffs
        if (amp > 0) {
          other.buffAmpChance = (Number(other.buffAmpChance) || 0) + amp;
        }
      } else if (itemHasType(itemsById.get(other.itemId), 'holy')) {
        holy += 1;
      }
    }
    if (holy > 0 && speedPer > 0) {
      addSpeed(piece, holy * speedPer);
      events.push({
        t: t + 0.01,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name}: +${Math.round(holy * speedPer * 100)}% speed (${holy} holy)`,
        meta: { category: 'adjacency', script: true, handler: 'double_rainbow' },
      });
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events, rng } = ctx;
    events.push({
      t,
      type: 'activate',
      actor: 'player',
      itemId: piece.itemId,
      placementKey: piece.placementKey,
      label: `Skill: ${piece.name}`,
      meta: { category: 'system', script: true, handler: 'double_rainbow' },
    });
    const picked = giveRandomBuffs(player, 1, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'double_rainbow', picked);
    return true;
  },
};

/**
 * Count armor / helmet / shoes on the board (FullBodyProtection.set check).
 * @param {object[]} pieces
 * @param {Map<string, object>} itemsById
 */
function fullBodySetActive(pieces, itemsById) {
  let armor = 0;
  let helmets = 0;
  let shoes = 0;
  for (const p of pieces || []) {
    const item = itemsById.get(p.itemId);
    if (itemHasType(item, 'armor') || p.kind === 'armor') armor += 1;
    else if (itemHasType(item, 'helmet') || itemHasType(item, 'helm')) helmets += 1;
    else if (itemHasType(item, 'shoes') || itemHasType(item, 'boots')) shoes += 1;
  }
  return armor === 1 && helmets === 1 && shoes === 1;
}

/**
 * FullBodyProtection.gd — block-amp on canBlock links; set-complete → flat DR;
 * CD: giveBlock.
 * @type {ScriptHandler}
 */
export const fullBodyProtectionPort = {
  handlerId: 'full_body_protection',
  family: 'unique',
  onCombatStart(piece, ctx) {
    const { t, player, events, graph, itemsById, canAffect, pieces } = ctx;
    const blockAmp =
      getPName(piece.params, 'block', getPName(piece.params, 'blockamp', 20)) / 100;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const other of pieces || []) {
      if (!links.some((l) => l.key === other.placementKey)) continue;
      const canBlock =
        (Number(other.blockGrant) || 0) > 0 ||
        other.kind === 'armor' ||
        other.kind === 'shield' ||
        itemHasType(itemsById.get(other.itemId), 'armor') ||
        itemHasType(itemsById.get(other.itemId), 'shield');
      if (!canBlock || !(blockAmp > 0)) continue;
      other.blockGrant = Math.max(
        0,
        Math.round((Number(other.blockGrant) || 0) * (1 + blockAmp)),
      );
    }
    piece._fbpActive = fullBodySetActive(pieces, itemsById);
    if (piece._fbpActive) {
      const flat = Math.max(
        0,
        Math.round(getPName(piece.params, 'damreduction', getP2(piece.params, 2))),
      );
      if (flat > 0) {
        player.damageReduction = (Number(player.damageReduction) || 0) + flat;
        piece._fbpFlatDr = flat;
        events.push({
          t: t + 0.002,
          type: 'info',
          label: `${piece.name}: set active +${flat} flat DR`,
          meta: { category: 'system', script: true, handler: 'full_body_protection' },
        });
      }
    }
  },
  onCooldownEffect(piece, ctx) {
    const { player } = ctx;
    pushActivate(piece, ctx, 'full_body_protection', `Armor: ${piece.name}`);
    const block = Math.max(
      1,
      Math.round(Number(ctx.itemsById.get(piece.itemId)?.block) || piece.blockGrant || 10),
    );
    grantStacks(player, 'block', block, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    return true;
  },
};

/**
 * NoRushPlease.gd — LeatherHelm timed opp %DR + Cold on combat start.
 * @type {ScriptHandler}
 */
export const noRushPleasePort = {
  handlerId: 'no_rush_please',
  family: 'consumable',
  onCombatStart(piece, ctx) {
    const { t, dummy, player, events, rng } = ctx;
    const dr = Math.max(0, getPName(piece.params, 'damreduction', getP1(piece.params, 10)));
    const dur = Math.max(0.5, getPName(piece.params, 'dur', getP2(piece.params, 3)));
    if (dr > 0) {
      dummy.damageResistancePct = (Number(dummy.damageResistancePct) || 0) + dr;
      grantTimedSpeed(piece, 1e-6, t + dur, 'no_rush_dr');
      const prev = piece._onTimedSpeedEnd;
      piece._onTimedSpeedEnd = (tag, e) => {
        prev?.(tag, e);
        if (tag === 'no_rush_dr') {
          dummy.damageResistancePct = Math.max(
            0,
            (Number(dummy.damageResistancePct) || 0) - dr,
          );
        }
      };
      events.push({
        t: t + 0.001,
        type: 'info',
        label: `${piece.name}: opp +${dr}% DR (${dur}s)`,
        meta: { category: 'system', script: true, handler: 'no_rush_please' },
      });
    }
    const cold = Math.max(1, Math.round(getPName(piece.params, 'cold', 2)));
    gainStacks(dummy, 'cold', cold, { rng, opponent: player });
    events.push({
      t,
      type: 'debuff',
      target: 'dummy',
      amount: cold,
      label: `${piece.name}: +${cold} Cold`,
      meta: { category: 'debuff', stack: 'cold', script: true, handler: 'no_rush_please' },
    });
    pushActivate(piece, ctx, 'no_rush_please', `Skill: ${piece.name}`);
  },
};

/**
 * Thornburst.gd — stun + spikes; limited uses; spikes deltas → speed.
 * @type {ScriptHandler}
 */
export const thornburstPort = {
  handlerId: 'thornburst',
  family: 'unique',
  onCombatStart(piece, ctx) {
    piece._thornUses = Math.max(
      1,
      Math.round(getPName(piece.params, 'max', getPName(piece.params, 'uses', getP2(piece.params, 3)))),
    );
    const spikeSpeed = getPName(piece.params, 'speed', getP3(piece.params, 5)) / 100;
    if (spikeSpeed) {
      onBuffChanged(ctx.player, (ch) => {
        if (ch.stack !== 'spikes' || !ch.amount) return;
        addSpeed(piece, spikeSpeed * ch.amount);
      });
    }
  },
  onCooldownEffect(piece, ctx) {
    const { t, player, events } = ctx;
    pushActivate(piece, ctx, 'thornburst', `Skill: ${piece.name}`);
    const stunDur = Math.max(0.5, getPName(piece.params, 'dur_stun', 1));
    grantStun(ctx.dummy, stunDur, t);
    events.push({
      t: t + 0.002,
      type: 'debuff',
      target: 'dummy',
      amount: 1,
      label: `${piece.name}: Stun (${stunDur}s)`,
      meta: { category: 'debuff', stack: 'stun', script: true, handler: 'thornburst' },
    });
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
      meta: { category: 'buff', stack: 'spikes', script: true, handler: 'thornburst' },
    });
    piece._thornUses = (Number(piece._thornUses) || 1) - 1;
    if (piece._thornUses <= 0) {
      piece.alive = false;
      piece.charges = 0;
    }
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AI_E_PORTS = {
  double_rainbow: doubleRainbowPort,
  full_body_protection: fullBodyProtectionPort,
  no_rush_please: noRushPleasePort,
  thornburst: thornburstPort,
};
