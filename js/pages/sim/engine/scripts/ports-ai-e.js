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
// FullBodyProtection.gd uses giveBuffPower during preparation so linked
// blockers retain their own catalog block value and scale every later grant.
import { giveBuffPower } from '../buff-power.js';
import { affectedTargets } from '../board-graph.js';
import { getP1, getP2, getP3, getP4, getPName } from '../params.js';
import { scaleEffectDuration } from '../effect-duration.js';
import { modifiedParamValue } from '../placement-instance.js';
import { addSpeed } from '../piece-stats.js';
import { gainStacks } from '../stacks.js';
import { grantTimedSpeed } from '../timed-speed.js';
import { afterEffectFinished, itemHasType, pushActivate, pushBuffGrants } from './ports-util.js';

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
  onPrepare(piece, ctx) {
    const { t, events, graph, itemsById, canAffect, pieces } = ctx;
    const amp = Number.isFinite(Number(piece.chance))
      ? Number(piece.chance)
      : getPName(piece.params, 'chance', 15);
    const speedPer = getPName(piece.params, 'speed', getP1(piece.params, 35)) / 100;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    let holy = 0;
    for (const link of links) {
      const other = (pieces || []).find((p) => p.placementKey === link.key);
      if (!other) continue;
      if (link.color !== 'secondary') {
        // Primary: gainsBuffs → amplify all buffs
        const gainsBuffs = Boolean(
          other.gainsBuffs || canAffect?.gainsBuffsIds?.has?.(other.itemId),
        );
        if (gainsBuffs && amp) {
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
    const picked = giveRandomBuffs(player, 1, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    pushBuffGrants(events, piece, player, t, 'double_rainbow', picked);
    pushActivate(piece, ctx, 'double_rainbow', `Skill: ${piece.name}`);
    return true;
  },
};

/**
 * Count armor / helmet / shoes on the board (FullBodyProtection.set check).
 * @param {object[]} pieces
 * @param {Map<string, object>} itemsById
 */
export function fullBodySetActive(pieces, itemsById) {
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
  onPrepare(piece, ctx) {
    const { graph, itemsById, canAffect, pieces } = ctx;
    const blockAmp =
      getPName(piece.params, 'block', getP2(piece.params, 0)) / 100;
    const links = affectedTargets(graph, piece.placementKey, itemsById, canAffect);
    for (const link of links) {
      const other = (pieces || []).find((candidate) => candidate.placementKey === link.key);
      if (!other) continue;
      const item = itemsById.get(other.itemId);
      const canBlock =
        Number(other.blockGrant ?? item?.block) > 0 ||
        other.itemId === 'halberd' ||
        other.itemId === 'stoned';
      if (!canBlock || !(blockAmp > 0)) continue;
      giveBuffPower(other, 'block', blockAmp);
    }
    piece._fbpActive = fullBodySetActive(pieces, itemsById);
    if (!piece._fbpActive || piece._fbpBound) return;
    piece._fbpBound = true;
    ctx.bus?.on?.('pre_take_damage', (payload) => {
      if (payload?.defender !== ctx.player) return;
      const damage = payload.damage;
      const source = damage?.damageSource || payload.source || {};
      if (!damage || (source.isAttack === false && source.isEffectDamage !== true)) return;
      const amount = Math.max(
        0,
        Math.round(getPName(piece.params, 'damreduction', getP1(piece.params, 0))),
      );
      if (!(amount > 0)) return;
      const left = Math.max(
        0,
        (Number(damage.damage) || 0) - (Number(damage.damageReduction) || 0),
      );
      const actual = Math.min(amount, left);
      damage.damageReduction = (Number(damage.damageReduction) || 0) + amount;
      if (actual > 0) {
        damage.reductionSources?.push?.({
          itemId: piece.itemId,
          placementKey: piece.placementKey,
          amount: actual,
        });
      }
    });
  },
  onCooldownEffect(piece, ctx) {
    const { player, itemsById } = ctx;
    const catalogBlock = Number(itemsById.get(piece.itemId)?.block);
    const baseBlock = Number.isFinite(catalogBlock)
      ? catalogBlock
      : Number(piece.blockGrant) || 0;
    const currentBlock = Number(piece.blockGrant);
    const inferredExtra = Number.isFinite(currentBlock)
      ? Math.max(0, currentBlock - baseBlock)
      : 0;
    const explicitExtra = Math.max(0, Number(piece._extraBlock) || 0);
    const block = Math.max(0, Math.round(baseBlock + Math.max(explicitExtra, inferredExtra)));
    if (block > 0) {
      grantStacks(player, 'block', block, {
        originKey: piece.placementKey,
        originId: piece.itemId,
      });
    }
    pushActivate(piece, ctx, 'full_body_protection', `Armor: ${piece.name}`);
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
  onPrepare(piece, ctx) {
    piece._thornUses = Math.trunc(
      getPName(piece.params, 'max', getPName(piece.params, 'uses', getP3(piece.params, 5))),
    );
    const spikeSpeed = getPName(piece.params, 'speed', getP4(piece.params, 5)) / 100;
    if (spikeSpeed) {
      onBuffChanged(ctx.player, (ch) => {
        if (ch.stack !== 'spikes' || !ch.amount) return;
        addSpeed(piece, spikeSpeed * ch.amount);
      });
    }
  },
  onCooldownEffect(piece, ctx) {
    const stunBase = modifiedParamValue(
      piece,
      getPName(piece.params, 'dur_stun', getP1(piece.params, 0.3)),
      'dur_stun',
    );
    const stunDur = scaleEffectDuration(piece, stunBase);
    grantStun(ctx.dummy, stunDur, ctx.t, {
      origin: piece,
      meta: { category: 'debuff', script: true, handler: 'thornburst' },
    });
    const spikes = Math.trunc(getPName(piece.params, 'spikes', getP2(piece.params, 2)));
    grantStacks(ctx.player, 'spikes', spikes, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    piece._thornUses = (Number(piece._thornUses) || 1) - 1;
    if (piece._thornUses === 0) {
      afterEffectFinished(piece, ctx, 'thornburst', {
        label: `Skill: ${piece.name}`,
      });
    } else {
      pushActivate(piece, ctx, 'thornburst', `Skill: ${piece.name}`);
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
