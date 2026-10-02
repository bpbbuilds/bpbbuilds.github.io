/**
 * Lookalike groups for screenshot import shortlist / solver pool.
 * Mirror of scripts/screenshot-to-build/shapes.mjs (browser-safe, no fs).
 */

export const SABER_BLADES = [
  'Darksaber',
  'Lightsaber',
  'Hungry Blade',
  'Manathirst',
  'Bloodthorne',
  'Spectral Dagger',
  'Null Blade',
];

export const WINGED_SWORDS = [
  'Falcon Blade',
  'Hero Longsword',
  'Hero Sword',
  'Burning Blade',
  'Prismatic Sword',
  'Villain Sword',
];

export const CONFUSION_GROUPS = [
  SABER_BLADES,
  WINGED_SWORDS,
  ['Dark Lantern', 'Oil Lamp', 'Amulet of Energy', 'Amulet of Life', 'Amulet of Darkness', 'Torch'],
  ['Bunch of Coins', 'Gloves of Haste', 'Magic Ring', 'Stone Gloves'],
  ['Corrupted Armor', 'Vampiric Armor', 'Leather Armor', 'Holy Armor'],
  ['Stone', 'Whetstone', 'Bag of Stones'],
  ['Piggybank', 'Lucky Piggy', 'Piggy of Riches', 'Piggy Pinata'],
  ['Mana Orb', 'Prismatic Orb', 'Draconic Orb', 'Devouring Sphere'],
  ['Magic Mirror', 'Cold Mirror', 'Amulet of Steel'],
  ['Phoenix', 'Flame', 'Frozen Flame'],
  ['Star of Courage', 'Flame Badge', 'Stone Badge'],
  ['Treasure Chest', 'Piggybank', 'Lucky Piggy'],
];

/**
 * @param {string} name
 * @returns {string[]}
 */
export function lookalikesForName(name) {
  const n = String(name || '');
  /** @type {string[]} */
  const out = [];
  const add = (s) => {
    if (s && !out.includes(s)) out.push(s);
  };
  add(n);
  for (const g of CONFUSION_GROUPS) {
    if (!g.includes(n)) continue;
    for (const x of g) add(x);
  }
  return out;
}

/**
 * Expand a list of vision names → unique catalog names (cap).
 * @param {string[]} names
 * @param {number} [cap=40]
 */
export function expandConfusionPool(names, cap = 40) {
  /** @type {string[]} */
  const out = [];
  const add = (s) => {
    if (!s || out.includes(s) || out.length >= cap) return;
    out.push(s);
  };
  for (const n of names) {
    for (const x of lookalikesForName(n)) add(x);
  }
  return out;
}

/**
 * Names that share a confusion group with `name` (including itself).
 * @param {string} name
 * @returns {string[]}
 */
export function confusionPeers(name) {
  return lookalikesForName(name);
}

/**
 * Spend one slot from `remaining` for placing `placeName`.
 * Exact id first; else any prior id whose catalog name is a confusion peer.
 * @param {Map<string, number>} remaining  id → count
 * @param {string} placeId
 * @param {string} placeName
 * @param {Map<string, object>} itemsById
 * @returns {boolean}
 */
export function consumePriorBudget(remaining, placeId, placeName, itemsById) {
  const left = remaining.get(placeId) || 0;
  if (left > 0) {
    remaining.set(placeId, left - 1);
    return true;
  }
  const peers = new Set(confusionPeers(placeName));
  for (const [pid, n] of remaining) {
    if (!(n > 0)) continue;
    const item = itemsById.get(pid);
    const nm = String(item?.name || '');
    if (peers.has(nm) || pid === placeId) {
      remaining.set(pid, n - 1);
      return true;
    }
  }
  return false;
}
