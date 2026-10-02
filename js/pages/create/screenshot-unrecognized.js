/**
 * Placeholder for screenshot cells that look occupied but have no catalog class.
 */

import { placementBodyCells } from './collision.js';

export const UNRECOGNIZED_ID = '__unrecognized__';
export const UNRECOGNIZED_NAME = 'Unrecognized item';

/**
 * Catalog-shaped stub so board render / collision see a 1×1 item.
 * @returns {object}
 */
export function unrecognizedCatalogItem() {
  return {
    id: UNRECOGNIZED_ID,
    name: UNRECOGNIZED_NAME,
    type: 'Misc',
    image: '',
    rarity: 'Common',
    // Single-cell body (backpack-grid shape string).
    shape: '1',
    sprites: null,
  };
}

/**
 * @param {string | null | undefined} id
 */
export function isUnrecognizedId(id) {
  return String(id || '') === UNRECOGNIZED_ID;
}

/**
 * Turn leftover unexplained bag cells into 1×1 placeholders.
 * Skips cells already covered by placed bags/items.
 * @param {Set<string>} unexplained
 * @param {{ x: number, y: number, r?: number, id?: string }[]} [placed]
 * @param {Map<string, object> | null} [itemsById]
 * @returns {{ id: string, name: string, x: number, y: number, r: number, score: number, unrecognized: true }[]}
 */
export function placeholdersFromUnexplained(unexplained, placed = [], itemsById = null) {
  /** @type {Set<string>} */
  const covered = new Set();
  if (itemsById) {
    for (const p of placed) {
      const item = itemsById.get(String(p.id || ''));
      if (!item) continue;
      for (const c of placementBodyCells(item, p)) {
        covered.add(`${c.x},${c.y}`);
      }
    }
  }
  /** @type {{ id: string, name: string, x: number, y: number, r: number, score: number, unrecognized: true }[]} */
  const out = [];
  for (const key of [...unexplained].sort()) {
    if (covered.has(key)) continue;
    const [cs, rs] = key.split(',');
    const x = Number(cs);
    const y = Number(rs);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({
      id: UNRECOGNIZED_ID,
      name: UNRECOGNIZED_NAME,
      x,
      y,
      r: 0,
      score: 0.1,
      unrecognized: true,
    });
  }
  // Cap so a bad unexplained mask cannot flood the board.
  return out.slice(0, 8);
}
