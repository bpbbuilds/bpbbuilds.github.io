/**
 * Board occupancy / placement — mirrors Inventory.gd bag vs item rules.
 *
 * Preview (green highlight): float item → world_to_map each body cell
 *   (Inventory.previewItem / getCellsForGlobalPositions).
 * Drop: same cells + optional 1-cell snap shifts (Inventory.tryAddItem).
 */

import { shapeForItem, bodyBounds } from '../../shared/backpack-grid/index.js';
import { EDIT_MODE } from './editor-state.js';

export const BOARD_COLS = 9;
export const BOARD_ROWS = 7;

/**
 * @typedef {import('./editor-state.js').EditMode} EditMode
 */

/**
 * @param {object | null | undefined} item
 */
export function isBagItem(item) {
  return String(item?.type || '') === 'Bag';
}

/**
 * @param {object | null | undefined} item
 */
export function isGemItem(item) {
  const type = String(item?.type || '');
  return type === 'Gem' || type.includes('Gemstone');
}

/**
 * Game setItemEditMode / GridStorageEntry — may this type be picked or catalog-dragged?
 * @param {object | null | undefined} item
 * @param {EditMode} [editMode]
 */
export function canPickItem(item, editMode = EDIT_MODE.DEFAULT) {
  if (!item) return false;
  if (editMode === EDIT_MODE.BAG_LAYER) return isBagItem(item);
  if (editMode === EDIT_MODE.ITEM_LAYER) return !isBagItem(item);
  return true;
}

/**
 * SelectionBox.canPickFromInventory for LMB (no RMB item-marquee on web).
 * Default / BagLayer → bags only; ItemLayer → non-bags.
 * @param {object | null | undefined} item
 * @param {EditMode} [editMode]
 */
export function canMarqueePick(item, editMode = EDIT_MODE.DEFAULT) {
  if (!canPickItem(item, editMode)) return false;
  if (editMode === EDIT_MODE.DEFAULT) return isBagItem(item);
  return true;
}

/**
 * Absolute body cells for a placement.
 * Placement (x,y) is the body AABB top-left (same as pack / placeEntry), so
 * shape body coords must be shifted by bodyBounds min — items like Moon Shield
 * have star padding so body does not start at (0,0) in the matrix.
 *
 * @param {object} item
 * @param {{ x: number, y: number, r?: number }} p
 * @returns {{ x: number, y: number }[]}
 */
export function placementBodyCells(item, p) {
  if (!item) return [];
  const face = ((Number(p.r) || 0) % 4 + 4) % 4;
  const shape = shapeForItem(item, face);
  const bounds = bodyBounds(shape);
  const ox = Number(p.x) || 0;
  const oy = Number(p.y) || 0;
  return shape.body.map((c) => ({
    x: ox + c.x - bounds.minX,
    y: oy + c.y - bounds.minY,
  }));
}

/**
 * Continuous AABB top-left in board cells from drag-cursor center
 * (cursor uses translate(-50%,-50%) on the body AABB).
 * @param {HTMLElement} board
 * @param {object} item
 * @param {number} r
 * @param {number} clientX
 * @param {number} clientY
 * @param {DOMRect} [boardRect] cached getBoundingClientRect
 * @returns {{ x: number, y: number, w: number, h: number } | null}
 */
export function floatOriginAtPointer(board, item, r, clientX, clientY, boardRect) {
  if (!(board instanceof HTMLElement) || !item) return null;
  const rect = boardRect || board.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const face = ((Number(r) || 0) % 4 + 4) % 4;
  const body = bodyBounds(shapeForItem(item, face));
  const cellW = rect.width / BOARD_COLS;
  const cellH = rect.height / BOARD_ROWS;
  return {
    x: (clientX - rect.left) / cellW - body.w / 2,
    y: (clientY - rect.top) / cellH - body.h / 2,
    w: body.w,
    h: body.h,
  };
}

