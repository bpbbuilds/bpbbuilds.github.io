/**
 * Buff spend / most-buffs / change bus — Band W foundations.
 */

import { gainStacks, loseStacks, getStackAmount } from './stacks.js';
import { expireTemporaryStacks, grantTemporary } from './temp-stacks.js';
import { logGrantedStacks, logSpentStacks, logBlockedStacks } from './buff-log.js';
import { scaleByBuffPower, originPieceFromOpts } from './buff-power.js';
import { rollPercent } from './rng.js';
import { runWithoutStatSource } from './stat-mods.js';

/** Game.getBuffs() — Lucky…Heat (not Block). */
export const BUFF_KEYS = [
  'lucky',
  'regeneration',
  'vampirism',
  'spikes',
  'mana',
  'empower',
  'heat',
];

/** Game.getDebuffs() subset used by sim. */
export const DEBUFF_KEYS = ['poison', 'blind', 'cold'];

/**
 * @typedef {{
 *   originKey?: string | null,
 *   originId?: string | null,
 *   amount: number,
 *   stack: string,
 *   used?: boolean,
 * }} BuffChange
 */

/**
 * @param {import('./actor.js').SimActor} actor
 */
export function ensureBuffBus(actor) {
  if (!actor._buffListeners) {
    /** @type {((ch: BuffChange) => void)[]} */
    actor._buffListeners = [];
  }
  return actor._buffListeners;
}

/**
 * @param {import('./actor.js').SimActor} actor
 * @param {(ch: BuffChange) => void} fn
 */
export function onBuffChanged(actor, fn) {
  ensureBuffBus(actor).push(fn);
}

/**
 * @param {import('./actor.js').SimActor} actor
 * @param {BuffChange} change
 */
export function emitBuffChanged(actor, change) {
  const list = actor._buffListeners;
  if (!list?.length) return;
  // Listeners must not inherit the grantor's withStatSource — otherwise Mana Orb
  // (buff grant) is blamed for Forging Hammer / Burning Sword flat "Bonus" damage.
  runWithoutStatSource(() => {
    for (const fn of list) {
      try {
        fn(change);
      } catch (err) {
        console.error('[sim] buff listener', err);
      }
    }
  });
}

/**
 * Gain stacks + bus notify.
 * @param {import('./actor.js').SimActor} actor
 * @param {string} stack
 * @param {number} amount
 * @param {object} [opts]
 */
export function grantStacks(actor, stack, amount, opts = {}) {
  amount = scaleByBuffPower(amount, stack, opts);
  // EvilCap buffNullifyChance — chance to refuse a buff gain
  if (
    amount > 0 &&
    BUFF_KEYS.includes(/** @type {any} */ (stack)) &&
    (Number(actor.buffNullifyChance) || 0) > 0 &&
    typeof opts.rng === 'function'
  ) {
    if (opts.rng() * 100 < Number(actor.buffNullifyChance)) {
      const n = Math.round(amount);
      logBlockedStacks(actor, stack, n, 'nullified', opts);
      return { gained: 0, resisted: n, reflected: 0 };
    }
  }
  // Item buffAmplificationChances / buffAmpChance (Con-Trap-Tron path, Double Rainbow, …)
  const origin = originPieceFromOpts(opts);
  const amp =
    (Number(origin?.buffAmpChance) || 0) +
    (Number(origin?.buffAmplificationChances?.[stack]) || 0);
  const g = gainStacks(actor, /** @type {any} */ (stack), amount, {
    ...opts,
    amplificationChance: amp || opts.amplificationChance,
  });
  if (g.resisted > 0) {
    logBlockedStacks(actor, stack, g.resisted, 'resisted', opts);
  }
  if (g.reflected > 0) {
    logBlockedStacks(actor, stack, g.reflected, 'reflected', opts);
  }
  if (g.gained > 0) {
    const originId = opts.originId ?? opts.originKey ?? null;
    if (originId) {
      if (!actor.stackGrantByOrigin) actor.stackGrantByOrigin = {};
      if (!actor.stackGrantByOrigin[stack]) actor.stackGrantByOrigin[stack] = {};
      const key = String(originId);
      actor.stackGrantByOrigin[stack][key] =
        (Number(actor.stackGrantByOrigin[stack][key]) || 0) + g.gained;
    }
    emitBuffChanged(actor, {
      amount: g.gained,
      stack,
      originKey: opts.originKey ?? null,
      originId: opts.originId ?? null,
    });
    logGrantedStacks(actor, stack, g.gained, opts);
  }
  return g;
}

