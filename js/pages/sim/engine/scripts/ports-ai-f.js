/**
 * Band AI Wave F — katana (RibSaw + buff strip) / relic_case (inside staminaFactor).
 */

import {
  BUFF_KEYS,
  removeMostBuffs,
} from '../buff-economy.js';
import { getItemsInside } from '../board-graph.js';
import { getP1, getP2, getPName } from '../params.js';
import {
  addBonusDamage,
  addBonusDamageFactor,
  multiplyStaminaCost,
  purgeBonusDamage,
} from '../piece-stats.js';
import { getStackAmount } from '../stacks.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { weaponStrike } from './ports-wave-c-util.js';
import { itemHasType, pushActivate } from './ports-util.js';

/**
 * @typedef {import('./handlers.js').ScriptHandler} ScriptHandler
 */

/**
 * Item.changeStaminaFactor — GD divides amount by 100; `frac` is already fraction.
 * @param {object} other
 * @param {number} frac
 */
function changeStaminaFactor(other, frac) {
  multiplyStaminaCost(other, frac);
}

/**
 * Sum Game.getBuffs()-style stacks on actor.
 * @param {import('../actor.js').SimActor} actor
 */
function getBuffStacks(actor) {
  let n = 0;
  for (const k of BUFF_KEYS) n += getStackAmount(actor, /** @type {any} */ (k));
  return n;
}

/**
 * Katana.gd — RibSaw on-hit purge + self bonusdam; if opp buffs ≥ buffst, strip most.
 * @type {ScriptHandler}
 */
export const katanaPort = {
  handlerId: 'katana',
  family: 'on_hit',
  onPrepare(piece, ctx) {
    // Katana extends RibSawBlade.gd, so it inherits the same prepare-time
    // opponent weapon snapshot before its own buff-strip reaction runs.
    piece._ribOppWeapons = (ctx.allPieces || []).filter((other) => {
      if (!other || other === piece || other.side === piece.side) return false;
      const item = ctx.itemsById?.get?.(other.itemId);
      if (!itemHasType(item, 'weapon')) return false;
      return Number(item.damageMin) > 0 || itemHasType(item, 'lifesteal');
    });
  },
  onCooldownEffect(piece, ctx) {
    return weaponStrike(piece, ctx, 'katana');
  },
  onDealtDamage(piece, ctx, hit) {
    if (!hit?.hit) return;
    const { t, dummy, events, rng } = ctx;
    const removeDam = Math.max(
      0,
      Math.round(getPName(piece.params, 'dam', getP1(piece.params, 1))),
    );
    const bonusDam = Math.max(
      0,
      Math.round(getPName(piece.params, 'bonusdam', getP2(piece.params, 1))),
    );
    let purged = 0;
    for (const w of piece._ribOppWeapons || []) {
      purged += purgeBonusDamage(w, removeDam);
    }
    if (bonusDam) addBonusDamage(piece, bonusDam);
    if (purged > 0 || bonusDam > 0) {
      events.push({
        t: t + 0.007,
        type: 'info',
        label: `${piece.name}: RibSaw +${bonusDam} dmg${purged ? ` (purged ${purged})` : ''}`,
        meta: { category: 'weapon', script: true, handler: 'katana' },
      });
    }

    const need = Math.max(1, Math.round(getPName(piece.params, 'buffst', getP1(piece.params, 5))));
    const strip = Math.max(1, Math.round(getPName(piece.params, 'buffs', getP2(piece.params, 2))));
    if (getBuffStacks(dummy) < need) return;
    const removed = removeMostBuffs(dummy, strip, rng, {
      originKey: piece.placementKey,
      originId: piece.itemId,
    });
    if (removed?.spent) {
      events.push({
        t: t + 0.009,
        type: 'buff',
        target: 'dummy',
        amount: -removed.spent,
        label: `${piece.name}: −${removed.spent} ${removed.stack}`,
        meta: {
          category: 'buff',
          stack: removed.stack,
          script: true,
          handler: 'katana',
        },
      });
    }
  },
};

/**
 * RelicCase.gd — inside weapons: bonusdam factor + staminaFactor reduction.
 * @type {ScriptHandler}
 */
export const relicCasePort = {
  handlerId: 'relic_case',
  family: 'unique',
  onCooldownEffect(piece, ctx) {
    const { t, events, graph, pieces } = ctx;
    // RelicCase.gd uses getP("bonusdam") / 100 and getP("stamina") exactly;
    // keep the named source parameters with their indexed catalog fallbacks,
    // but do not invent defaults when a fixture omits both forms.
    const damF = getPName(piece.params, 'bonusdam', getP1(piece.params, 0)) / 100;
    // GD changeStaminaFactor divides by 100 — pass the signed fraction through.
    const stamF = -getPName(piece.params, 'stamina', getP2(piece.params, 0)) / 100;
    const inside = getItemsInside(graph, piece.placementKey);
    let n = 0;
    for (const key of inside) {
      const other = (pieces || []).find((p) => p.placementKey === key);
      if (!other) continue;
      // Bag.getAffectedItemsInside() delegates to RelicCase.canApplyEffect,
      // which is exactly Item.isWeapon(), not merely any damage-bearing piece.
      if (!itemHasType(ctx.itemsById.get(other.itemId), 'weapon')) continue;
      if (canBeEmpoweredPiece(other) && damF) addBonusDamageFactor(other, damF);
      if (stamF) changeStaminaFactor(other, stamF);
      n += 1;
    }
    events.push({
      t: t + 0.004,
      type: 'info',
      label: `${piece.name}: empower ×${n} inside`,
      meta: { category: 'adjacency', script: true, handler: 'relic_case' },
    });
    pushActivate(piece, ctx, 'relic_case', `Bag: ${piece.name}`);
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AI_F_PORTS = {
  katana: katanaPort,
  relic_case: relicCasePort,
};
