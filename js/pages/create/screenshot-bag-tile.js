/**
 * Stand-in bags for screenshots that show items on a bare grid (other build sites).
 * The game and the editor only accept items on bag cells. Leather Bag is 2×2, so a
 * 9×7 board needs a last column and a last row of smaller bags.
 */

import { isBagItem } from './collision.js';

/**
 * @param {Map<string, object>} itemsById
 * @returns {{ id: string, name: string, x: number, y: number, r: number, score: number }[]}
 */
export function tileStandInBags(itemsById) {
  /** @type {Map<string, object>} */
  const byName = new Map();
  for (const item of itemsById.values()) {
    if (!isBagItem(item) || !item.name) continue;
    byName.set(String(item.name), item);
  }
  const leather = byName.get('Leather Bag');
  const stamina = byName.get('Stamina Sack');
  const fanny = byName.get('Fanny Pack');
  const purse = byName.get('Protective Purse');
  if (!leather || !stamina || !fanny || !purse) return [];

  /** @type {ReturnType<typeof tileStandInBags>} */
  const bags = [];
  const push = (item, x, y, r) => {
    bags.push({
      id: String(item.id),
      name: String(item.name),
      x,
      y,
      r,
      score: 0,
    });
  };

  for (let y = 0; y <= 4; y += 2) {
    for (let x = 0; x <= 6; x += 2) push(leather, x, y, 0);
  }
  push(stamina, 8, 0, 0);
  push(stamina, 8, 3, 0);
  for (let x = 0; x <= 6; x += 2) push(fanny, x, 6, 0);
  push(purse, 8, 6, 0);
  return bags;
}