/**
 * Spend stacks (negative bus notify).
 * @param {import('./actor.js').SimActor} actor
 * @param {string} stack
 * @param {number} amount
 * @param {object} [opts]
 */
export function spendStacks(actor, stack, amount, opts = {}) {
  let need = Math.max(0, Math.round(amount));
  if (need <= 0) return { spent: 0 };
  // Hostile strip (steal / purge): buff-protect consumes instead of removing
  if (
    opts.hostileStrip &&
    BUFF_KEYS.includes(String(stack)) &&
    (Number(actor.buffProtect) || 0) > 0
  ) {
    actor.buffProtect -= 1;
    logBlockedStacks(actor, stack, need, 'protected', opts);
    return { spent: 0, protected: true };
  }
  // Buff.gd loseStacks cleanseProtection — steal / strip / cleanse, not item useStacks
  if (
    (opts.hostileStrip || opts.cleanse) &&
    BUFF_KEYS.includes(String(stack)) &&
    typeof opts.rng === 'function'
  ) {
    const pct = Number(actor.buffCleanseProtectChance) || 0;
    if (pct > 0) {
      let kept = 0;
      for (let i = 0; i < need; i++) {
        if (rollPercent(pct, opts.rng)) kept += 1;
      }
      need -= kept;
    } else if (pct < 0) {
      let extra = 0;
      for (let i = 0; i < need; i++) {
        if (rollPercent(-pct, opts.rng)) extra += 1;
      }
      need += extra;
    }
    need = Math.max(0, need);
  }
  const have = getStackAmount(actor, /** @type {any} */ (stack));
  if (have < need) return { spent: 0 };
  const spent = loseStacks(actor, /** @type {any} */ (stack), need);
  if (spent > 0) {
    const originKey =
      opts.originKey ?? opts.piece?.placementKey ?? opts.origin?.placementKey ?? null;
    const originId =
      opts.originId ?? opts.piece?.itemId ?? opts.origin?.itemId ?? null;
    const used = !opts.hostileStrip && !opts.cleanse;
    emitBuffChanged(actor, {
      amount: -spent,
      stack,
      used,
      originKey,
      originId,
    });
    // Game Buff.changeCurrentLogShowLabel: when an item spends/strips stacks it
    // always combat-logs + Util.spawnBuffLabel_item (−N on the item). Ports that
    // also push a matching spend line are deduped in logSpentStacks.
    if (originKey || originId || opts.hostileStrip || opts.cleanse) {
      logSpentStacks(actor, stack, spent, {
        ...opts,
        originKey,
        originId,
        used,
      });
    }
  }
  return { spent };
}

/**
 * @param {import('./actor.js').SimActor} actor
 * @param {number} amount
 * @param {object} [opts]
 */
export function useLucky(actor, amount, opts = {}) {
  return spendStacks(actor, 'lucky', amount, opts);
}

/**
 * @param {import('./actor.js').SimActor} actor
 * @param {number} amount
 * @param {object} [opts]
 */
export function useRegeneration(actor, amount, opts = {}) {
  return spendStacks(actor, 'regeneration', amount, opts);
}

/**
 * @param {import('./actor.js').SimActor} actor
 * @param {number} amount
 * @param {object} [opts]
 */
export function useMana(actor, amount, opts = {}) {
  return spendStacks(actor, 'mana', amount, opts);
}

