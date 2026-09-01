/**
 * Band AI Wave F — katana (RibSaw + buff strip) / relic_case (inside staminaFactor).
 */

import {
  BUFF_KEYS,
  removeMostBuffs,
} from '../buff-economy.js';
import { getItemsInside } from '../board-graph.js';
import { getP1, getP2, getPName } from '../params.js';
import { addBonusDamage, addBonusDamageFactor, multiplyStaminaCost } from '../piece-stats.js';
import { getStackAmount } from '../stacks.js';
import { canBeEmpoweredPiece } from './food-helpers.js';
import { weaponStrike } from './ports-wave-c-util.js';
import { pushActivate } from './ports-util.js';

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
 * RibSawBlade.gd purge — shrink removable / bonus damage on a piece.
 * @param {object} weapon
 * @param {number} amount
 */
function purgeDamage(weapon, amount) {
  const need = Math.max(0, Math.round(amount));
  if (!need) return 0;
  let left = need;
  const bonus = Number(weapon.damageBonus) || 0;
  if (bonus > 0 && left > 0) {
    const cut = Math.min(bonus, left);
    weapon.damageBonus = bonus - cut;
    left -= cut;
  }
  if (left > 0 && (Number(weapon.damageMin) || 0) > 0) {
    const cut = Math.min(Number(weapon.damageMin) || 0, left);
    weapon.damageMin = Math.max(0, (Number(weapon.damageMin) || 0) - cut);
    weapon.damageMax = Math.max(
      Number(weapon.damageMin) || 0,
      (Number(weapon.damageMax) || 0) - cut,
    );
    left -= cut;
  }
  return need - left;
}

/**
 * Katana.gd — RibSaw on-hit purge + self bonusdam; if opp buffs ≥ buffst, strip most.
 * @type {ScriptHandler}
 */
export const katanaPort = {
  handlerId: 'katana',
  family: 'on_hit',
  onCombatStart(piece) {
    // Solo dummy has no opp inventory; RibSaw purge list stays empty until dual-board.
    piece._ribOppWeapons = [];
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
      purged += purgeDamage(w, removeDam);
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
    pushActivate(piece, ctx, 'relic_case', `Bag: ${piece.name}`);
    const damF =
      getPName(piece.params, 'bonusdam', getPName(piece.params, 'dam', getP1(piece.params, 10))) /
      100;
    // GD changeStaminaFactor divides by 100 — pass fraction into helper
    const stamF =
      -Math.abs(getPName(piece.params, 'stamina', getP2(piece.params, 20))) / 100;
    const inside = getItemsInside(graph, piece.placementKey);
    let n = 0;
    for (const key of inside) {
      const other = (pieces || []).find((p) => p.placementKey === key);
      if (!other) continue;
      const isWeapon =
        other.kind === 'weapon' ||
        (Number(other.damageMax) || 0) > 0 ||
        (Number(other.damageMin) || 0) > 0;
      if (!isWeapon) continue;
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
    return true;
  },
};

/** @type {Record<string, ScriptHandler>} */
export const AI_F_PORTS = {
  katana: katanaPort,
  relic_case: relicCasePort,
};
