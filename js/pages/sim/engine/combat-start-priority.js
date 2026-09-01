/**
 * Item.getTriggerPriority() — Game shuffles then sorts descending before combatStart.
 * Default (omitted) is Priority.Normal = 0.
 */

import { shuffleInPlace } from './rng.js';

export const PRIORITY = {
  Lowest: -10000,
  Low: -1000,
  Normal: 0,
  High: 1000,
  Highest: 10000,
};

/** @type {Record<string, number>} */
export const COMBAT_START_PRIORITY = {
  deer_totem: PRIORITY.Highest,
  time_melting: PRIORITY.High + 100,
  puzzlebag_j: PRIORITY.High + 100,
  berserker_bag: PRIORITY.High + 10,
  wolf_badge: PRIORITY.High + 10,
  battery: PRIORITY.High + 5,
  fortunas_kiss: PRIORITY.High + 5,
  fedora: PRIORITY.High + 5,
  lucky_piggy: PRIORITY.High + 5,
  generator: PRIORITY.High + 5,
  amulet_of_fortune: PRIORITY.High + 5,
  mr_struggles: PRIORITY.High + 3,
  stone_shoes: PRIORITY.High + 3,
  stone_armor: PRIORITY.High + 3,
  hedgehog: PRIORITY.High + 3,
  arcane_boots: PRIORITY.High + 2,
  leather_boots: PRIORITY.High + 2,
  winged_boots: PRIORITY.High + 2,
  automanaton: PRIORITY.High + 2,
  stone_golem: PRIORITY.High + 1,
  strong_health_potion: PRIORITY.High + 1,
  dark_lantern: PRIORITY.High,
  health_potion: PRIORITY.High,
  shelly: PRIORITY.High,
  heart_of_darkness: PRIORITY.High,
  present: PRIORITY.Low + 1,
  just_stats: PRIORITY.Low,
  more_stats: PRIORITY.Low,
  bag_of_giving: PRIORITY.Low,
  investment_opportunity: PRIORITY.Lowest,
};

/**
 * @param {string} itemId
 */
export function combatStartPriority(itemId) {
  return COMBAT_START_PRIORITY[itemId] ?? PRIORITY.Normal;
}

/**
 * Game.gd switchToCombat: shuffle each side, sort by getTriggerPriority desc,
 * then activate playerItems + opponentItems (player batch first).
 *
 * @param {object[]} youPieces
 * @param {object[]} themPieces
 * @param {() => number} rng
 */
export function buildCombatStartOrder(youPieces, themPieces, rng) {
  /** @param {object[]} list */
  const orderSide = (list) => {
    const copy = [...list];
    shuffleInPlace(copy, rng);
    copy.sort(
      (a, b) =>
        combatStartPriority(String(b.itemId)) - combatStartPriority(String(a.itemId)),
    );
    return copy;
  };
  return [...orderSide(youPieces), ...orderSide(themPieces)];
}