/**
 * Inventory.getCellsForGlobalPositions(item.getCollisionPoints()) while floating.
 * Each body cell center is floored onto the board grid.
 * @param {object} item
 * @param {{ x: number, y: number }} floatOrigin
 * @param {number} [r]
 * @returns {{ x: number, y: number }[]}
 */
export function bodyCellsFromFloat(item, floatOrigin, r = 0) {
  if (!item || !floatOrigin) return [];
  const face = ((Number(r) || 0) % 4 + 4) % 4;
  const shape = shapeForItem(item, face);
  const bounds = bodyBounds(shape);
  const fx = Number(floatOrigin.x) || 0;
  const fy = Number(floatOrigin.y) || 0;
  return shape.body.map((c) => ({
    x: Math.floor(fx + (c.x - bounds.minX) + 0.5),
    y: Math.floor(fy + (c.y - bounds.minY) + 0.5),
  }));
}

/**
 * @param {{ x: number, y: number }[]} cells
 * @param {number} [cols]
 * @param {number} [rows]
 */
export function cellsInBounds(cells, cols = BOARD_COLS, rows = BOARD_ROWS) {
  for (const c of cells) {
    if (c.x < 0 || c.y < 0 || c.x >= cols || c.y >= rows) return false;
  }
  return true;
}

/**
 * @param {string | null | undefined | string[] | Set<string>} skip
 * @returns {Set<string> | null}
 */
export function toSkipSet(skip) {
  if (skip == null || skip === '') return null;
  if (skip instanceof Set) return skip.size ? skip : null;
  if (Array.isArray(skip)) {
    const s = new Set(skip.filter(Boolean).map(String));
    return s.size ? s : null;
  }
  return new Set([String(skip)]);
}

/**
 * @param {object} p
 * @param {Set<string> | null} skip
 */
function placementSkipped(p, skip) {
  return !!(skip && p?.key && skip.has(p.key));
}

/**
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @param {string | null | string[] | Set<string>} [skipKey]
 */
export function bagCellsSet(placements, itemsById, skipKey = null) {
  const skip = toSkipSet(skipKey);
  /** @type {Set<string>} */
  const set = new Set();
  for (const p of placements) {
    if (placementSkipped(p, skip)) continue;
    const item = itemsById.get(p.id);
    if (!isBagItem(item)) continue;
    for (const c of placementBodyCells(item, p)) {
      set.add(`${c.x},${c.y}`);
    }
  }
  return set;
}

/**
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @param {string | null | string[] | Set<string>} [skipKey]
 */
export function filledCellsSet(placements, itemsById, skipKey = null) {
  const skip = toSkipSet(skipKey);
  /** @type {Set<string>} */
  const set = new Set();
  for (const p of placements) {
    if (placementSkipped(p, skip)) continue;
    const item = itemsById.get(p.id);
    if (!item || isBagItem(item)) continue;
    for (const c of placementBodyCells(item, p)) {
      set.add(`${c.x},${c.y}`);
    }
  }
  return set;
}

/**
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @param {string | null | string[] | Set<string>} [skipKey]
 */
export function occupiedSet(placements, itemsById, skipKey = null) {
  const skip = toSkipSet(skipKey);
  /** @type {Set<string>} */
  const set = new Set();
  for (const p of placements) {
    if (placementSkipped(p, skip)) continue;
    const item = itemsById.get(p.id);
    if (!item) continue;
    for (const c of placementBodyCells(item, p)) {
      set.add(`${c.x},${c.y}`);
    }
  }
  return set;
}

/**
 * Inventory.canAddBag / canAddItem on an explicit cell list.
 * ItemLayer: placable = full board (getPlacableCells → inventoryCells).
 * @param {object} item
 * @param {{ x: number, y: number }[]} cells
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @param {string | null} [skipKey]
 * @param {EditMode} [editMode]
 */
