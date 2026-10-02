/**
 * Node bridge: load shot → gray → detectBagGrid (shared pure JS).
 */
import { loadImage } from '@napi-rs/canvas';
import { createCanvas } from '@napi-rs/canvas';
import { detectBagGrid, fallbackGrid, cropBagRect } from '../../js/shared/screenshot-grid.js';
import { imageToGray } from './sprite.mjs';
import fs from 'fs';
import path from 'path';
import { ROOT } from './catalog.mjs';

export { detectBagGrid, fallbackGrid, cropBagRect };

/**
 * @param {string} shotPath
 * @param {number} [maxSide=900]
 */
export async function detectGridFromShot(shotPath, maxSide = 900) {
  const img = await loadImage(shotPath);
  const gray = imageToGray(img, maxSide);
  const grid = detectBagGrid({ w: gray.w, h: gray.h, gray: gray.gray });
  if (grid.ok) return { grid, gray, imgW: img.width, imgH: img.height };

  // Scale fallback to match-space (gray canvas)
  const fb = fallbackGrid(gray.w, gray.h, 9, 11);
  return { grid: fb, gray, imgW: img.width, imgH: img.height };
}

/**
 * Map grid from match-space (gray) to full-res image pixels.
 * @param {import('../../js/shared/screenshot-grid.js').BagGrid} matchGrid
 * @param {number} matchW
 * @param {number} matchH
 * @param {number} imgW
 * @param {number} imgH
 */
export function scaleGridToImage(matchGrid, matchW, matchH, imgW, imgH) {
  const sx = imgW / matchW;
  const sy = imgH / matchH;
  const cellW = matchGrid.cellW * sx;
  const cellH = matchGrid.cellH * sy;
  const originX = matchGrid.originX * sx;
  const originY = matchGrid.originY * sy;
  const cols = matchGrid.cols;
  const rows = matchGrid.rows;
  return {
    ...matchGrid,
    cellW,
    cellH,
    originX,
    originY,
    bagRect: {
      x: Math.max(0, Math.round(originX)),
      y: Math.max(0, Math.round(originY)),
      w: Math.max(1, Math.round(Math.min(imgW - originX, cols * cellW))),
      h: Math.max(1, Math.round(Math.min(imgH - originY, rows * cellH))),
    },
  };
}

/**
 * Known NCC scales from sprite-display.json when grid pitch is known.
 * @param {string} imageStem  e.g. FalconBlade
 * @param {number} cellWPx    match-space cell width
 * @param {{ thumb?: boolean }} [opts]
 * @returns {number[] | null}
 */
export function knownScalesForStem(imageStem, cellWPx, opts = {}) {
  const displayPath = path.join(ROOT, 'assets/data/sprite-display.json');
  if (!fs.existsSync(displayPath)) return null;
  /** @type {Record<string, any>} */
  let byImage;
  try {
    const raw = JSON.parse(fs.readFileSync(displayPath, 'utf8'));
    byImage = raw.byImage || raw;
  } catch {
    return null;
  }
  const key = imageStem.endsWith('.png') ? imageStem : `${imageStem}.png`;
  const entry = byImage[key];
  if (!entry) return null;

  const dispW = Number(entry.w) || 0;
  const texW = Number(entry.texW) || 0;
  if (!(dispW > 0) || !(texW > 0) || !(cellWPx > 0)) return null;

  if (opts.thumb) {
    // Caller usually builds thumb scales from cellW/68; keep null here
    return null;
  }

  const expectedW = cellWPx * dispW;
  const center = expectedW / texW;
  if (!(center > 0.02) || !(center < 2)) return null;
  return [center * 0.85, center * 0.95, center, center * 1.05, center * 1.15].map(
    (s) => Math.round(s * 1000) / 1000,
  );
}

/**
 * Draw grid overlay for debugging.
 * @param {string} shotPath
 * @param {import('../../js/shared/screenshot-grid.js').BagGrid} fullResGrid
 * @param {string} outPath
 */
export async function writeGridDebugOverlay(shotPath, fullResGrid, outPath) {
  const img = await loadImage(shotPath);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.strokeStyle = 'rgba(0, 255, 120, 0.85)';
  ctx.lineWidth = 1;
  const { cellW, cellH, cols, rows } = fullResGrid;
  const originX = fullResGrid.originX;
  const originY = fullResGrid.originY;
  for (let c = 0; c <= cols; c++) {
    const x = originX + c * cellW;
    if (x < -1 || x > img.width + 1) continue;
    ctx.beginPath();
    ctx.moveTo(x, Math.max(0, originY));
    ctx.lineTo(x, Math.min(img.height, originY + rows * cellH));
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    const y = originY + r * cellH;
    if (y < -1 || y > img.height + 1) continue;
    ctx.beginPath();
    ctx.moveTo(Math.max(0, originX), y);
    ctx.lineTo(Math.min(img.width, originX + cols * cellW), y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 80, 80, 0.9)';
  ctx.lineWidth = 2;
  const br = fullResGrid.bagRect;
  ctx.strokeRect(br.x + 0.5, br.y + 0.5, br.w - 1, br.h - 1);
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
}
