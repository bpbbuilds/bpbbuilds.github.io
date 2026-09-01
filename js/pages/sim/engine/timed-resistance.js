/**
 * Timed % damage resistance on actors (Band AJ).
 * Prefer this over turtle-style grantTimedSpeed(1e-6) DR hacks.
 */

/**
 * @param {import('./actor.js').SimActor} actor
 * @param {number} pct — same units as actor.damageResistancePct (e.g. 25 = 25%)
 * @param {number} untilT
 * @param {string} [tag]
 */
export function grantTimedResistancePct(actor, pct, untilT, tag = 'default') {
  const n = Number(pct) || 0;
  if (!n || !(untilT > 0)) return;
  if (!actor._timedResists) actor._timedResists = [];
  actor.damageResistancePct = (Number(actor.damageResistancePct) || 0) + n;
  actor._timedResists.push({ pct: n, untilT, tag });
}

/**
 * Expire timed resists at sim time `t`.
 * @param {import('./actor.js').SimActor[]} actors
 * @param {number} t
 */
export function tickTimedResistances(actors, t) {
  for (const actor of actors || []) {
    const list = actor._timedResists;
    if (!list?.length) continue;
    /** @type {typeof list} */
    const keep = [];
    for (const e of list) {
      if (t + 1e-9 >= e.untilT) {
        actor.damageResistancePct = Math.max(
          0,
          (Number(actor.damageResistancePct) || 0) - e.pct,
        );
        actor._onTimedResistEnd?.(e.tag, e);
      } else keep.push(e);
    }
    actor._timedResists = keep;
  }
}