export function canAddCells(
  item,
  cells,
  placements,
  itemsById,
  skipKey = null,
  editMode = EDIT_MODE.DEFAULT,
) {
  if (!item || !cells.length || !cellsInBounds(cells)) return false;
  if (!canPickItem(item, editMode)) return false;
  if (isBagItem(item)) {
    const bags = bagCellsSet(placements, itemsById, skipKey);
    return cells.every((c) => !bags.has(`${c.x},${c.y}`));
  }
  const filled = filledCellsSet(placements, itemsById, skipKey);
  if (editMode === EDIT_MODE.ITEM_LAYER) {
    return cells.every((c) => !filled.has(`${c.x},${c.y}`));
  }
  const bags = bagCellsSet(placements, itemsById, skipKey);
  return cells.every((c) => {
    const k = `${c.x},${c.y}`;
    return bags.has(k) && !filled.has(k);
  });
}

/**
 * Inventory.canAddBag / canAddItem for an integer AABB origin.
 * @param {object} item
 * @param {{ x: number, y: number, r?: number }} candidate
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @param {string | null} [skipKey]
 * @param {number} [cols]
 * @param {number} [rows]
 * @param {EditMode} [editMode]
 */
export function canPlace(
  item,
  candidate,
  placements,
  itemsById,
  skipKey = null,
  editMode = EDIT_MODE.DEFAULT,
  cols = BOARD_COLS,
  rows = BOARD_ROWS,
) {
  const cells = placementBodyCells(item, candidate);
  if (!cells.length || !cellsInBounds(cells, cols, rows)) return false;
  return canAddCells(item, cells, placements, itemsById, skipKey, editMode);
}

/**
 * @param {{ x: number, y: number }[]} cells
 * @returns {{ x: number, y: number } | null}
 */
