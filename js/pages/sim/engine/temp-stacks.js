/**
 * Temporary stack timers — Buff.gd gainTemporary / temporaryStacks (Band Z 147).
 */

import { gainStacks, loseStacks } from './stacks.js';

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
  if (n <= 0 || !(dur > 0)) return { gained: 0 };
  const g = gainStacks(actor, /** @type {any} */ (stack), n, opts);
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
  /** @type {TempStackEntry[]} */
  const expired = [];
  /** @type {TempStackEntry[]} */
  const keep = [];
  for (const entry of list) {
    if (t + 1e-9 < entry.expiresAt) {
      keep.push(entry);
      continue;
    }
    const lost = loseStacks(actor, /** @type {any} */ (entry.stack), entry.amount);
    if (lost > 0) {
      expired.push({ ...entry, amount: lost });
    }
  }
  actor._tempStacks = keep;
  return expired;
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
