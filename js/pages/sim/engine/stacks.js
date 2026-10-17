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
const BUFFS = new Set([
  'lucky',
  'regeneration',
  'vampirism',
  'spikes',
  'mana',
  'empower',
  'heat',
]);

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

function temporaryAmount(actor, stack) {
  return (actor._tempStacks || []).reduce(
    (sum, entry) => sum + (entry?.stack === stack ? Math.max(0, Number(entry.amount) || 0) : 0),
    0,
  );
}

function currentPermanentAmount(actor, stack) {
  return Math.max(0, getStackAmount(actor, stack) - temporaryAmount(actor, stack));
}

function consumeBuffProtect(actor, amount) {
  const canonical = Math.max(0, Math.round(Number(actor.buffProtectStacks) || 0));
  const legacy = Math.max(0, Math.round(Number(actor.buffProtect) || 0));
  const available = canonical > 0 ? canonical : legacy;
  const consumed = Math.min(available, Math.max(0, Math.round(amount)));
  if (consumed > 0) {
    const remaining = available - consumed;
    actor.buffProtectStacks = remaining;
    actor.buffProtect = remaining;
  }
  return consumed;
}

function protectionChance(actor, stack) {
  const specific = Number(
    actor.stackCleanseProtectChance?.[stack] ??
      actor.buffCleanseProtectChanceByStack?.[stack],
  );
  const global = DEBUFFS.has(stack) ? Number(actor.debuffCleanseProtectChance) || 0 : 0;
  return (Number.isFinite(specific) ? specific : 0) + global;
}

function removeStackAmount(actor, stack, amount) {
  const requested = Math.max(0, Math.round(Number(amount) || 0));
  const before = getStackAmount(actor, stack);
  const change = Math.min(before, requested);
  if (change <= 0) return 0;

  let remaining = change;
  const permanent = currentPermanentAmount(actor, stack);
  const permanentRemoved = Math.min(permanent, remaining);
  remaining -= permanentRemoved;

  if (remaining > 0 && actor._tempStacks?.length) {
    while (remaining > 0) {
      let farthestIndex = -1;
      let farthestTimeout = -Infinity;
      for (let i = 0; i < actor._tempStacks.length; i++) {
        const entry = actor._tempStacks[i];
        if (entry?.stack !== stack || !(entry.amount > 0)) continue;
        if (Number(entry.expiresAt) > farthestTimeout) {
          farthestTimeout = Number(entry.expiresAt);
          farthestIndex = i;
        }
      }
      if (farthestIndex < 0) break;
      const entry = actor._tempStacks[farthestIndex];
      const removed = Math.min(remaining, Math.max(0, Number(entry.amount) || 0));
      entry.amount -= removed;
      remaining -= removed;
      if (entry.amount <= 0) actor._tempStacks.splice(farthestIndex, 1);
    }
  }

  setStackAmount(actor, stack, before - change);
  return change;
}