function originFromCells(cells) {
  if (!cells.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
  return { x: minX, y: minY };
}

const SHIFT_DIRS = [
  { x: 0, y: 0 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
];

/**
 * Preview highlight cells while floating (Inventory.previewItem — no snap shift).
 * @returns {{ cells: { x: number, y: number }[], valid: boolean }}
 */
export function previewHoverFromFloat(
  item,
  floatOrigin,
  r,
  placements,
  itemsById,
  skipKey = null,
  editMode = EDIT_MODE.DEFAULT,
) {
  const cells = bodyCellsFromFloat(item, floatOrigin, r);
  return {
    cells,
    valid: canAddCells(item, cells, placements, itemsById, skipKey, editMode),
  };
}

/**
 * Drop target: float → cells, then tryAddItem 1-cell snap shifts.
 * @returns {{ x: number, y: number } | null}
 */
export function findPlaceFromFloat(
  item,
  floatOrigin,
  r,
  placements,
  itemsById,
  skipKey = null,
  editMode = EDIT_MODE.DEFAULT,
) {
  if (!item || !floatOrigin) return null;
  const face = ((Number(r) || 0) % 4 + 4) % 4;
  const baseCells = bodyCellsFromFloat(item, floatOrigin, face);
  if (!baseCells.length) return null;

  const shape = shapeForItem(item, face);
  const bounds = bodyBounds(shape);
  const first = shape.body[0];
  const cx = Number(floatOrigin.x) + (first.x - bounds.minX) + 0.5;
  const cy = Number(floatOrigin.y) + (first.y - bounds.minY) + 0.5;
  const mappedX = Math.floor(cx);
  const mappedY = Math.floor(cy);
  const difX = cx - (mappedX + 0.5);
  const difY = cy - (mappedY + 0.5);

  const dirs = SHIFT_DIRS.slice().sort((a, b) => {
    if (a.x === 0 && a.y === 0) return -1;
    if (b.x === 0 && b.y === 0) return 1;
    return b.x * difX + b.y * difY - (a.x * difX + a.y * difY);
  });

  for (const d of dirs) {
    const shifted = baseCells.map((c) => ({ x: c.x + d.x, y: c.y + d.y }));
    if (!canAddCells(item, shifted, placements, itemsById, skipKey, editMode)) continue;
    return originFromCells(shifted);
  }
  return null;
}

/**
 * @deprecated Prefer floatOriginAtPointer + findPlaceFromFloat.
 */
export function findPlaceCell(
  boardEl,
  item,
  r,
  clientX,
  clientY,
  placements,
  itemsById,
  skipKey = null,
  editMode = EDIT_MODE.DEFAULT,
) {
  const board =
    boardEl.querySelector?.('.bpb-bg__board') ||
    boardEl.closest?.('.bpb-bg')?.querySelector('.bpb-bg__board') ||
    boardEl;
  if (!(board instanceof HTMLElement)) return null;
  const floatOrigin = floatOriginAtPointer(board, item, r, clientX, clientY);
  return findPlaceFromFloat(
    item,
    floatOrigin,
    r,
    placements,
    itemsById,
    skipKey,
    editMode,
  );
}

/**
 * Snap pointer (client coords) to board cell under cursor.
 * @param {HTMLElement} boardEl
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{ x: number, y: number } | null}
 */
export function cellAtPointer(boardEl, clientX, clientY) {
  const board =
    boardEl.querySelector?.('.bpb-bg__board') ||
    boardEl.closest?.('.bpb-bg')?.querySelector('.bpb-bg__board') ||
    boardEl;
  if (!(board instanceof HTMLElement)) return null;
  const rect = board.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const cellW = rect.width / BOARD_COLS;
  const cellH = rect.height / BOARD_ROWS;
  const x = Math.floor((clientX - rect.left) / cellW);
  const y = Math.floor((clientY - rect.top) / cellH);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/**
 * Bag.getItemsInside / Inventory.getItemsInCells(bag.occupiedCells).
 * Any non-bag item that occupies at least one of this bag’s cells — including
 * items that also sit in a neighboring bag (straddling footprints).
 * @param {object} bagItem
 * @param {{ x: number, y: number, r?: number, key?: string }} bagP
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 */
export function placementsInsideBag(bagItem, bagP, placements, itemsById) {
  const bagKeys = new Set(
    placementBodyCells(bagItem, bagP).map((c) => `${c.x},${c.y}`),
  );
  /** @type {object[]} */
  const inside = [];
  for (const p of placements) {
    if (bagP.key && p.key === bagP.key) continue;
    const item = itemsById.get(p.id);
    if (!item || isBagItem(item)) continue;
    const cells = placementBodyCells(item, p);
    if (!cells.length) continue;
    if (cells.some((c) => bagKeys.has(`${c.x},${c.y}`))) inside.push(p);
  }
  return inside;
}

/**
 * Inventory.isItemFloating — item has a body cell outside all bag space.
 * @param {object} placement
 * @param {Set<string>} bagKeys
 * @param {Map<string, object>} itemsById
 */
export function isPlacementFloating(placement, bagKeys, itemsById) {
  const item = itemsById.get(placement.id);
  if (!item || isBagItem(item)) return false;
  const cells = placementBodyCells(item, placement);
  if (!cells.length) return true;
  return cells.some((c) => !bagKeys.has(`${c.x},${c.y}`));
}

/**
 * Inventory.pushFloatingItemsToStorage — split non-bag items that left bag space.
 * Callers must park `floating` (game storage); do not void them.
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @returns {{ kept: object[], floating: object[] }}
 */
export function extractFloatingItems(placements, itemsById) {
  const bagKeys = bagCellsSet(placements, itemsById);
  /** @type {object[]} */
  const kept = [];
  /** @type {object[]} */
  const floating = [];
  for (const p of placements) {
    if (isPlacementFloating(p, bagKeys, itemsById)) floating.push(p);
    else kept.push(p);
  }
  return { kept, floating };
}

/**
 * Board-only view after float cleanup (callers that park separately).
 * Prefer extractFloatingItems + park when mutating state.
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 */
export function withoutFloatingItems(placements, itemsById) {
  return extractFloatingItems(placements, itemsById).kept;
}
