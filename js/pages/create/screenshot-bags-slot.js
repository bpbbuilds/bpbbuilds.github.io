/**
 * FilledSlot NCC + detector footprint prune for bag cell masks.
 */

import { shapeForItem, bodyBounds } from '../../shared/backpack-grid/index.js';
import { loadCachedImage } from '../../shared/board-still/cache.js';
import {
  bestNcc,
  imageDataToGray,
  prepareTemplateBrowser,
} from '../../shared/screenshot-ncc.js?v=fa3633b';
import {
  BOARD_COLS,
  BOARD_ROWS,
  isBagItem,
  placementBodyCells,
} from './collision.js';
import { MIN_CONF_BAG } from '../../shared/screenshot-detector.js?v=fa3633b';
import { estimateBagCellMask } from './screenshot-bags-mask.js?v=fa3633b';

/** Empty FilledSlot match → bag cell (even if color vote fails). */
export const SLOT_ACCEPT = 0.18;
/** Soft match threshold (logged / future fabric∩slot gates). */
export const SLOT_SOFT = 0.02;

/**
 * Stone / void floor: cool flat gray (never FilledSlot leather).
 * @param {ImageData} img
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 */
function cellLooksLikeFloor(img, x0, y0, x1, y1) {
  const { data, width: w, height: h } = img;
  let cool = 0;
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
      if (
        chroma < 22 &&
        Math.abs(r - g) < 16 &&
        Math.abs(g - b) < 16 &&
        gray > 55 &&
        gray < 180
      ) {
        cool += 1;
      }
    }
  }
  return n > 0 && cool / n >= 0.45;
}

/**
 * Bag cells: color fabric + FilledSlot NCC, pruned on the rim when outside
 * snapped detector bag footprints (stops floor like 7,0; keeps 3,6 under bags).
 * @param {{
 *   img: ImageData,
 *   metrics: { cellW: number, cellH: number, originX: number, originY: number },
 *   root?: string,
 *   detections?: { id?: string, confidence?: number, box?: { cx: number, cy: number, w: number, h: number } }[],
 *   itemsById?: Map<string, object> | null,
 * }} opts
 * @returns {Promise<{ mask: Set<string>, slotAccept: number, slotSoft: number, rejected: number, floorRejected: Set<string> }>}
 */
