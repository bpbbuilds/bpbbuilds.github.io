/**
 * Fabric cell mask + bag catalog helpers for screenshot bag cover.
 */

import { shapeForItem, bodyBounds } from '../../shared/backpack-grid/index.js';
import {
  BOARD_COLS,
  BOARD_ROWS,
  canPlace,
  isBagItem,
  placementBodyCells,
} from './collision.js';
import { EDIT_MODE } from './editor-state.js';

const FABRIC_FRAC = 0.35;

/**
 * Pass B residual invent — brown leather commons only.
 * No Protective Purse (1×1 flood) / Potion Belt / exotic bags (those need detector hints in Pass A).
 */
export const FILL_PREFER = ['Leather Bag', 'Fanny Pack', 'Stamina Sack'];

/**
 * @param {string} dataUrl
 * @returns {Promise<ImageData>}
 */
export async function dataUrlToRgba(dataUrl) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not decode crop'));
    el.src = dataUrl;
  });
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, w, h);
}

/**
 * Grid metrics in crop pixel space (same as screenshot-direct).
 * @param {import('../../shared/screenshot-grid.js').BagGrid | null} grid
 * @param {number} cropW
 */
export function cropGridMetrics(grid, cropW) {
  const gridOk = Boolean(grid?.ok && grid.cellW > 0 && grid.bagRect?.w > 0);
  const k = gridOk ? cropW / grid.bagRect.w : 1;
  return {
    gridOk,
    cellW: gridOk ? grid.cellW * k : cropW / BOARD_COLS,
    cellH: gridOk ? (grid.cellH || grid.cellW) * k : cropW / BOARD_COLS,
    originX: gridOk ? (grid.originX - grid.bagRect.x) * k : 0,
    originY: gridOk ? (grid.originY - grid.bagRect.y) * k : 0,
  };
}

/**
 * @param {ImageData} img
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 */
function cellIsFabric(img, x0, y0, x1, y1) {
  const { data, width: w, height: h } = img;
  let fabric = 0;
  let n = 0;
  const step = 2;
  for (let y = Math.max(0, y0 | 0); y < Math.min(h, y1 | 0); y += step) {
    for (let x = Math.max(0, x0 | 0); x < Math.min(w, x1 | 0); x += step) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      n += 1;
      const coolFlat =
        chroma < 18 && Math.abs(r - g) < 14 && Math.abs(g - b) < 14 && gray > 70 && gray < 165;
      if (coolFlat) continue;
      const warmLeather = gray > 45 && gray < 175 && chroma < 60 && r >= g - 8;
      const coloredBag = chroma >= 26;
      if (warmLeather || coloredBag) fabric += 1;
    }
  }
  return n > 0 && fabric / n >= FABRIC_FRAC;
}

/**
 * @param {ImageData} img
 * @param {{ cellW: number, cellH: number, originX: number, originY: number }} metrics
 * @returns {Set<string>}
 */
export function estimateBagCellMask(img, metrics) {
  /** @type {Set<string>} */
  const mask = new Set();
  const { cellW, cellH, originX, originY } = metrics;
  const inset = 0.18;
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const x0 = originX + col * cellW + cellW * inset;
      const y0 = originY + row * cellH + cellH * inset;
      const x1 = originX + (col + 1) * cellW - cellW * inset;
      const y1 = originY + (row + 1) * cellH - cellH * inset;
      if (cellIsFabric(img, x0, y0, x1, y1)) mask.add(`${col},${row}`);
    }
  }
  return mask;
}

/**
 * Gray items read like floor; a cell with 3+ fabric neighbors is fabric.
 * @param {Set<string>} mask
 */
export function fillMaskHoles(mask) {
  const out = new Set(mask);
  for (let pass = 0; pass < 2; pass++) {
    const add = [];
    for (let y = 0; y < BOARD_ROWS; y++) {
      for (let x = 0; x < BOARD_COLS; x++) {
        const k = `${x},${y}`;
        if (out.has(k)) continue;
        let n = 0;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          if (out.has(`${x + dx},${y + dy}`)) n += 1;
        }
        if (n >= 3) add.push(k);
      }
    }
    if (!add.length) break;
    for (const k of add) out.add(k);
  }
  return out;
}

/**
 * @param {object} item
 * @param {{ x: number, y: number, r: number }} cand
 * @param {Set<string>} mask
 */
export function footprintOverlap(item, cand, mask) {
  const cells = placementBodyCells(item, cand);
  if (!cells.length) return 0;
  let hit = 0;
  for (const c of cells) {
    if (mask.has(`${c.x},${c.y}`)) hit += 1;
  }
  return hit / cells.length;
}

/**
 * @param {object} item
 * @param {{ x: number, y: number, r: number }} cand
 * @param {Set<string>} remaining
 */
export function footprintFitsRemaining(item, cand, remaining) {
  const cells = placementBodyCells(item, cand);
  if (!cells.length) return false;
  return cells.every((c) => remaining.has(`${c.x},${c.y}`));
}

/**
 * @param {object} item
 * @param {{ x: number, y: number, r: number }} cand
 * @param {Set<string>} remaining
 */
export function markCovered(item, cand, remaining) {
  for (const c of placementBodyCells(item, cand)) {
    remaining.delete(`${c.x},${c.y}`);
  }
}

/**
 * @param {Map<string, object>} itemsById
 * @returns {object[]}
 */
export function catalogBags(itemsById) {
  /** @type {object[]} */
  const bags = [];
  for (const item of itemsById.values()) {
    if (isBagItem(item)) bags.push(item);
  }
  bags.sort((a, b) => {
    const ia = FILL_PREFER.indexOf(String(a.name || ''));
    const ib = FILL_PREFER.indexOf(String(b.name || ''));
    const pa = ia >= 0 ? ia : 99;
    const pb = ib >= 0 ? ib : 99;
    if (pa !== pb) return pa - pb;
    const aa = bodyBounds(shapeForItem(a, 0));
    const bb = bodyBounds(shapeForItem(b, 0));
    return bb.w * bb.h - aa.w * aa.h;
  });
  return bags;
}

/**
 * Same AABB size (face-0) for lookalike bag swaps.
 * @param {object} a
 * @param {object} b
 */
export function sameFootprint(a, b) {
  const ba = bodyBounds(shapeForItem(a, 0));
  const bb = bodyBounds(shapeForItem(b, 0));
  return ba.w === bb.w && ba.h === bb.h;
}

/**
 * @param {object} item
 * @param {Set<string>} remaining
 * @param {object[]} placed
 * @param {Map<string, object>} itemsById
 */
export function canFitAnywhere(item, remaining, placed, itemsById) {
  for (const r of [0, 1, 2, 3]) {
    const body = bodyBounds(shapeForItem(item, r));
    for (let y = 0; y + body.h <= BOARD_ROWS; y++) {
      for (let x = 0; x + body.w <= BOARD_COLS; x++) {
        const cand = { x, y, r };
        if (!footprintFitsRemaining(item, cand, remaining)) continue;
        if (canPlace(item, cand, placed, itemsById, null, EDIT_MODE.BAG_LAYER)) return true;
      }
    }
  }
  return false;
}

/**
 * @param {object} item
 */
export function preferIdx(item) {
  const i = FILL_PREFER.indexOf(String(item.name || ''));
  return i >= 0 ? i : 99;
}
