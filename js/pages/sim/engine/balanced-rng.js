/**
 * Port of Utility/BalancedRandom.gd (class_name BalancedRng).
 * State is per-instance; actual flips use the shared combat rng (game Util.flip).
 */

/**
 * @typedef {{
 *   expectedWins: number,
 *   wins: number,
 *   balancedness: number,
 *   lastResult: boolean,
 *   reset: () => void,
 *   roll: (target: number, rng: () => number) => boolean,
 *   rollPercent: (pct: number, rng: () => number) => boolean,
 * }} BalancedRng
 */

/**
 * Game Util.flip: `rng.randf() <= chance` (inclusive).
 * @param {number} chance 0..1
 * @param {() => number} rng
 */
export function utilFlip(chance, rng) {
  return rng() <= chance;
}

/**
 * @param {number} [startBias]
 * @returns {BalancedRng}
 */
export function createBalancedRng(startBias = 0) {
  /** @type {BalancedRng} */
  const self = {
    expectedWins: Number(startBias) || 0,
    wins: 0,
    balancedness: 3.0,
    lastResult: false,
    reset() {
      self.expectedWins = 0;
      self.wins = 0;
      self.lastResult = false;
    },
    roll(target, rng) {
      if (target <= 0) return false;
      if (target >= 1) return true;

      let chance = target;
      const dif = self.expectedWins - self.wins;
      if (dif > 0.3) {
        chance *= self.balancedness * Math.min(1.0, dif);
      } else if (dif < -0.3) {
        chance /= self.balancedness * Math.min(1.0, -dif);
      }

      self.expectedWins += target;

      if (self.lastResult && target < 0.4) {
        chance *= 0.5;
      } else if (!self.lastResult && target > 0.6) {
        chance *= 2.0;
      }

      const result = utilFlip(chance, rng);
      self.lastResult = result;
      if (result) {
        self.wins += 1;
        return true;
      }
      return false;
    },
    rollPercent(pct, rng) {
      return self.roll((Number(pct) || 0) / 100, rng);
    },
  };
  return self;
}