export async function estimateBagCellMaskAsync(opts) {
  const { img, metrics, root = '/', detections = [], itemsById = null } = opts;
  const base = root.endsWith('/') ? root : `${root}/`;
  const { cellW, cellH, originX, originY } = metrics;
  const colorMask = estimateBagCellMask(img, metrics);
  const hay = imageDataToGray(img);
  const inset = 0.18;

  /** @type {import('../../shared/screenshot-ncc.js').GrayBuf | null} */
  let needle = null;
  try {
    const slotImg = await loadCachedImage(`${base}assets/icons/FilledSlot.png`);
    const nw = slotImg.naturalWidth || slotImg.width || 64;
    const scale = (cellW * 0.92) / Math.max(1, nw);
    needle = prepareTemplateBrowser(slotImg, 0, scale);
  } catch {
    needle = null;
  }

  /** @type {Map<string, number>} */
  const slotOf = new Map();
  const pad = 6;
  if (needle) {
    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const cx = originX + col * cellW;
        const cy = originY + row * cellH;
        const hit = bestNcc(hay, needle, 1, {
          x0: Math.floor(cx) - pad,
          y0: Math.floor(cy) - pad,
          x1: Math.floor(cx) + pad,
          y1: Math.floor(cy) + pad,
        });
        slotOf.set(`${col},${row}`, hit.score);
      }
    }
  }

  /**
   * @param {string} key
   * @param {Set<string>} set
   */
  const isExterior = (key, set) => {
    const [cs, rs] = key.split(',');
    const c = Number(cs);
    const r = Number(rs);
    return [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => {
      const nx = c + dx;
      const ny = r + dy;
      if (nx < 0 || ny < 0 || nx >= BOARD_COLS || ny >= BOARD_ROWS) return true;
      return !set.has(`${nx},${ny}`);
    });
  };

  /** Cells under snapped catalog bag footprints (not loose AABBs). */
  /** @type {Set<string>} */
  const bagSupport = new Set();
  for (const d of detections) {
    if (!d?.box || !(d.box.w > 0) || !(d.box.h > 0)) continue;
    const conf = Number(d.confidence);
    if (Number.isFinite(conf) && conf < MIN_CONF_BAG) continue;
    const it = itemsById?.get(String(d.id || ''));
    if (!it || !isBagItem(it)) continue;
    const body0 = bodyBounds(shapeForItem(it, 0));
    const cx = (d.box.cx - originX) / cellW;
    const cy = (d.box.cy - originY) / cellH;
    let bestR = 0;
    let bestX = Math.round(cx - body0.w / 2);
    let bestY = Math.round(cy - body0.h / 2);
    let bestErr = Infinity;
    for (const r of [0, 1, 2, 3]) {
      const body = bodyBounds(shapeForItem(it, r));
      const x = Math.round(cx - body.w / 2);
      const y = Math.round(cy - body.h / 2);
      const err =
        Math.abs(cx - (x + body.w / 2)) + Math.abs(cy - (y + body.h / 2));
      if (err < bestErr) {
        bestErr = err;
        bestR = r;
        bestX = x;
        bestY = y;
      }
    }
    const cand = {
      x: Math.max(0, Math.min(BOARD_COLS - 1, bestX)),
      y: Math.max(0, Math.min(BOARD_ROWS - 1, bestY)),
      r: bestR,
    };
    for (const c of placementBodyCells(it, cand)) {
      if (c.x < 0 || c.y < 0 || c.x >= BOARD_COLS || c.y >= BOARD_ROWS) continue;
      bagSupport.add(`${c.x},${c.y}`);
    }
  }

  /** @type {Set<string>} */
  const mask = new Set(colorMask);
  /** @type {Set<string>} */
  const floorRejected = new Set();
  let rejected = 0;
  let slotAccept = 0;
  let slotSoft = 0;

  if (!needle) {
    return { mask, slotAccept: 0, slotSoft: 0, rejected: 0, floorRejected };
  }

  /** @type {Map<number, { min: number, max: number }>} */
  const colBand = new Map();
  /**
   * @param {number} c
   * @param {number} r
   */
  const touchBand = (c, r) => {
    const band = colBand.get(c);
    if (!band) colBand.set(c, { min: r, max: r });
    else {
      band.min = Math.min(band.min, r);
      band.max = Math.max(band.max, r);
    }
  };
  for (const key of bagSupport) {
    const [cs, rs] = key.split(',');
    touchBand(Number(cs), Number(rs));
  }
  for (const key of colorMask) {
    const slot = slotOf.get(key) ?? -1;
    if (slot < SLOT_ACCEPT) continue;
    const [cs, rs] = key.split(',');
    const c = Number(cs);
    const r = Number(rs);
    const near = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => bagSupport.has(`${c + dx},${r + dy}`));
    if (near) touchBand(c, r);
  }

  for (const key of [...mask]) {
    const slot = slotOf.get(key) ?? -1;
    if (slot >= SLOT_ACCEPT) {
      slotSoft += 1;
      continue;
    }
    const [cs, rs] = key.split(',');
    const col = Number(cs);
    const row = Number(rs);
    const x0 = originX + col * cellW + cellW * inset;
    const y0 = originY + row * cellH + cellH * inset;
    const x1 = originX + (col + 1) * cellW - cellW * inset;
    const y1 = originY + (row + 1) * cellH - cellH * inset;
    const floorish = cellLooksLikeFloor(img, x0, y0, x1, y1);
    if (!isExterior(key, colorMask)) continue;
    if (bagSupport.has(key)) continue;
    const band = colBand.get(col);
    const aboveBand = Boolean(band) && row < band.min;
    const belowBand = Boolean(band) && row > band.max;
    if (!(aboveBand || belowBand) || !(floorish || slot < SLOT_ACCEPT)) continue;
    let solid = 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nk = `${col + dx},${row + dy}`;
      if (bagSupport.has(nk)) {
        solid += 1;
        continue;
      }
      if (!colorMask.has(nk)) continue;
      const nb = colBand.get(col + dx);
      if (!nb || row + dy >= nb.min) solid += 1;
    }
    const need = aboveBand ? 3 : 2;
    if (solid >= need) continue;
    mask.delete(key);
    floorRejected.add(key);
    rejected += 1;
  }

  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const key = `${col},${row}`;
      if (mask.has(key)) continue;
      const slot = slotOf.get(key) ?? -1;
      if (slot >= SLOT_ACCEPT) {
        mask.add(key);
        floorRejected.delete(key);
        slotAccept += 1;
      }
    }
  }

  console.info(
    '[screenshot] bags slot',
    `accept+=${slotAccept}`,
    `keptStrong=${slotSoft}`,
    `floorReject=${rejected}`,
  );
  return { mask, slotAccept, slotSoft, rejected, floorRejected };
}
