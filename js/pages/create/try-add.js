/**
 * Inventory.tryAddItem / previewItem — commit-only snap + collision outcomes.
 * DistanceSorter diagonal punish 1.7; hotswap (1) + multi rehome (2+).
 */

import { shapeForItem, bodyBounds } from '../../shared/backpack-grid/index.js';
import { EDIT_MODE } from './editor-state.js';
import {
  BOARD_COLS,
  BOARD_ROWS,
  bagCellsSet,
  bodyCellsFromFloat,
  canAddCells,
  canPickItem,
  cellsInBounds,
  filledCellsSet,
  isBagItem,
  placementBodyCells,
  toSkipSet,
} from './collision.js';

/** Inventory.DistanceSorter */
const DIAG_PUNISH = 1.7;

const SHIFT_NEIGHBORS = [
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: -1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
];

/** Inventory.neighborOffsets for multi rehome */
const REHOME_OFFSETS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 0, y: 1 },
];

/**
 * @typedef {'ok' | 'ok_bag' | 'fail' | 'fail_bag' | 'collision' | 'outside'} HoverKind
 */

/**
 * @param {{ x: number, y: number }} dif normalized offset toward cell center
 * @returns {{ x: number, y: number }[]}
 */
function sortedShiftDirs(dif) {
  const base = { x: dif.x, y: dif.y };
  const scored = SHIFT_NEIGHBORS.map((d) => {
    let dx = d.x;
    let dy = d.y;
    if (dx !== 0 && dy !== 0) {
      dx *= DIAG_PUNISH;
      dy *= DIAG_PUNISH;
    }
    const distSq = (dx - base.x) ** 2 + (dy - base.y) ** 2;
    return { d, distSq };
  });
  scored.sort((a, b) => a.distSq - b.distSq);
  return [{ x: 0, y: 0 }, ...scored.map((s) => s.d)];
}

/**
 * Cells must lie in placable region (ignore item fill — collisions handled after).
 * @param {object} item
 * @param {{ x: number, y: number }[]} cells
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @param {string | null} skipKey
 * @param {import('./editor-state.js').EditMode} editMode
 */
export function cellsInPlacableRegion(
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
    // Game tryAddItem(bag): only isInventoryCell — bag overlaps become collisions/hotswap.
    // (canAddBag / PotentialSpace is separate — used by canAddCells for “clean place”.)
    return true;
  }
  if (editMode === EDIT_MODE.ITEM_LAYER) return true;
  const bags = bagCellsSet(placements, itemsById, skipKey);
  return cells.every((c) => bags.has(`${c.x},${c.y}`));
}

/**
 * @param {{ x: number, y: number }[]} cells
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @param {string | null} skipKey
 * @param {boolean} bagsOnly
 * @returns {object[]} unique colliding placements
 */
