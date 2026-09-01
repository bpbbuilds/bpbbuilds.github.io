/**
 * Combat fatigue clock — CombatTimer.gd FATIGUE_TIME (Band Z 148).
 */

/** Seconds after combat delay before fatigue starts (game FATIGUE_TIME). */
export const FATIGUE_TIME = 17;

/** First fatigue tick delay after start animation (game fatigueTickTimer 3s). */
export const FATIGUE_FIRST_TICK = 3;

/** Subsequent tick interval (game). */
export const FATIGUE_TICK_INTERVAL = 1;

/**
 * @typedef {{
 *   started: boolean,
 *   counter: number,
 *   nextTickAt: number,
 * }} FatigueState
 */

/**
 * @returns {FatigueState}
 */
export function createFatigueState() {
  return { started: false, counter: 0, nextTickAt: Infinity };
}

/**
 * Escalate counter then return damage amount (same for both actors unless bonus).
 * @param {FatigueState} state
 * @param {number} combatTime time since items live (approx combatTime in GD)
 */
export function advanceFatigueCounter(state, combatTime) {
  if (combatTime < 60) {
    state.counter += 1 + Math.floor(0.1 * state.counter);
  } else {
    state.counter += 1 + Math.floor(0.2 * state.counter);
  }
  return Math.max(0, Math.round(state.counter));
}

/**
 * Apply fatigue HP damage (ignores block).
 * @param {import('./actor.js').SimActor} actor
 * @param {number} amount
 */
export function applyFatigueDamage(actor, amount) {
  const dmg = Math.max(0, Math.round(amount));
  if (dmg <= 0 || actor.dead) return 0;
  actor.hp = Math.max(0, actor.hp - dmg);
  if (actor.hp <= 0) actor.dead = true;
  return dmg;
}
