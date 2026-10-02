/**
 * Score a bag placement by painting its sprite against the bag-crop screenshot.
 */

import { bodyBounds, shapeForItem } from '../../shared/backpack-grid/index.js';
import { loadCachedImage } from '../../shared/board-still/cache.js';
import { fullSpriteUrl } from '../../shared/board-still/paint-compare.js';
import {
  BOARD_COLS,
  BOARD_ROWS,
  paintBoardCanvas,
} from '../../shared/board-still/paint.js';
import {
  bagMedianRgb,
  NON_LEATHER_THRESH,
  scorePaintVsShot,
} from '../../shared/screenshot-paint-score.js?v=fa3633b';

/** Covered mean above this → reject (visible fabric only; items masked out). */
export const BAG_PAINT_MAX = 55;
/** Paint scores within this use FILL_PREFER as tie-break. */
export const BAG_PAINT_TIE = 3;
/**
 * Alt must beat the detector/seed bag by at least this much (lower = better)
 * before we swap away from the detector id.
 */
export const BAG_PAINT_OVERRIDE = 12;

/**
 * @param {ImageData} src
 * @param {number} x0
 * @param {number} y0
 * @param {number} w
 * @param {number} h
 */
function cropRgba(src, x0, y0, w, h) {
  const out = new ImageData(w, h);
  const sd = src.data;
  const od = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((y0 + y) * src.width + (x0 + x)) * 4;
      const oi = (y * w + x) * 4;
      od[oi] = sd[si];
      od[oi + 1] = sd[si + 1];
      od[oi + 2] = sd[si + 2];
      od[oi + 3] = sd[si + 3];
    }
  }
  return out;
}

/**
 * @param {{
 *   shot: ImageData,
 *   item: object,
 *   pose: { x: number, y: number, r: number },
 *   metrics: { cellW: number, cellH: number, originX: number, originY: number },
 *   itemsById: Map<string, object>,
 *   root: string,
 *   loadImage?: (url: string, opts?: object) => Promise<HTMLImageElement>,
 * }} opts
 * @returns {Promise<number>} covered mean (lower = better); Infinity on failure
 */
export async function scoreBagAtPose(opts) {
  const {
    shot,
    item,
    pose,
    metrics,
    itemsById,
    root,
    loadImage = loadCachedImage,
  } = opts;
  if (!item || !shot) return Infinity;

  const cellPx = Math.max(8, Math.round(metrics.cellW));
  const { canvas } = await paintBoardCanvas({
    placements: [{ id: String(item.id), x: pose.x, y: pose.y, r: pose.r || 0 }],
    itemsById,
    getSpriteUrl: (it) => fullSpriteUrl(root, it),
    loadImage,
    root,
    cellPx,
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
    crop: false,
    padPx: 0,
    overhangCells: 0,
    mode: 'bags',
    bags: true,
    fabric: false,
    glows: false,
    shadows: false,
  });

  const align = document.createElement('canvas');
  align.width = shot.width;
  align.height = shot.height;
  const actx = align.getContext('2d', { willReadFrequently: true });
  if (!actx) return Infinity;
  actx.clearRect(0, 0, shot.width, shot.height);
  const { cellW, cellH, originX, originY } = metrics;
  actx.drawImage(canvas, originX, originY, cellW * BOARD_COLS, cellH * BOARD_ROWS);
  const paintFull = actx.getImageData(0, 0, shot.width, shot.height);

  const body = bodyBounds(shapeForItem(item, pose.r || 0));
  const x0 = Math.max(0, Math.floor(originX + pose.x * cellW));
  const y0 = Math.max(0, Math.floor(originY + pose.y * cellH));
  const x1 = Math.min(shot.width, Math.ceil(originX + (pose.x + body.w) * cellW));
  const y1 = Math.min(shot.height, Math.ceil(originY + (pose.y + body.h) * cellH));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w < 4 || h < 4) return Infinity;

  const shotClip = cropRgba(shot, x0, y0, w, h);
  const paintClip = cropRgba(paintFull, x0, y0, w, h);
  // Items sit on bags — only score where the shot still looks like fabric.
  const leather = bagMedianRgb(shot);
  const pd = paintClip.data;
  const sd = shotClip.data;
  for (let i = 0; i < sd.length; i += 4) {
    const d =
      Math.abs(sd[i] - leather.r) +
      Math.abs(sd[i + 1] - leather.g) +
      Math.abs(sd[i + 2] - leather.b);
    if (d >= NON_LEATHER_THRESH) pd[i + 3] = 0;
  }
  const scored = scorePaintVsShot(shotClip, paintClip, { leather });
  return scored.coveredN > 8 ? scored.covered : Infinity;
}

/**
 * Prefer lower paint; within BAG_PAINT_TIE, prefer FILL_PREFER order (lower index).
 * @param {number} aScore
 * @param {number} bScore
 * @param {number} aPrefer
 * @param {number} bPrefer
 */
export function paintBetter(aScore, bScore, aPrefer, bPrefer) {
  if (Math.abs(aScore - bScore) <= BAG_PAINT_TIE) return aPrefer - bPrefer;
  return aScore - bScore;
}

/**
 * True when altPaint is clearly better than seedPaint (enough to override detector).
 * @param {number} altPaint lower = better
 * @param {number} seedPaint
 */
export function paintOverrideWins(altPaint, seedPaint) {
  if (!Number.isFinite(altPaint) || !Number.isFinite(seedPaint)) return false;
  return seedPaint - altPaint >= BAG_PAINT_OVERRIDE;
}
