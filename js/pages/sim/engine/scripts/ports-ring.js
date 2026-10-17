/**
 * MagicRing.gd / SuperiorRing — random trigger+stack slots, then Start / Every /
 * PlayerLow / OppoLow apply the scaled catalog amounts.
 */

import { grantStacks } from '../buff-economy.js';
import { getPName } from '../params.js';
import { randInt } from '../rng.js';
import { pushActivate } from './ports-util.js';
import { RING_STACKS, ringEffectCount, ringEffectsFromPersistent } from '../../../../shared/ring-config.js';

const BUFFS = new Set([
  'lucky',
  'regeneration',
  'spikes',
  'mana',
  'heat',
  'vampirism',
  'empower',
]);

const RING_STACK_TYPES = {
  lucky: 'nature',
  spikes: 'nature',
  regeneration: 'holy',
  heat: 'fire',
  vampirism: 'vampiric',
  empower: 'holy',
  mana: 'magic',
  blind: 'dark',
  cold: 'ice',
  poison: 'nature',
};

/** MagicRing.gd getTypes() adds one runtime type per distinct rolled stack type. */
function exposeRingTypes(piece, effects) {
  const ringTypes = [];
  for (const effect of effects || []) {
    const type = RING_STACK_TYPES[effect.stack];
    if (type && !ringTypes.includes(type)) ringTypes.push(type);
  }
  piece._ringDynamicTypes = ringTypes;
  const existing = Array.isArray(piece._dynamicTypes) ? piece._dynamicTypes : [];
  piece._dynamicTypes = [...new Set([...existing, ...ringTypes])];
}

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
  if (Array.isArray(piece._ringEffects)) {
    exposeRingTypes(piece, piece._ringEffects);
    return piece._ringEffects;
  }
  const configured = piece.persistent;
  const hasPersistent =
    configured &&
    typeof configured === 'object' &&
    (Array.isArray(configured.effects) ||
      (Object.prototype.hasOwnProperty.call(configured, 'magicRing') &&
        Number.isFinite(Number(configured.magicRing)) &&
        Number(configured.magicRing) >= 0));
  if (hasPersistent) {
    const effects = ringEffectsFromPersistent(configured, piece.itemId);
    if (effects.length === ringEffectCount(piece.itemId)) {
      piece._ringEffects = effects;
      exposeRingTypes(piece, effects);
      return effects;
    }
  }
  const configuredCount = Number(getPName(piece.params, 'effects', 2));
  const n = Number.isFinite(configuredCount) ? Math.max(0, Math.trunc(configuredCount)) : 0;
  const effects = [];
  for (let i = 0; i < n; i++) {
    effects.push({
      trigger: randInt(0, 3, ctx.rng),
      stack: RING_STACKS[randInt(0, RING_STACKS.length - 1, ctx.rng)],
    });
  }
  piece._ringEffects = effects;
  exposeRingTypes(piece, effects);
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
    const isBuff = BUFFS.has(e.stack);
    if (amount) {
      grantStacks(isBuff ? ctx.player : ctx.dummy, e.stack, amount, {
        originKey: piece.placementKey,
        originId: piece.itemId,
        rng: ctx.rng,
        opponent: isBuff ? ctx.dummy : ctx.player,
      });
    }
    // MagicRing.gd activates inside giveStacksFromEffect(), so multiple effects
    // sharing one trigger produce one activation each, even when an amount is 0.
    pushActivate(piece, ctx, piece.itemId, `Accessory: ${piece.name}`);
  }
}

/**
 * @param {string} id
 * @returns {import('./handlers.js').ScriptHandler}
 */
export function makeRingPort(id) {
  const bindTriggers = (piece, ctx) => {
    // The production simulator uses character_damaged. Keep the legacy
    // convenience signals wired as aliases for direct handler callers and old
    // smoke fixtures; one-shot flags make the aliases idempotent.
    if (ctx.bus && piece._ringBoundBus === ctx.bus) {
      piece._ringPlayerLow = false;
      piece._ringOppoLow = false;
      return;
    }
    piece._ringBoundBus = ctx.bus;
    rollEffects(piece, ctx);
    piece._ringPlayerLow = false;
    piece._ringOppoLow = false;

    const playerDamaged = (payload = {}) => {
      if (piece._ringPlayerLow) return;
      const rel = ctx.player.maxHp > 0 ? ctx.player.hp / ctx.player.maxHp : 1;
      if (rel < getPName(piece.params, 'healtht', 50) / 100) {
        piece._ringPlayerLow = true;
        applyTrigger(piece, ctx, 2);
      }
    };
    const opponentDamaged = (payload = {}) => {
      if (piece._ringOppoLow) return;
      const rel = ctx.dummy.maxHp > 0 ? ctx.dummy.hp / ctx.dummy.maxHp : 1;
      if (rel < getPName(piece.params, 'healtht_opp', 70) / 100) {
        piece._ringOppoLow = true;
        applyTrigger(piece, ctx, 3);
      }
    };

    ctx.bus?.on?.('character_damaged', (payload) => {
      if (payload?.actor === ctx.player) playerDamaged(payload);
      else if (payload?.actor === ctx.dummy) opponentDamaged(payload);
    });
    // Compatibility with pre-priority simulator tests that emitted the
    // player-only convenience signal without an actor field.
    ctx.bus?.on?.('player_damaged', playerDamaged);
    // MagicRing.gd observes the opponent's character_damaged signal. Older
    // direct tests represented that hit through piece_dealt_damage instead.
    ctx.bus?.on?.('piece_dealt_damage', (payload) => {
      if (payload?.hit?.hit === false) return;
      opponentDamaged(payload);
    });
  };

  return {
    handlerId: id,
    family: 'unique',
    onPrepare(piece, ctx) {
      bindTriggers(piece, ctx);
    },
    // Legacy alias: older callers invoked ring preparation from
    // preCombatStart before the shared prepare pass was introduced.
    onPreCombatStart(piece, ctx) {
      bindTriggers(piece, ctx);
    },
    onCombatStart(piece, ctx) {
      rollEffects(piece, ctx);
      applyTrigger(piece, ctx, 0);
    },
    onCooldownEffect(piece, ctx) {
      applyTrigger(piece, ctx, 1);
      return true;
    },
  };
}

export const magicRingPort = makeRingPort('magic_ring');
export const superiorRingPort = makeRingPort('superior_ring');
