/**
 * MagicRing.gd / SuperiorRing — random trigger+stack slots, then Start / Every /
 * PlayerLow / OppoLow apply the scaled catalog amounts.
 */

import { grantStacks } from '../buff-economy.js';
import { getPName } from '../params.js';
import { randInt } from '../rng.js';
import { pushActivate } from './ports-util.js';

const RING_STACKS = [
  'lucky',
  'regeneration',
  'spikes',
  'mana',
  'heat',
  'vampirism',
  'empower',
  'poison',
  'blind',
  'cold',
];

const BUFFS = new Set([
  'lucky',
  'regeneration',
  'spikes',
  'mana',
  'heat',
  'vampirism',
  'empower',
]);

/** @param {Record<string, number>} params @param {string} stack @param {number} triggerType */
function scaledAmount(params, stack, triggerType) {
  const scale = getPName(params, `scale${triggerType + 1}`, 1);
  return Math.max(0, Math.round(getPName(params, stack, 0) * scale));
}

/**
 * @param {object} piece
 * @param {{ rng: () => number }} ctx
 */
function rollEffects(piece, ctx) {
  if (Array.isArray(piece._ringEffects)) return piece._ringEffects;
  const n = Math.max(1, Math.round(getPName(piece.params, 'effects', 2)));
  const effects = [];
  for (let i = 0; i < n; i++) {
    effects.push({
      trigger: randInt(0, 3, ctx.rng),
      stack: RING_STACKS[randInt(0, RING_STACKS.length - 1, ctx.rng)],
    });
  }
  piece._ringEffects = effects;
  return effects;
}

/**
 * @param {object} piece
 * @param {object} ctx
 * @param {number} triggerType
 */
function applyTrigger(piece, ctx, triggerType) {
  const effects = (piece._ringEffects || []).filter((e) => e.trigger === triggerType);
  for (const e of effects) {
    const amount = scaledAmount(piece.params, e.stack, triggerType);
    if (!amount) continue;
    const isBuff = BUFFS.has(e.stack);
    grantStacks(isBuff ? ctx.player : ctx.dummy, e.stack, amount, {
      originKey: piece.placementKey,
      originId: piece.itemId,
      rng: ctx.rng,
      opponent: isBuff ? ctx.dummy : ctx.player,
    });
  }
  if (effects.length) pushActivate(piece, ctx, piece.itemId, `Accessory: ${piece.name}`);
}

/**
 * @param {string} id
 * @returns {import('./handlers.js').ScriptHandler}
 */
export function makeRingPort(id) {
  return {
    handlerId: id,
    family: 'unique',
    onPreCombatStart(piece, ctx) {
      rollEffects(piece, ctx);
      piece._ringPlayerLow = false;
      piece._ringOppoLow = false;
    },
    onCombatStart(piece, ctx) {
      rollEffects(piece, ctx);
      applyTrigger(piece, ctx, 0);
      const healtht = getPName(piece.params, 'healtht', 50) / 100;
      const healthtOpp = getPName(piece.params, 'healtht_opp', 70) / 100;
      ctx.bus?.on?.('player_damaged', () => {
        if (piece._ringPlayerLow) return;
        const rel = ctx.player.maxHp > 0 ? ctx.player.hp / ctx.player.maxHp : 1;
        if (rel < healtht) {
          piece._ringPlayerLow = true;
          applyTrigger(piece, ctx, 2);
        }
      });
      ctx.bus?.on?.('piece_dealt_damage', () => {
        if (piece._ringOppoLow) return;
        const rel = ctx.dummy.maxHp > 0 ? ctx.dummy.hp / ctx.dummy.maxHp : 1;
        if (rel < healthtOpp) {
          piece._ringOppoLow = true;
          applyTrigger(piece, ctx, 3);
        }
      });
    },
    onCooldownEffect(piece, ctx) {
      applyTrigger(piece, ctx, 1);
      return true;
    },
  };
}

export const magicRingPort = makeRingPort('magic_ring');
export const superiorRingPort = makeRingPort('superior_ring');
