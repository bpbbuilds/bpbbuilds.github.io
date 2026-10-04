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
 * Game Character.changeDebuffResistChances while a timed gem effect is active.
 * `stackResist` uses the same percentage units as Buff.changeResistChance and
 * is consumed by the canonical stack-grant path for poison/blind/cold.
 *
 * @param {import('./actor.js').SimActor} actor
 * @param {number} pct
 * @param {number} untilT
 * @param {string} [tag]
 * @param {string[]} [stacks]
 * @param {{ alreadyGranted?: boolean }} [opts]
 */
export function grantTimedDebuffResistance(
  actor,
  pct,
  untilT,
  tag = 'debuff',
  stacks = ['poison', 'blind', 'cold'],
  opts = {},
) {
  const n = Number(pct) || 0;
  if (!n || !(untilT > 0)) return;
  if (!actor._timedDebuffResists) actor._timedDebuffResists = [];
  actor.stackResist = actor.stackResist || {};
  if (!opts.alreadyGranted) {
    for (const stack of stacks) {
      actor.stackResist[stack] = (Number(actor.stackResist[stack]) || 0) + n;
    }
  }
  actor._timedDebuffResists.push({ pct: n, untilT, tag, stacks: [...stacks] });
}

/**
 * Expire timed resists at sim time `t`.
 * @param {import('./actor.js').SimActor[]} actors
 * @param {number} t
 */
export function tickTimedResistances(actors, t) {
  for (const actor of actors || []) {
    const list = actor._timedResists;
    if (list?.length) {
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

    const debuffList = actor._timedDebuffResists;
    if (!debuffList?.length) continue;
    /** @type {typeof debuffList} */
    const debuffKeep = [];
    actor.stackResist = actor.stackResist || {};
    for (const e of debuffList) {
      if (t + 1e-9 >= e.untilT) {
        for (const stack of e.stacks || []) {
          actor.stackResist[stack] =
            (Number(actor.stackResist[stack]) || 0) - (Number(e.pct) || 0);
          if (Math.abs(actor.stackResist[stack]) < 1e-9) delete actor.stackResist[stack];
        }
        actor._onTimedDebuffResistEnd?.(e.tag, e);
      } else debuffKeep.push(e);
    }
    actor._timedDebuffResists = debuffKeep;
  }
}
