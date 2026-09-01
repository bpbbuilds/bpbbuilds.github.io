/**
 * Timed battle rage (Band AJ) — ExtraAngy / Toolbox / BrassKnuckles listeners.
 */

/**
 * @param {import('./actor.js').SimActor} actor
 * @param {number} [nowT]
 */
export function isBattleRaging(actor, nowT = 0) {
  const until = Number(actor.battleRageUntil) || 0;
  if (until > 0 && (Number(nowT) || 0) < until) return true;
  return !!actor.battleRage;
}

/**
 * Start (or extend) battle rage until `untilT`. Emits bus events.
 * @param {import('./actor.js').SimActor} actor
 * @param {number} durationSec
 * @param {number} nowT
 * @param {{ bus?: { emit?: (type: string, payload?: object) => void }, sourceId?: string }} [opts]
 */
export function startBattleRage(actor, durationSec, nowT, opts = {}) {
  const dur = Math.max(0, Number(durationSec) || 0);
  if (dur <= 0) return;
  const until = (Number(nowT) || 0) + dur;
  const was = isBattleRaging(actor, nowT);
  actor.battleRageUntil = Math.max(Number(actor.battleRageUntil) || 0, until);
  actor.battleRage = true;
  actor._battleRageDur = dur;
  if (!was) {
    opts.bus?.emit?.('battle_rage_started', {
      t: nowT,
      duration: dur,
      untilT: actor.battleRageUntil,
      sourceId: opts.sourceId ?? null,
    });
  }
}

/**
 * Expire battle rage; emit ended once.
 * @param {import('./actor.js').SimActor} actor
 * @param {number} t
 * @param {{ bus?: { emit?: (type: string, payload?: object) => void } }} [opts]
 */
export function tickBattleRage(actor, t, opts = {}) {
  const until = Number(actor.battleRageUntil) || 0;
  if (until <= 0) return;
  if (t + 1e-9 < until) return;
  const dur = Number(actor._battleRageDur) || 0;
  actor.battleRageUntil = 0;
  actor.battleRage = false;
  actor._battleRageDur = 0;
  opts.bus?.emit?.('battle_rage_ended', { t, duration: dur });
}