export function collisionsInCells(
  cells,
  placements,
  itemsById,
  skipKey = null,
  bagsOnly = false,
) {
  const skip = toSkipSet(skipKey);
  /** @type {Map<string, object>} */
  const hit = new Map();
  for (const p of placements) {
    if (skip && p.key && skip.has(p.key)) continue;
    const it = itemsById.get(p.id);
    if (!it) continue;
    const bag = isBagItem(it);
    if (bagsOnly ? !bag : bag) continue;
    const body = placementBodyCells(it, p);
    for (const c of cells) {
      if (body.some((b) => b.x === c.x && b.y === c.y)) {
        hit.set(p.key, p);
        break;
      }
    }
  }
  return [...hit.values()];
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

/**
 * Preview taxonomy while floating (Inventory.previewItem — no snap).
 * @returns {{ cells: { x: number, y: number, kind: HoverKind }[], valid: boolean }}
 */
export function previewTaxonomyFromFloat(
  item,
  floatOrigin,
  r,
  placements,
  itemsById,
  skipKey = null,
  editMode = EDIT_MODE.DEFAULT,
) {
  const cells = bodyCellsFromFloat(item, floatOrigin, r);
  const bag = isBagItem(item);
  const valid = canAddCells(item, cells, placements, itemsById, skipKey, editMode);
  const bags = bagCellsSet(placements, itemsById, skipKey);
  const filled = filledCellsSet(placements, itemsById, skipKey);

  /** @type {{ x: number, y: number, kind: HoverKind }[]} */
  const out = [];
  for (const c of cells) {
    if (c.x < 0 || c.y < 0 || c.x >= BOARD_COLS || c.y >= BOARD_ROWS) continue;
    const k = `${c.x},${c.y}`;
    /** @type {HoverKind} */
    let kind;
    if (bag) {
      if (valid) kind = 'ok_bag';
      else kind = bags.has(k) ? 'fail_bag' : 'fail_bag';
    } else if (valid) {
      kind = 'ok';
    } else if (filled.has(k)) {
      kind = 'collision';
    } else if (!bags.has(k) && editMode !== EDIT_MODE.ITEM_LAYER) {
      // Empty (not PotentialSpace) → CantAdd_outside
      kind = 'outside';
    } else {
      // On bag / ItemLayer but can't add → CantAdd
      kind = 'fail';
    }
    out.push({ x: c.x, y: c.y, kind });
  }
  return { cells: out, valid };
}

/**
 * @typedef {{
 *   origin: { x: number, y: number },
 *   cells: { x: number, y: number }[],
 *   collisions: object[],
 * }} TryAddResult
 */

/**
 * Commit drop target (Inventory.tryAddItem snap + collect collisions).
 * Does not mutate state — caller places / hotswaps / rehomes.
 * @param {object} item
 * @param {{ x: number, y: number }} floatOrigin
 * @param {number} r
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 * @param {string | null | string[] | Set<string>} [skipKey]
 * @param {import('./editor-state.js').EditMode} [editMode]
 * @param {{ canSnap?: boolean }} [opts] canSnap false → origin only (Item.canSnap)
 * @returns {TryAddResult | null}
 */
export function tryAddFromFloat(
  item,
  floatOrigin,
  r,
  placements,
  itemsById,
  skipKey = null,
  editMode = EDIT_MODE.DEFAULT,
  opts = {},
) {
  if (!item || !floatOrigin) return null;
  const face = ((Number(r) || 0) % 4 + 4) % 4;
  const baseCells = bodyCellsFromFloat(item, floatOrigin, face);
  if (!baseCells.length) return null;

  const bag = isBagItem(item);
  const canSnap = opts.canSnap !== false;

  if (bag) {
    if (
      !cellsInPlacableRegion(
        item, baseCells, placements, itemsById, skipKey, editMode,
      )
    ) {
      return null;
    }
    const origin = originFromCells(baseCells);
    if (!origin) return null;
    const collisions = collisionsInCells(
      baseCells, placements, itemsById, skipKey, true,
    );
    return { origin, cells: baseCells, collisions };
  }

  const shape = shapeForItem(item, face);
  const bounds = bodyBounds(shape);
  const first = shape.body[0];
  const cx = Number(floatOrigin.x) + (first.x - bounds.minX) + 0.5;
  const cy = Number(floatOrigin.y) + (first.y - bounds.minY) + 0.5;
  const mappedX = Math.floor(cx);
  const mappedY = Math.floor(cy);
  const dif = {
    x: cx - (mappedX + 0.5),
    y: cy - (mappedY + 0.5),
  };
  const len = Math.hypot(dif.x, dif.y) || 1;
  // Item.canSnap — cargo / multi-select: no 1-cell neighbor snap
  const dirs = canSnap
    ? sortedShiftDirs({ x: dif.x / len, y: dif.y / len })
    : [{ x: 0, y: 0 }];

  for (const d of dirs) {
    const shifted = baseCells.map((c) => ({ x: c.x + d.x, y: c.y + d.y }));
    if (
      !cellsInPlacableRegion(
        item, shifted, placements, itemsById, skipKey, editMode,
      )
    ) {
      continue;
    }
    const origin = originFromCells(shifted);
    if (!origin) continue;
    const collisions = collisionsInCells(
      shifted, placements, itemsById, skipKey, false,
    );
    return { origin, cells: shifted, collisions };
  }
  return null;
}

/**
 * Legacy helper — empty place only (no hotswap). Prefer tryAddFromFloat.
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
  const result = tryAddFromFloat(
    item, floatOrigin, r, placements, itemsById, skipKey, editMode, { canSnap: true },
  );
  if (!result || result.collisions.length) return null;
  return result.origin;
}

/**
 * Multi-collision free-board rehome (Shop tryAdd without storage).
 * Prefer fewest options first; leftovers become hotswap queue.
 *
 * @param {object[]} colliders placements to rehome
 * @param {object[]} placements board after held item placed & colliders removed
 * @param {Map<string, object>} itemsById
 * @param {import('./editor-state.js').EditMode} editMode
 * @returns {{ placed: { key: string, x: number, y: number }[], leftovers: object[] }}
 */
export function rehomeColliders(
  colliders,
  placements,
  itemsById,
  editMode = EDIT_MODE.DEFAULT,
) {
  /** @type {{ collider: object, options: { x: number, y: number }[] }[]} */
  const scored = [];
  for (const collider of colliders) {
    const item = itemsById.get(collider.id);
    if (!item) continue;
    const face = ((Number(collider.r) || 0) % 4 + 4) % 4;
    /** @type {{ x: number, y: number }[]} */
    const options = [];
    for (const off of REHOME_OFFSETS) {
      const cand = {
        x: Number(collider.x) + off.x,
        y: Number(collider.y) + off.y,
        r: face,
      };
      const cells = placementBodyCells(item, cand);
      if (
        canAddCells(item, cells, placements, itemsById, null, editMode)
      ) {
        options.push({ x: cand.x, y: cand.y });
      }
    }
    scored.push({ collider, options });
  }
  scored.sort((a, b) => a.options.length - b.options.length);

  /** @type {{ key: string, x: number, y: number }[]} */
  const placed = [];
  /** @type {object[]} */
  const leftovers = [];
  let working = placements.slice();

  for (let i = 0; i < scored.length; i += 1) {
    const { collider, options } = scored[i];
    const item = itemsById.get(collider.id);
    let added = false;
    if (item) {
      for (const topLeft of options) {
        const cand = { x: topLeft.x, y: topLeft.y, r: collider.r };
        const cells = placementBodyCells(item, cand);
        if (canAddCells(item, cells, working, itemsById, null, editMode)) {
          working = [
            ...working,
            { ...collider, x: topLeft.x, y: topLeft.y },
          ];
          placed.push({ key: collider.key, x: topLeft.x, y: topLeft.y });
          added = true;
          break;
        }
      }
    }
    // Game: always hotswap one item on multi (last if all fit)
    const isLast = i === scored.length - 1;
    if (!added) {
      leftovers.push(collider);
    } else if (isLast && leftovers.length === 0) {
      // Match Shop: pick up the last rehomed as hotswap feel
      const last = placed.pop();
      if (last) {
        working = working.filter((p) => p.key !== last.key);
        leftovers.push(collider);
      }
    }
  }

  return { placed, leftovers, working };
}