/**
 * Temporary stacks with buff-bus notify (Band Z 147).
 * @param {import('./actor.js').SimActor} actor
 * @param {string} stack
 * @param {number} amount
 * @param {number} durationSec
 * @param {number} nowT
 * @param {object} [opts]
 */
export function grantTemporaryStacks(actor, stack, amount, durationSec, nowT, opts = {}) {
  amount = scaleByBuffPower(amount, stack, opts);
  const g = grantTemporary(actor, stack, amount, durationSec, nowT, opts);
  if (g.gained > 0) {
    emitBuffChanged(actor, {
      amount: g.gained,
      stack,
      originKey: opts.originKey ?? null,
      originId: opts.originId ?? null,
    });
  }
  return g;
}

/**
 * Tick temp stack expiry for an actor.
 * @param {import('./actor.js').SimActor} actor
 * @param {number} t
 * @param {import('../sim-events.js').SimEvent[] | object[]} [events]
 */
export function tickTemporaryStacks(actor, t, events) {
  const expired = expireTemporaryStacks(actor, t);
  for (const entry of expired) {
    emitBuffChanged(actor, {
      amount: -entry.amount,
      stack: entry.stack,
      originKey: entry.originKey ?? null,
      originId: entry.originId ?? null,
    });
    if (events) {
      events.push({
        t,
        type: 'buff',
        target: actor.id,
        amount: -entry.amount,
        label: `Temp ${entry.stack} expired (−${entry.amount})`,
        meta: {
          category: 'buff',
          stack: entry.stack,
          temp: true,
          expired: true,
        },
      });
    }
  }
  return expired.length;
}

/**
 * Give the same amount of every buff (Prismatic Wand / Sloth).
 * @param {import('./actor.js').SimActor} actor
 * @param {number} [amount]
 * @param {object} [opts]
 */
export function giveAllBuffs(actor, amount = 1, opts = {}) {
  const n = Math.max(0, Math.round(amount));
  if (n <= 0) return {};
  /** @type {Record<string, number>} */
  const picked = {};
  for (const k of buffPool(opts)) {
    grantStacks(actor, k, n, opts);
    picked[k] = n;
  }
  return picked;
}

/**
 * Remove Lucky from an actor (Crow / Jynx vs dummy).
 * @param {import('./actor.js').SimActor} actor
 * @param {number} amount
 * @param {object} [opts]
 */
export function removeLucky(actor, amount, opts = {}) {
  return spendStacks(actor, 'lucky', amount, opts);
}

/**
 * Steal one stack type from `from` → `to` (Squirrel / Fedora).
 * @param {import('./actor.js').SimActor} from
 * @param {import('./actor.js').SimActor} to
 * @param {string} stack
 * @param {number} amount
 * @param {object} [opts]
 */
export function stealStack(from, to, stack, amount, opts = {}) {
  const need = Math.max(0, Math.round(amount));
  if (need <= 0) return { stolen: 0, stack };
  const have = getStackAmount(from, /** @type {any} */ (stack));
  const take = Math.min(need, have);
  if (take <= 0) return { stolen: 0, stack };
  const spent = spendStacks(from, stack, take, { ...opts, hostileStrip: true });
  if (spent.protected || spent.spent <= 0) return { stolen: 0, stack, protected: !!spent.protected };
  grantStacks(to, stack, spent.spent, opts);
  return { stolen: spent.spent, stack };
}

/**
 * Steal N random buff stacks from opponent (dummy) to player.
 * @param {import('./actor.js').SimActor} from
 * @param {import('./actor.js').SimActor} to
 * @param {number} num
 * @param {() => number} rng
 * @param {object} [opts]
 */
