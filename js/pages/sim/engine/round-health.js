/**
 * Game.getMaxHealthInRound / getHealthGain — classResources.health is 25
 * for every class (Ranger.tres etc.). Training dummy keeps DUMMY_MAX_HP
 * unless a round is set (then both sides use this so early-round tests finish).
 */

import { DUMMY_MAX_HP, PLAYER_MAX_HP } from './actor.js';

/** CharacterClass.health on every shipped class .tres */
export const CLASS_START_HEALTH = 25;

/**
 * Game.getHealthGain(inRound)
 * @param {number} inRound
 */
export function getHealthGain(inRound) {
  const r = Math.floor(Number(inRound) || 0);
  if (r >= 15) return 30;
  if (r >= 10) return 20;
  if (r >= 5) return 15;
  if (r >= 2) return 10;
  return 0;
}

/**
 * Game.getMaxHealthInRound(class, untilRound) — class health is always 25.
 * Round 1 = 25; each later round adds getHealthGain(that round).
 * @param {number | null | undefined} untilRound
 * @param {number} [fallback=PLAYER_MAX_HP]
 */
export function getMaxHealthInRound(untilRound, fallback = PLAYER_MAX_HP) {
  const r = Math.floor(Number(untilRound) || 0);
  if (!(r >= 1)) return fallback;
  let health = CLASS_START_HEALTH;
  for (let i = 2; i <= r; i += 1) health += getHealthGain(i);
  return health;
}

/**
 * @param {number | null | undefined} round
 * @param {boolean} vsBoard
 * @param {number | null | undefined} opponentRound
 */
export function actorMaxHpForSim(round, vsBoard, opponentRound) {
  const you = getMaxHealthInRound(round);
  const themRound = vsBoard ? opponentRound ?? round : round;
  const them = vsBoard
    ? getMaxHealthInRound(themRound)
    : getMaxHealthInRound(round, DUMMY_MAX_HP);
  return { player: you, dummy: them };
}
