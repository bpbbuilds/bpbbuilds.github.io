/**
 * Collapse fragmented bag covers: 2+ small bags whose cells exactly form one larger catalog bag.
 */

import { shapeForItem, bodyBounds } from '../../shared/backpack-grid/index.js';
import { BOARD_COLS, BOARD_ROWS, placementBodyCells } from './collision.js';

/**
 * @param {{ id: string, name: string, x: number, y: number, r: number, score: number }[]} bags
 * @param {object[]} allBags
 * @param {Map<string, object>} itemsById
 */
export function mergeSmallBags(bags, allBags, itemsById) {
  let cur = bags.slice();
  const cellsOf = (b) =>
    placementBodyCells(itemsById.get(b.id), b).map((c) => `${c.x},${c.y}`);

  const bigFirst = allBags
    .map((item) => ({ item, n: shapeForItem(item, 0).body.length }))
    .filter((b) => b.n >= 3)
    .sort((a, b) => b.n - a.n);

  let changed = true;
  let guard = 0;
  while (changed && guard++ < 20) {
    changed = false;
    /** @type {Map<string, number>} */
    const owner = new Map();
    cur.forEach((b, i) => {
      for (const k of cellsOf(b)) owner.set(k, i);
    });

    search: for (const { item } of bigFirst) {
      for (const r of [0, 1, 2, 3]) {
        const body = bodyBounds(shapeForItem(item, r));
        for (let y = 0; y + body.h <= BOARD_ROWS; y++) {
          for (let x = 0; x + body.w <= BOARD_COLS; x++) {
            const cand = { x, y, r };
            const keys = placementBodyCells(item, cand).map((c) => `${c.x},${c.y}`);
            /** @type {Set<number>} */
            const covers = new Set();
            let ok = true;
            for (const k of keys) {
              const o = owner.get(k);
              if (o === undefined) {
                ok = false;
                break;
              }
              covers.add(o);
            }
            if (!ok || covers.size < 2) continue;
            // Keep high-confidence detector bags intact (do not fold into Coffin/etc.).
            let locked = false;
            for (const o of covers) {
              if ((Number(cur[o].score) || 0) >= 0.5) {
                locked = true;
                break;
              }
            }
            if (locked) continue;
            // Every covered bag must lie fully inside the candidate footprint.
            const keySet = new Set(keys);
            let total = 0;
            for (const o of covers) {
              const oc = cellsOf(cur[o]);
              total += oc.length;
              if (!oc.every((k) => keySet.has(k))) {
                ok = false;
                break;
              }
            }
            if (!ok || total !== keys.length) continue;
            const kept = cur.filter((_, i) => !covers.has(i));
            kept.push({
              id: String(item.id),
              name: String(item.name || item.id),
              ...cand,
              score: 0.4,
            });
            cur = kept;
            changed = true;
            break search;
          }
        }
      }
    }
  }
  return cur;
}
