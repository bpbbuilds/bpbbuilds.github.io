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
 * @param {{ bus?: { emit?: (type: string, payload?: object) => void }, sourceId?: string, applyBonus?: boolean }} [opts]
 */
export function startBattleRage(actor, durationSec, nowT, opts = {}) {
  const baseDur = Math.max(0, Number(durationSec) || 0);
  const bonusDur = opts.applyBonus === false
    ? 0
    : Math.max(0, Number(actor.battleRageBonusDur) || 0);
  const dur = baseDur + bonusDur;
  const now = Number(nowT) || 0;
  const until = dur > 0 ? now + dur : 0;
  actor.battleRageUntil = until;
  actor.battleRage = dur > 0;
  actor._battleRageDur = dur;
  opts.bus?.emit?.('battle_rage_started', {
    actor,
    t: now,
    duration: dur,
    untilT: actor.battleRageUntil,
    sourceId: opts.sourceId ?? null,
  });
}

/**
 * Character.endBattleRage — stop the timer and emit the source end event.
 * @param {import('./actor.js').SimActor} actor
 * @param {number} t
 * @param {{ bus?: { emit?: (type: string, payload?: object) => void } }} [opts]
 */
export function endBattleRage(actor, t, opts = {}) {
  const duration = Number(actor._battleRageDur) || 0;
  actor.battleRageUntil = 0;
  actor.battleRage = false;
  actor._battleRageDur = 0;
  opts.bus?.emit?.('battle_rage_ended', { actor, t, duration });
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
  endBattleRage(actor, t, opts);
}
