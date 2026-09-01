/**
 * Shop inventory WASD / arrow shift (Inventory.shift / canShift).
 */

import {
  BOARD_COLS,
  BOARD_ROWS,
  isBagItem,
  placementBodyCells,
} from './collision.js';
import { EDIT_MODE } from './editor-state.js';

/**
 * @param {import('./editor-state.js').EditMode} editMode
 * @param {{ x: number, y: number }} dir
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 */
export function canShiftBoard(editMode, dir, placements, itemsById) {
  const dx = dir.x | 0;
  const dy = dir.y | 0;
  if (!dx && !dy) return false;

  for (const p of placements) {
    const item = itemsById.get(p.id);
    if (!item) continue;
    const bag = isBagItem(item);
    if (editMode === EDIT_MODE.BAG_LAYER && !bag) continue;
    if (editMode === EDIT_MODE.ITEM_LAYER && bag) continue;
    // Default: bags define border; items ride with bags
    if (editMode === EDIT_MODE.DEFAULT && !bag) continue;
    if (editMode === EDIT_MODE.ITEM_LAYER && bag) continue;

    const cells = placementBodyCells(item, p);
    for (const c of cells) {
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= BOARD_COLS || ny >= BOARD_ROWS) {
        return false;
      }
    }
  }

  // ItemLayer: also keep non-bag items on board
  if (editMode === EDIT_MODE.ITEM_LAYER) {
    for (const p of placements) {
      const item = itemsById.get(p.id);
      if (!item || isBagItem(item)) continue;
      for (const c of placementBodyCells(item, p)) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        if (nx < 0 || ny < 0 || nx >= BOARD_COLS || ny >= BOARD_ROWS) {
          return false;
        }
      }
    }
  }

  return placements.some((p) => {
    const item = itemsById.get(p.id);
    if (!item) return false;
    const bag = isBagItem(item);
    if (editMode === EDIT_MODE.BAG_LAYER) return bag;
    if (editMode === EDIT_MODE.ITEM_LAYER) return !bag;
    return bag;
  });
}

/**
 * @param {{ x: number, y: number }} dir
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @param {import('./editor-state.js').EditMode} editMode
 * @returns {object[]}
 */
export function shiftPlacements(dir, placements, itemsById, editMode) {
  const dx = dir.x | 0;
  const dy = dir.y | 0;
  return placements.map((p) => {
    const item = itemsById.get(p.id);
    if (!item) return p;
    const bag = isBagItem(item);
    if (editMode === EDIT_MODE.BAG_LAYER && !bag) return p;
    if (editMode === EDIT_MODE.ITEM_LAYER && bag) return p;
    if (editMode === EDIT_MODE.DEFAULT) {
      // Shift bags and items together (items stay relative inside bags)
      return { ...p, x: Number(p.x) + dx, y: Number(p.y) + dy };
    }
    if (editMode === EDIT_MODE.BAG_LAYER && bag) {
      return { ...p, x: Number(p.x) + dx, y: Number(p.y) + dy };
    }
    if (editMode === EDIT_MODE.ITEM_LAYER && !bag) {
      return { ...p, x: Number(p.x) + dx, y: Number(p.y) + dy };
    }
    return p;
  });
}

/**
 * @param {KeyboardEvent} e
 * @returns {{ x: number, y: number } | null}
 */
export function shiftDirFromKey(e) {
  const k = e.key;
  if (k === 'w' || k === 'W' || k === 'ArrowUp') return { x: 0, y: -1 };
  if (k === 's' || k === 'S' || k === 'ArrowDown') return { x: 0, y: 1 };
  if (k === 'a' || k === 'A' || k === 'ArrowLeft') return { x: -1, y: 0 };
  if (k === 'd' || k === 'D' || k === 'ArrowRight') return { x: 1, y: 0 };
  return null;
}
