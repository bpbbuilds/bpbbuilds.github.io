/**
 * Item Library packer — mirrors game ItemLibrary cursor placement.
 *
 * - Forward cursor (findPos → incrementCursor); with Compact (game default)
 *   curPos resets to resetPos after each item; resetPos advances on 1-cell items
 * - Occupancy uses body cells (value 1), not stars/diamonds/specials
 * - Anchor = topmost body row’s leftmost cell (not full AABB min)
 * - Returned (x,y) is body AABB top-left for rendering
 */

import { shapeForItem } from './shape.js';

/**
 * @typedef {{ id: string, x: number, y: number }} Placement
 * @typedef {{ placements: Placement[], cols: number, rows: number }} PackResult
 */

/**
 * Game getNormalizedCollisionCells minimum:
 * among cells with smallest y, pick smallest x.
 * @param {{ x: number, y: number }[]} cells
 */
function gameAnchor(cells) {
  let minY = Infinity;
  let minX = Infinity;
  for (const c of cells) {
    if (c.y < minY) {
      minY = c.y;
      minX = c.x;
    } else if (c.y === minY && c.x < minX) {
      minX = c.x;
    }
  }
  return { x: minX, y: minY };
}

/**
 * Cached pack geometry (relative body cells + AABB shift to render origin).
 * @param {object} item
 * @returns {{ relCells: { x: number, y: number }[], relMinX: number, relMinY: number } | null}
 */
export function packGeom(item) {
  if (item.__bpbPack !== undefined) return item.__bpbPack;
  const shape = shapeForItem(item);
  const body = shape.body;
  if (!body.length) {
    item.__bpbPack = null;
    return null;
  }
  const anchor = gameAnchor(body);
  const relCells = body.map((c) => ({
    x: c.x - anchor.x,
    y: c.y - anchor.y,
  }));
  let relMinX = 0;
  let relMinY = 0;
  for (const c of relCells) {
    if (c.x < relMinX) relMinX = c.x;
    if (c.y < relMinY) relMinY = c.y;
  }
  item.__bpbPack = { relCells, relMinX, relMinY };
  return item.__bpbPack;
}

/**
 * @param {object[]} items — each needs id + shape; order is catalog order
 * @param {number} cols
 * @param {{
 *   compact?: boolean,
 *   groupKey?: (item: object) => string | number,
 *   flow?: 'row' | 'column',
 * }} [opts] — Compact = game default on.
 *   groupKey: when the key changes, jump past the prior group
 *   (ItemLibrary.addLineBreak) so groups don't fill into each other's silhouette.
 *   flow `row` (default): `cols` is the width and the cursor moves right, then down.
 *   flow `column`: `cols` is the row count and the cursor moves down, then right.
 * @returns {PackResult}
 */
export function packItems(items, cols, opts = {}) {
  const flow = opts.flow === 'column' ? 'column' : 'row';
  const limit = Math.max(1, Math.floor(cols) || 1);
  /** Column flow grows sideways; this caps x and keys the occupancy set. */
  const width = flow === 'row' ? limit : 100000;
  let height = flow === 'column' ? limit : 100000;
  const compact = opts.compact !== false;
  const groupKey = typeof opts.groupKey === 'function' ? opts.groupKey : null;
  /** Numeric keys (y * width + x) — faster than string coords. */
  /** @type {Set<number>} */
  const filled = new Set();

  function fitsAt(relCells, ox, oy) {
    for (const c of relCells) {
      const x = ox + c.x;
      const y = oy + c.y;
      if (x < 0 || y < 0 || x >= width || y >= height || filled.has(y * width + x)) return false;
    }
    return true;
  }

  function stamp(relCells, ox, oy) {
    for (const c of relCells) {
      filled.add((oy + c.y) * width + (ox + c.x));
    }
  }

  let curX = 0;
  let curY = 0;
  let resetX = 0;
  let resetY = 0;
  let maxX = 0;
  let maxY = 0;
  /** @type {string | number | null} */
  let lastGroupKey = null;
  let placedAny = false;

  function incrementCursor() {
    if (flow === 'column') {
      curY += 1;
      if (curY >= height) {
        curY = 0;
        curX += 1;
      }
      return;
    }
    curX += 1;
    if (curX >= width) {
      curX = 0;
      curY += 1;
    }
  }

  /** Game ItemLibrary.addLineBreak. Column flow starts the next group to the right. */
  function addLineBreak() {
    if (flow === 'column') {
      curX = maxX + 1;
      curY = 0;
      resetX = curX;
      resetY = curY;
      return;
    }
    curX = 0;
    curY = maxY + 1;
    resetX = curX;
    resetY = curY;
  }

  function findPos(relCells) {
    let guard = 0;
    const bound = (flow === 'column' ? height : width) * 8000;
    while (guard < bound) {
      if (fitsAt(relCells, curX, curY)) return;
      incrementCursor();
      guard += 1;
    }
  }

  /** @type {Placement[]} */
  const placements = [];

  for (const item of items) {
    const geom = packGeom(item);
    if (!geom) continue;
    const { relCells, relMinX, relMinY } = geom;

    if (groupKey) {
      const key = groupKey(item);
      if (placedAny && key !== lastGroupKey) addLineBreak();
      lastGroupKey = key;
    }

    if (flow === 'column') {
      let spanY = 1;
      for (const c of relCells) spanY = Math.max(spanY, c.y + 1);
      if (spanY > height) height = spanY;
    }

    findPos(relCells);
    stamp(relCells, curX, curY);

    placements.push({ id: item.id, x: curX + relMinX, y: curY + relMinY });
    placedAny = true;

    for (const c of relCells) {
      maxX = Math.max(maxX, curX + c.x);
      maxY = Math.max(maxY, curY + c.y);
    }

    incrementCursor();

    if (relCells.length === 1) {
      resetX = curX;
      resetY = curY;
    }

    if (compact) {
      curX = resetX;
      curY = resetY;
    }
  }

  return {
    placements,
    cols: flow === 'column' ? Math.max(1, maxX + 1) : width,
    rows: Math.max(1, maxY + 1),
  };
}

/**
 * @param {number} containerWidth
 * @param {number} [cellPx=34]
 * @param {number} [minCols=8]
 * @param {number} [maxCols=28]
 */
export function colsForWidth(containerWidth, cellPx = 34, minCols = 8, maxCols = 28) {
  const n = Math.floor(Math.max(0, containerWidth) / cellPx);
  return Math.min(maxCols, Math.max(minCols, n || minCols));
}
