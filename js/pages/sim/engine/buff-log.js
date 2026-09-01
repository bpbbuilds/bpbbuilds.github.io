/**
 * Phase 263 — Combat Log / Damage Meter lines for grantStacks (Character giveX).
 * Ports that already push a matching buff/debuff in the same tick are not doubled.
 */

const DEBUFFS = new Set(['poison', 'blind', 'cold']);

/** @type {{
 *   events: object[],
 *   getT: () => number,
 *   dummy?: object,
 * } | null} */
let bound = null;

/**
 * @param {{
 *   events: object[],
 *   getT: () => number,
 *   dummy?: object,
 * } | null} ref
 */
export function bindBuffCombatLog(ref) {
  bound = ref;
}

export function unbindBuffCombatLog() {
  bound = null;
}

function buffDedupeKey(e, tOverride) {
  const stack = String(e.meta?.stack || e.stack || '').toLowerCase();
  const amt = Number(e.amount) || 0;
  const t =
    tOverride != null
      ? Math.round(tOverride * 50) / 50
      : Math.round((Number(e.t) || 0) * 50) / 50;
  const id = e.itemId || '';
  return `${e.type}|${t}|${stack}|${amt}|${id}|${e.target || ''}`;
}

/**
 * Drop auto grantStacks lines when a port already logged the same grant.
 * Match within ±0.15s — ports often stamp fireT / fireT+0.004 while auto
 * used to stamp step-end getT(), which broke exact-bucket dedupe.
 */
export function collapseDuplicateBuffLogs(events) {
  /** @type {{ e: object, stack: string, amt: number, id: string, target: string, t: number }[]} */
  const portLines = [];
  for (const e of events) {
    if (e?.type !== 'buff' && e?.type !== 'debuff') continue;
    if (e.meta?.fromGrantStacks) continue;
    const stack = String(e.meta?.stack || e.stack || '').toLowerCase();
    if (!stack) continue;
    portLines.push({
      e,
      stack,
      amt: Number(e.amount) || 0,
      id: e.itemId || '',
      target: e.target || '',
      t: Number(e.t) || 0,
    });
  }
  const out = events.filter((e) => {
    if (e?.type !== 'buff' && e?.type !== 'debuff') return true;
    if (!e.meta?.fromGrantStacks) return true;
    const stack = String(e.meta?.stack || e.stack || '').toLowerCase();
    const amt = Number(e.amount) || 0;
    const id = e.itemId || '';
    const target = e.target || '';
    const t = Number(e.t) || 0;
    for (const p of portLines) {
      if (p.stack !== stack) continue;
      if (p.amt !== amt) continue;
      if (id && p.id && id !== p.id) continue;
      if (target && p.target && target !== p.target) continue;
      if (Math.abs(p.t - t) > 0.15) continue;
      return false;
    }
    // Exact-bucket fallback (legacy)
    if (portLines.some((p) => buffDedupeKey(p.e) === buffDedupeKey(e))) return false;
    return true;
  });
  events.length = 0;
  events.push(...out);
}

/**
 * @param {object[]} events
 * @param {{ t: number, type: string, stack: string, amount: number, originId?: string | null }} row
 */
function alreadyLogged(events, row) {
  const n = events.length;
  for (let i = n - 1; i >= Math.max(0, n - 12); i -= 1) {
    const e = events[i];
    if (e?.type !== row.type) continue;
    if (e.meta?.fromGrantStacks) continue;
    const stack = String(e.meta?.stack || e.stack || '').toLowerCase();
    if (stack !== row.stack) continue;
    const amt = Number(e.amount);
    if (amt !== row.amount) continue;
    if (Math.abs((Number(e.t) || 0) - row.t) > 0.05) continue;
    const oid = e.itemId || e.meta?.originId || null;
    if (row.originId && oid && oid !== row.originId) continue;
    return true;
  }
  return false;
}

/**
 * @param {object} actor
 * @param {string} stack
 * @param {number} amount
 * @param {object} [opts]
 */
export function logGrantedStacks(actor, stack, amount, opts = {}) {
  if (!bound?.events || !(amount > 0) || opts.silentLog) return;
  const key = String(stack || '').toLowerCase();
  if (!key) return;
  const t = Number.isFinite(Number(opts.t))
    ? Number(opts.t)
    : Number(bound.getT?.()) || 0;
  const type = DEBUFFS.has(key) ? 'debuff' : 'buff';
  const originId = opts.originId ?? null;
  if (alreadyLogged(bound.events, { t, type, stack: key, amount, originId })) {
    return;
  }
  const target = bound.dummy && actor === bound.dummy ? 'dummy' : 'player';
  bound.events.push({
    t,
    type,
    actor: target === 'dummy' ? 'dummy' : 'player',
    target,
    amount,
    itemId: originId,
    placementKey: opts.originKey ?? null,
    label: `+${amount} ${key}`,
    meta: {
      category: type === 'debuff' ? 'dot' : 'buff',
      stack: key,
      script: true,
      handler: originId || 'grantStacks',
      fromGrantStacks: true,
    },
  });
}

/**
 * Hostile strip / cleanse losses so auditors can reconstruct live stacks
 * (e.g. Darkest Lotus buffremoval before melee vamp heals).
 * @param {object} actor
 * @param {string} stack
 * @param {number} amount positive spent
 * @param {object} [opts]
 */
export function logSpentStacks(actor, stack, amount, opts = {}) {
  if (!bound?.events || !(amount > 0) || opts.silentLog) return;
  const key = String(stack || '').toLowerCase();
  if (!key) return;
  const spent = Math.round(amount);
  if (spent <= 0) return;
  const t = Number.isFinite(Number(opts.t))
    ? Number(opts.t)
    : Number(bound.getT?.()) || 0;
  const type = DEBUFFS.has(key) ? 'debuff' : 'buff';
  const originId = opts.originId ?? null;
  if (alreadyLogged(bound.events, { t, type, stack: key, amount: -spent, originId })) {
    return;
  }
  const target = bound.dummy && actor === bound.dummy ? 'dummy' : 'player';
  const kind = opts.hostileStrip ? 'strip' : opts.cleanse ? 'cleanse' : 'spend';
  bound.events.push({
    t,
    type,
    actor: target,
    target,
    amount: -spent,
    itemId: originId,
    placementKey: opts.originKey ?? null,
    label: `−${spent} ${key}`,
    meta: {
      category: type === 'debuff' ? 'dot' : 'buff',
      stack: key,
      script: true,
      handler: originId || 'spendStacks',
      fromSpendStacks: true,
      kind,
    },
  });
}