export function stealRandomBuff(from, to, num, rng, opts = {}) {
  const keys = buffPool(opts).filter(
    (k) => getStackAmount(from, /** @type {any} */ (k)) > 0,
  );
  const n = Math.max(0, Math.round(num));
  /** @type {Record<string, number>} */
  const stolen = {};
  for (let i = 0; i < n; i++) {
    const pool = keys.filter((k) => getStackAmount(from, /** @type {any} */ (k)) > 0);
    if (!pool.length) break;
    const choice = pool[Math.floor(rng() * pool.length)] || pool[0];
    const r = stealStack(from, to, choice, 1, { ...opts, rng });
    if (r.stolen > 0) stolen[choice] = (stolen[choice] || 0) + r.stolen;
  }
  return stolen;
}

/**
 * Cleanse N random debuff stacks from actor.
 * @param {import('./actor.js').SimActor} actor
 * @param {number} num
 * @param {() => number} rng
 * @param {object} [opts]
 */
export function cleanseRandomDebuffs(actor, num, rng, opts = {}) {
  const keys = (opts.availableDebuffs || DEBUFF_KEYS).filter(
    (k) => getStackAmount(actor, /** @type {any} */ (k)) > 0,
  );
  const n = Math.max(0, Math.round(num));
  /** @type {Record<string, number>} */
  const cleansed = {};
  for (let i = 0; i < n; i++) {
    const pool = keys.filter((k) => getStackAmount(actor, /** @type {any} */ (k)) > 0);
    if (!pool.length) break;
    const choice = pool[Math.floor(rng() * pool.length)] || pool[0];
    const { spent } = spendStacks(actor, choice, 1, opts);
    if (spent > 0) cleansed[choice] = (cleansed[choice] || 0) + spent;
  }
  return cleansed;
}

/**
 * Inflict N random debuffs on actor (usually dummy).
 * @param {import('./actor.js').SimActor} actor
 * @param {number} num
 * @param {() => number} rng
 * @param {object} [opts]
 */
export function inflictRandomDebuffs(actor, num, rng, opts = {}) {
  const keys = opts.availableDebuffs || DEBUFF_KEYS;
  const n = Math.max(0, Math.round(num));
  /** @type {Record<string, number>} */
  const picked = {};
  for (let i = 0; i < n; i++) {
    const choice = keys[Math.floor(rng() * keys.length)] || keys[0];
    if (!choice) break;
    picked[choice] = (picked[choice] || 0) + 1;
  }
  for (const [stack, amount] of Object.entries(picked)) {
    grantStacks(actor, stack, amount, opts);
  }
  return picked;
}

/**
 * @param {object} [opts]
 * @returns {string[]}
 */
function buffPool(opts = {}) {
  const raw = opts.availableBuffs;
  if (Array.isArray(raw) && raw.length) {
    return raw.map(String).filter((k) => BUFF_KEYS.includes(k) || k.length > 0);
  }
  return [...BUFF_KEYS];
}

/**
 * Give N stacks distributed to current least-held buffs (Enchanted Weapons / Wand).
 * @param {import('./actor.js').SimActor} actor
 * @param {number} num
 * @param {() => number} rng
 * @param {object} [opts]
 */
export function giveLeastBuffs(actor, num, rng, opts = {}) {
  const keys = buffPool(opts);
  const n = Math.max(0, Math.round(num));
  /** @type {Record<string, number>} */
  const counts = {};
  for (const k of keys) counts[k] = getStackAmount(actor, /** @type {any} */ (k));
  /** @type {Record<string, number>} */
  const picked = {};
  for (let i = 0; i < n; i++) {
    let least = Infinity;
    /** @type {string[]} */
    const pool = [];
    for (const k of keys) {
      if (counts[k] < least) {
        least = counts[k];
        pool.length = 0;
        pool.push(k);
      } else if (counts[k] === least) pool.push(k);
    }
    const choice = pool[Math.floor(rng() * pool.length)] || keys[0];
    if (!choice) break;
    picked[choice] = (picked[choice] || 0) + 1;
    counts[choice] += 1;
  }
  for (const [stack, amount] of Object.entries(picked)) {
    grantStacks(actor, stack, amount, opts);
  }
  return picked;
}

