/**
 * Temporary stack timers — Buff.gd gainTemporary / temporaryStacks (Band Z 147).
 */

import { gainStacks, removeTemporaryStackAmount } from './stacks.js';

/**
 * @typedef {{
 *   stack: string,
 *   amount: number,
 *   expiresAt: number,
 *   originKey?: string | null,
 *   originId?: string | null,
 * }} TempStackEntry
 */

/**
 * @param {import('./actor.js').SimActor} actor
 */
function ensureTemp(actor) {
  if (!actor._tempStacks) {
    /** @type {TempStackEntry[]} */
    actor._tempStacks = [];
  }
  return actor._tempStacks;
}

/**
 * Grant stacks that expire at absolute sim time `nowT + durationSec`.
 * Caller should emit buff-bus notify (see buff-economy.grantTemporaryStacks).
 * @param {import('./actor.js').SimActor} actor
 * @param {string} stack
 * @param {number} amount
 * @param {number} durationSec
 * @param {number} nowT
 * @param {object} [opts]
 */
export function grantTemporary(actor, stack, amount, durationSec, nowT, opts = {}) {
  const n = Math.max(0, Math.round(amount));
  const dur = Number(durationSec);
  if (n <= 0 || !(dur >= 0)) return { gained: 0 };
  const g = gainStacks(actor, /** @type {any} */ (stack), n, {
    ...opts,
    onReflect: (target, reflectedStack, reflectedAmount, reflectOpts) =>
      grantTemporary(target, reflectedStack, reflectedAmount, dur, nowT, reflectOpts),
  });
  if (g.gained <= 0) return g;
  ensureTemp(actor).push({
    stack,
    amount: g.gained,
    expiresAt: nowT + dur,
    originKey: opts.originKey ?? null,
    originId: opts.originId ?? null,
  });
  return g;
}

/**
 * Expire timed stacks at/before `t`.
 * @param {import('./actor.js').SimActor} actor
 * @param {number} t
 * @returns {TempStackEntry[]}
 */
export function expireTemporaryStacks(actor, t) {
  const list = actor._tempStacks;
  if (!list?.length) return [];
  const due = list
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !(t + 1e-9 < entry.expiresAt))
    .sort((a, b) => Number(a.entry.expiresAt) - Number(b.entry.expiresAt) || a.index - b.index)
    .map(({ entry }) => entry);
  if (!due.length) return [];
  const dueSet = new Set(due);
  /** @type {TempStackEntry[]} */
  const expired = [];
  for (const entry of due) {
    const lost = removeTemporaryStackAmount(actor, entry);
    if (lost > 0) {
      expired.push({ ...entry, amount: lost });
    }
  }
  actor._tempStacks = list.filter((entry) => !dueSet.has(entry));
  return expired;
}

/**
 * Buff.gd combatEnd — stop timeout work and clear temporary-entry metadata.
 * The source Buff object leaves `current` to the character lifecycle reset.
 * @param {import('./actor.js').SimActor} actor
 */
export function clearTemporaryStacks(actor) {
  actor._tempStacks = [];
}

/**
 * Aggregate active temp entries for HUD / snapshots.
 * Sum amounts per stack; soonest expiresAt for countdown.
 * @param {import('./actor.js').SimActor} actor
 * @returns {Record<string, { amount: number, expiresAt: number }>}
 */
export function summarizeTemporaryStacks(actor) {
  /** @type {Record<string, { amount: number, expiresAt: number }>} */
  const out = {};
  const list = actor._tempStacks;
  if (!list?.length) return out;
  for (const entry of list) {
    if (!entry?.stack || !(entry.amount > 0)) continue;
    const prev = out[entry.stack];
    if (!prev) {
      out[entry.stack] = {
        amount: entry.amount,
        expiresAt: entry.expiresAt,
      };
    } else {
      prev.amount += entry.amount;
      if (entry.expiresAt < prev.expiresAt) prev.expiresAt = entry.expiresAt;
    }
  }
  return out;
}
