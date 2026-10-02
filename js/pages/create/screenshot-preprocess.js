/**
 * Browser preprocess for screenshot import: gray + bag crop via grid detect.
 */

import {
  detectBagGrid,
  cropBagRect,
} from '../../shared/screenshot-grid.js?v=grid97';
import { BOARD_COLS, BOARD_ROWS } from './collision.js';

/**
 * @param {string} dataUrl
 * @returns {Promise<{ w: number, h: number, gray: Float32Array }>}
 */
export async function imageDataUrlToGray(dataUrl) {
  const img = await loadHtmlImage(dataUrl);
  const maxSide = 900;
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (Math.max(w, h) > maxSide) {
    const s = maxSide / Math.max(w, h);
    w = Math.max(1, Math.round(w * s));
    h = Math.max(1, Math.round(h * s));
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return { w, h, gray };
}

/**
 * @param {string} dataUrl
 * @returns {Promise<HTMLImageElement>}
 */
function loadHtmlImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image.'));
    img.src = dataUrl;
  });
}

/**
 * Crop a full-res data URL to an integer pixel rect.
 * @param {string} dataUrl
 * @param {{ x: number, y: number, w: number, h: number }} rect  in the same pixel space as the decoded image
 * @param {{ srcW: number, srcH: number }} srcSize  size used for gray detect (may be downscaled)
 */
export async function cropDataUrl(dataUrl, rect, srcSize) {
  const img = await loadHtmlImage(dataUrl);
  const fullW = img.naturalWidth || img.width;
  const fullH = img.naturalHeight || img.height;
  const sx = fullW / Math.max(1, srcSize.srcW);
  const sy = fullH / Math.max(1, srcSize.srcH);
  let x = Math.round(rect.x * sx);
  let y = Math.round(rect.y * sy);
  let w = Math.round(rect.w * sx);
  let h = Math.round(rect.h * sy);
  x = Math.max(0, Math.min(fullW - 8, x));
  y = Math.max(0, Math.min(fullH - 8, y));
  w = Math.max(16, Math.min(fullW - x, w));
  h = Math.max(16, Math.min(fullH - y, h));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  return canvas.toDataURL('image/png');
}

/**
 * Detect grid; if ok, return bag-cropped data URL for Edge vision.
 * @param {string} dataUrl
 * @returns {Promise<{
 *   dataUrl: string,
 *   gridOk: boolean,
 *   grid: import('../../shared/screenshot-grid.js').BagGrid | null,
 * }>}
 */
export async function preprocessScreenshotForVision(dataUrl) {
  const gray = await imageDataUrlToGray(dataUrl);
  const grid = detectBagGrid(gray);
  if (!grid.ok) {
    return { dataUrl, gridOk: false, grid: null };
  }
  const rect = cropBagRect(grid);
  if (!(rect.w > 16) || !(rect.h > 16)) {
    return { dataUrl, gridOk: false, grid };
  }
  const cropped = await cropDataUrl(dataUrl, rect, { srcW: gray.w, srcH: gray.h });
  return { dataUrl: cropped, gridOk: true, grid };
}

/**
 * Clamp vision cell coords to the create board.
 * @param {{ id: string, name?: string, x: number, y: number, r: number }} item
 */
export function clampScreenshotItem(item) {
  return {
    ...item,
    x: Math.max(0, Math.min(BOARD_COLS - 1, Math.round(Number(item.x) || 0))),
    y: Math.max(0, Math.min(BOARD_ROWS - 1, Math.round(Number(item.y) || 0))),
    r: ((Math.round(Number(item.r) || 0) % 4) + 4) % 4,
  };
}