/**
 * Give N stacks to the buff you currently have the most of (Miss Fortune).
 * Ties broken randomly.
 * @param {import('./actor.js').SimActor} actor
 * @param {number} num
 * @param {() => number} rng
 * @param {object} [opts]
 */
export function giveMostBuffs(actor, num, rng, opts = {}) {
  const keys = buffPool(opts);
  const n = Math.max(0, Math.round(num));
  if (n <= 0 || !keys.length) return {};
  let best = -1;
  /** @type {string[]} */
  const pool = [];
  for (const k of keys) {
    const v = getStackAmount(actor, /** @type {any} */ (k));
    if (v > best) {
      best = v;
      pool.length = 0;
      pool.push(k);
    } else if (v === best) pool.push(k);
  }
  // If all zero, still pick among all buffs (game still grants)
  const choice =
    pool[Math.floor(rng() * Math.max(1, pool.length))] || keys[0];
  grantStacks(actor, choice, n, opts);
  return { [choice]: n };
}

/**
 * Give N stacks by picking a random buff type per stack (Item.giveRandomBuffs).
 * @param {import('./actor.js').SimActor} actor
 * @param {number} num
 * @param {() => number} rng
 * @param {object} [opts]
 */
export function giveRandomBuffs(actor, num, rng, opts = {}) {
  const keys = buffPool(opts);
  const n = Math.max(0, Math.round(num));
  if (n <= 0 || !keys.length) return {};
  /** @type {Record<string, number>} */
  const picked = {};
  for (let i = 0; i < n; i++) {
    const choice = keys[Math.floor(rng() * keys.length)] || keys[0];
    picked[choice] = (picked[choice] || 0) + 1;
  }
  for (const [stack, amount] of Object.entries(picked)) {
    grantStacks(actor, stack, amount, opts);
  }
  return picked;
}

/**
 * Remove / spend from the buff you have the most of within a pool (Wand).
 * When `opts.use` is true, spends from `actor` (self); otherwise same (sim has no opponent buff steal yet).
 * @param {import('./actor.js').SimActor} actor
 * @param {number} num
 * @param {() => number} rng
 * @param {object} [opts]
 * @returns {{ stack: string, spent: number } | null}
 */
export function removeMostBuffs(actor, num, rng, opts = {}) {
  const keys = buffPool(opts);
  const need = Math.max(0, Math.round(num));
  if (need <= 0 || !keys.length) return null;
  let best = -1;
  /** @type {string[]} */
  const pool = [];
  for (const k of keys) {
    const v = getStackAmount(actor, /** @type {any} */ (k));
    if (v > best) {
      best = v;
      pool.length = 0;
      pool.push(k);
    } else if (v === best) pool.push(k);
  }
  if (best <= 0) return null;
  const stack =
    pool[Math.floor(rng() * Math.max(1, pool.length))] || keys[0];
  const toRemove = Math.min(need, getStackAmount(actor, /** @type {any} */ (stack)));
  if (toRemove <= 0) return null;
  const { spent } = spendStacks(actor, stack, toRemove, opts);
  if (spent <= 0) return null;
  return { stack, spent };
}

/**
 * Running counters for Toad-style thresholds.
 * @param {{ gained: number, used: number }} state
 * @param {number} amount signed delta
 * @param {number} gainedThreshold
 * @param {number} usedThreshold
 * @returns {{ gainTicks: number, useTicks: number }}
 */
export function advanceBuffThresholds(state, amount, gainedThreshold, usedThreshold) {
  let gainTicks = 0;
  let useTicks = 0;
  const gTh = Math.max(1, Math.round(gainedThreshold) || 1);
  const uTh = Math.max(1, Math.round(usedThreshold) || 1);
  if (amount > 0) {
    state.gained += amount;
    gainTicks = Math.floor(state.gained / gTh);
    if (gainTicks > 0) state.gained %= gTh;
  } else if (amount < 0) {
    state.used += Math.abs(amount);
    useTicks = Math.floor(state.used / uTh);
    if (useTicks > 0) state.used %= uTh;
  }
  return { gainTicks, useTicks };
}
