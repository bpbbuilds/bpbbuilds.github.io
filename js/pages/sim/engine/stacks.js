/**
 * Stack gain rules inspired by Core/Buff.gd (Band G Phase 43).
 * Temp timers: see temp-stacks.js / buff-economy.grantTemporaryStacks (Band Z 147).
 */

import { rollPercent } from './rng.js';

/** @typedef {import('./actor.js').SimActor} SimActor */
/** @typedef {import('./actor.js').SimStacks} SimStacks */

const MAX_BLOCK = 100000;
const MAX_OTHER = 10000;

/** Debuff stack keys (reflect applies) */
const DEBUFFS = new Set(['poison', 'blind', 'cold']);

/**
 * @param {string} stack
 */
function maxFor(stack) {
  return stack === 'block' ? MAX_BLOCK : MAX_OTHER;
}

/**
 * @param {SimActor} actor
 * @param {keyof SimStacks | 'block'} stack
 */
export function getStackAmount(actor, stack) {
  if (stack === 'block') return actor.block;
  return actor.stacks[stack] || 0;
}

/**
 * @param {SimActor} actor
 * @param {keyof SimStacks | 'block'} stack
 * @param {number} amount
 */
function setStackAmount(actor, stack, amount) {
  const capped = Math.max(0, Math.min(maxFor(stack), Math.round(amount)));
  if (stack === 'block') {
    actor.block = capped;
    return;
  }
  if (actor.stacks[stack] == null && actor.stacks[stack] !== 0) return;
  actor.stacks[stack] = capped;
}

/**
 * Buff.gd gainStacks — resist chance, debuff reflect, caps.
 * @param {SimActor} actor
 * @param {keyof SimStacks | 'block'} stack
 * @param {number} amount
 * @param {{
 *   rng?: () => number,
 *   reflect?: boolean,
 *   opponent?: SimActor | null,
 * }} [opts]
 * @returns {{ gained: number, resisted: number, reflected: number }}
 */
export function gainStacks(actor, stack, amount, opts = {}) {
  let left = Math.max(0, Math.round(amount));
  let resisted = 0;
  let reflected = 0;
  if (left <= 0) {
    return { gained: 0, resisted: 0, reflected: 0 };
  }

  const rng = opts.rng;
  // Buff.gd: totalResistChance = resist − item.getAmplificationChancePercent(type)
  let totalResist = Number(actor.stackResist?.[stack]) || 0;
  if (!opts.reflect) {
    const amp = Number(opts.amplificationChance) || 0;
    if (amp) totalResist -= amp;
  }
  if (totalResist > 0 && typeof rng === 'function') {
    for (let i = 0; i < left; i++) {
      if (rollPercent(totalResist, rng)) resisted += 1;
    }
    left -= resisted;
  } else if (totalResist < 0 && typeof rng === 'function') {
    let bonus = 0;
    for (let i = 0; i < left; i++) {
      if (rollPercent(-totalResist, rng)) bonus += 1;
    }
    left += bonus;
  }

  // Character.debuffResistStacks — flat consumable soak (LeatherArmor / Buff.gd)
  if (DEBUFFS.has(stack) && !opts.reflect && left > 0) {
    const flat = Math.min(left, Math.max(0, Math.round(Number(actor.debuffResistStacks) || 0)));
    if (flat > 0) {
      actor.debuffResistStacks = Math.max(0, (Number(actor.debuffResistStacks) || 0) - flat);
      resisted += flat;
      left -= flat;
    }
  }

  if (DEBUFFS.has(stack) && !opts.reflect && left > 0) {
    const reflectPct = Number(actor.debuffReflectChance) || 0;
    if (reflectPct > 0 && typeof rng === 'function' && opts.opponent) {
      for (let i = 0; i < left; i++) {
        if (rollPercent(reflectPct, rng)) reflected += 1;
      }
      left -= reflected;
      if (reflected > 0) {
        gainStacks(opts.opponent, stack, reflected, {
          rng,
          reflect: true,
        });
      }
    }
    const byStacks = Math.min(left, Math.max(0, actor.debuffReflectStacks || 0));
    if (byStacks > 0 && opts.opponent) {
      actor.debuffReflectStacks -= byStacks;
      reflected += byStacks;
      left -= byStacks;
      gainStacks(opts.opponent, stack, byStacks, { rng, reflect: true });
    }
  }

  const before = getStackAmount(actor, stack);
  setStackAmount(actor, stack, before + left);
  const gained = getStackAmount(actor, stack) - before;
  if (gained > 0) {
    // Item.gd exposes character_*_changed signals for Block and the combat
    // buffs. Keep those signals on the shared bus so source listeners (for
    // example Djinn Lamp) see every grant, including direct gainStacks calls.
    actor._combatBus?.emit?.(`character_${stack}_changed`, {
      actor,
      stack,
      amount: gained,
    });
  }
  return { gained, resisted, reflected };
}

/**
 * @param {SimActor} actor
 * @param {keyof SimStacks | 'block'} stack
 * @param {number} amount
 */
export function loseStacks(actor, stack, amount) {
  const before = getStackAmount(actor, stack);
  setStackAmount(actor, stack, before - Math.max(0, Math.round(amount)));
  const spent = before - getStackAmount(actor, stack);
  if (spent > 0) {
    actor._combatBus?.emit?.(`character_${stack}_changed`, {
      actor,
      stack,
      amount: -spent,
    });
  }
  return spent;
}