/** Remove one exact temporary entry at timeout, without cleanse protection. */
export function removeTemporaryStackAmount(actor, entry) {
  const amount = Math.max(0, Math.round(Number(entry?.amount) || 0));
  const before = getStackAmount(actor, /** @type {any} */ (entry?.stack));
  const removed = Math.min(before, amount);
  if (removed > 0) {
    setStackAmount(actor, entry.stack, before - removed);
    actor._combatBus?.emit?.(`character_${entry.stack}_changed`, {
      actor,
      stack: entry.stack,
      amount: -removed,
      originKey: entry.originKey ?? null,
      originId: entry.originId ?? null,
    });
  }
  return removed;
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
 *   onReflect?: (actor: SimActor, stack: string, amount: number, opts: object) => void,
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

  const rng = opts.rng ?? actor._combatRng;
  // Character.gd always has an opponent reference. Most simulator item ports
  // call the shared stack helper through an actor rather than passing that
  // reference on every grant, so preserve the source lookup here.
  const opponent = opts.opponent ?? actor.opponent ?? null;
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

  if (DEBUFFS.has(stack) && !opts.reflect) {
    const reflectPct =
      Number(actor.stackReflectChance?.[stack] ?? actor.debuffReflectChance) || 0;
    if (reflectPct > 0 && typeof rng === 'function' && opponent) {
      for (let i = 0; i < left + resisted; i++) {
        if (rollPercent(reflectPct, rng)) reflected += 1;
      }
      left = Math.max(0, left - reflected);
    }
    const byStacks = left > 0
      ? Math.min(left, Math.max(0, actor.debuffReflectStacks || 0))
      : 0;
    if (byStacks > 0) {
      actor.debuffReflectStacks -= byStacks;
      reflected += byStacks;
      left -= byStacks;
    }
  }

  // Buff.gd applies the per-debuff resist pool and Character-wide debuff
  // resist after reflection, including to a reflected temporary grant.
  if (DEBUFFS.has(stack) && left > 0) {
    const resistStacks = actor.stackResistStacks || {};
    const own = Math.min(left, Math.max(0, Math.round(Number(resistStacks[stack]) || 0)));
    if (own > 0) {
      resistStacks[stack] -= own;
      resisted += own;
      left -= own;
    }
    const flat = Math.min(left, Math.max(0, Math.round(Number(actor.debuffResistStacks) || 0)));
    if (flat > 0) {
      actor.debuffResistStacks = Math.max(0, (Number(actor.debuffResistStacks) || 0) - flat);
      resisted += flat;
      left -= flat;
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
      originKey: opts.originKey ?? opts.piece?.placementKey ?? opts.origin?.placementKey ?? null,
      originId: opts.originId ?? opts.piece?.itemId ?? opts.origin?.itemId ?? null,
    });
  }
  // Buff.gd forwards the complete reflected amount only after the source
  // Buff has finished resistance, local stack mutation, and its change event.
  // Delaying this transfer also preserves reactive listener ordering.
  if (reflected > 0 && opponent) {
    const reflectOpts = {
      rng,
      reflect: true,
      originKey: opts.originKey ?? null,
      originId: opts.originId ?? null,
    };
    if (typeof opts.onReflect === 'function') {
      opts.onReflect(opponent, stack, reflected, reflectOpts);
    } else {
      gainStacks(opponent, stack, reflected, reflectOpts);
    }
  }
  return { gained, resisted, reflected };
}

/**
 * @param {SimActor} actor
 * @param {keyof SimStacks | 'block'} stack
 * @param {number} amount
 * @param {{ used?: boolean, rng?: () => number }} [opts]
 */
export function loseStacks(actor, stack, amount, opts = {}) {
  let requested = Math.min(
    getStackAmount(actor, stack),
    Math.max(0, Math.round(Number(amount) || 0)),
  );
  let protectedAmount = 0;
  const used = opts.used === true;
  if (!used && requested > 0) {
    const rng = opts.rng ?? actor._combatRng;
    const chance = protectionChance(actor, stack);
    if (chance && typeof rng === 'function') {
      for (let i = 0; i < requested; i++) {
        if (rollPercent(Math.abs(chance), rng)) protectedAmount += chance > 0 ? 1 : -1;
      }
      requested = Math.max(0, requested - protectedAmount);
    }
    const stackResistStacks = actor.stackResistStacks || {};
    const byStack = Math.min(
      requested,
      Math.max(0, Math.round(Number(stackResistStacks[stack]) || 0)),
    );
    if (byStack > 0) {
      stackResistStacks[stack] -= byStack;
      protectedAmount += byStack;
      requested -= byStack;
    }
    if (BUFFS.has(String(stack)) && stack !== 'block' && requested > 0) {
      const byCharacter = consumeBuffProtect(actor, requested);
      protectedAmount += byCharacter;
      requested -= byCharacter;
    }
  }
  actor._lastStackLoss = { requested: amount, protected: protectedAmount };
  const spent = removeStackAmount(actor, stack, requested);
  if (spent > 0) {
    actor._combatBus?.emit?.(`character_${stack}_changed`, {
      actor,
      stack,
      amount: -spent,
    });
  }
  return spent;
}
