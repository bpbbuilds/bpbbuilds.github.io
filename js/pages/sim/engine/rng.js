/**
 * Deterministic RNG for sim runs (Mulberry32).
 */

/**
 * @param {number} seed
 * @returns {() => number} 0..1
 */
export function makeRng(seed) {
  let t = (seed >>> 0) || 1;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {number} min
 * @param {number} max
 * @param {() => number} rng
 */
export function randInt(min, max, rng) {
  const a = Math.floor(min);
  const b = Math.floor(max);
  if (b <= a) return a;
  return a + Math.floor(rng() * (b - a + 1));
}

/**
 * Percent roll — true if rng*100 < pct (game accuracyRng.rollPercent style).
 * @param {number} pct
 * @param {() => number} rng
 */
export function rollPercent(pct, rng) {
  return rng() * 100 < pct;
}

/**
 * Fisher–Yates shuffle (mutates array).
 * @template T
 * @param {T[]} arr
 * @param {() => number} rng
 * @returns {T[]}
 */
export function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}
