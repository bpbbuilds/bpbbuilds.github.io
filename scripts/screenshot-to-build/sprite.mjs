import { createCanvas, loadImage } from '@napi-rs/canvas';

/**
 * @param {import('@napi-rs/canvas').Image | import('@napi-rs/canvas').Canvas} img
 * @param {number} [maxSide]
 */
export function imageToGray(img, maxSide = 0) {
  let w = img.width;
  let h = img.height;
  if (maxSide > 0 && Math.max(w, h) > maxSide) {
    const s = maxSide / Math.max(w, h);
    w = Math.max(1, Math.round(w * s));
    h = Math.max(1, Math.round(h * s));
  }
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  const alpha = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    alpha[p] = data[i + 3];
    if (data[i + 3] < 24) {
      gray[p] = 0;
      continue;
    }
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return { w, h, gray, alpha };
}

/**
 * @param {{ w: number, h: number, gray: Float32Array, alpha: Uint8Array }} hay
 * @param {{ w: number, h: number, gray: Float32Array, alpha: Uint8Array }} needle
 * @param {number} stride
 */
function bestNcc(hay, needle, stride = 4) {
  const tw = needle.w;
  const th = needle.h;
  if (tw < 6 || th < 6 || tw >= hay.w || th >= hay.h) {
    return { score: -1, x: 0, y: 0 };
  }

  let tSum = 0;
  let tCount = 0;
  for (let i = 0; i < needle.gray.length; i++) {
    if (needle.alpha[i] < 24) continue;
    tSum += needle.gray[i];
    tCount++;
  }
  if (tCount < 16) return { score: -1, x: 0, y: 0 };
  const tMean = tSum / tCount;
  let tVar = 0;
  for (let i = 0; i < needle.gray.length; i++) {
    if (needle.alpha[i] < 24) continue;
    const d = needle.gray[i] - tMean;
    tVar += d * d;
  }
  if (tVar < 1e-3) return { score: -1, x: 0, y: 0 };
  const tNorm = Math.sqrt(tVar);

  let best = -1;
  let bestX = 0;
  let bestY = 0;
  const maxY = hay.h - th;
  const maxX = hay.w - tw;

  for (let y = 0; y <= maxY; y += stride) {
    for (let x = 0; x <= maxX; x += stride) {
      let sSum = 0;
      let sCount = 0;
      for (let ty = 0; ty < th; ty++) {
        const hayRow = (y + ty) * hay.w + x;
        const nRow = ty * tw;
        for (let tx = 0; tx < tw; tx++) {
          const ni = nRow + tx;
          if (needle.alpha[ni] < 24) continue;
          sSum += hay.gray[hayRow + tx];
          sCount++;
        }
      }
      if (sCount < tCount * 0.7) continue;
      const sMean = sSum / sCount;
      let num = 0;
      let sVar = 0;
      for (let ty = 0; ty < th; ty++) {
        const hayRow = (y + ty) * hay.w + x;
        const nRow = ty * tw;
        for (let tx = 0; tx < tw; tx++) {
          const ni = nRow + tx;
          if (needle.alpha[ni] < 24) continue;
          const sv = hay.gray[hayRow + tx] - sMean;
          const tv = needle.gray[ni] - tMean;
          num += sv * tv;
          sVar += sv * sv;
        }
      }
      if (sVar < 1e-3) continue;
      const score = num / (Math.sqrt(sVar) * tNorm);
      if (score > best) {
        best = score;
        bestX = x;
        bestY = y;
      }
    }
  }
  return { score: best, x: bestX, y: bestY };
}

/**
 * @param {import('@napi-rs/canvas').Image} img
 * @param {number} rot
 * @param {number} scale
 */
function prepareTemplate(img, rot, scale) {
  const sw = Math.max(1, Math.round(img.width * scale));
  const sh = Math.max(1, Math.round(img.height * scale));
  const rad = (rot * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const bw = Math.max(1, Math.round(sw * cos + sh * sin));
  const bh = Math.max(1, Math.round(sw * sin + sh * cos));
  const canvas = createCanvas(bw, bh);
  const ctx = canvas.getContext('2d');
  ctx.translate(bw / 2, bh / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
  return imageToGray(canvas);
}

/**
 * @param {{ w: number, h: number, gray: Float32Array, alpha: Uint8Array }} hay
 * @param {number} x
 * @param {number} y
 * @param {number} bw
 * @param {number} bh
 */
export function maskRegion(hay, x, y, bw, bh) {
  const x0 = Math.max(0, Math.floor(x - bw * 0.15));
  const y0 = Math.max(0, Math.floor(y - bh * 0.15));
  const x1 = Math.min(hay.w, Math.ceil(x + bw * 1.15));
  const y1 = Math.min(hay.h, Math.ceil(y + bh * 1.15));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = yy * hay.w + xx;
      hay.gray[i] = 0;
      hay.alpha[i] = 0;
    }
  }
}

/**
 * @param {{ w: number, h: number, gray: Float32Array, alpha: Uint8Array }} shotGray
 * @param {string} spriteFile
 * @param {{ scales?: number[], rotations?: number[], stride?: number }} [opts]
 */
export async function matchSprite(shotGray, spriteFile, opts = {}) {
  const img = await loadImage(spriteFile);
  const scales = opts.scales || [0.9, 1.15, 1.4, 1.7];
  const rotations = opts.rotations || [0, 90, 270];
  const stride = opts.stride || 6;
  let best = { score: -1, x: 0, y: 0, scale: 1, rot: 0, tw: 0, th: 0 };
  for (const scale of scales) {
    for (const rot of rotations) {
      const needle = prepareTemplate(img, rot, scale);
      if (needle.w > shotGray.w * 0.7 || needle.h > shotGray.h * 0.7) continue;
      if (needle.w < 10 || needle.h < 10) continue;
      const hit = bestNcc(shotGray, needle, stride);
      if (hit.score > best.score) {
        best = { ...hit, scale, rot, tw: needle.w, th: needle.h };
      }
    }
  }
  return best;
}

/**
 * @typedef {{ cellW: number, cellH: number, originX?: number, originY?: number }} GridPitch
 */

/**
 * Cell-grid crop box in match-space coordinates (same grid as cropRegionDataUrl).
 * @param {number} matchW
 * @param {number} matchH
 * @param {number} cellCol
 * @param {number} cellRow
 * @param {number} sizeW
 * @param {number} sizeH
 * @param {number} [pad]
 * @param {GridPitch | null} [grid]
 */
export function cellCropBoxMatch(matchW, matchH, cellCol, cellRow, sizeW, sizeH, pad = 1.8, grid = null) {
  const cellW = grid?.cellW > 0 ? grid.cellW : matchW / 9;
  const cellH = grid?.cellH > 0 ? grid.cellH : matchH / 11;
  const originX = grid?.originX != null ? grid.originX : 0;
  const originY = grid?.originY != null ? grid.originY : 0;
  const col = Math.max(0, Number(cellCol) || 0);
  const row = Math.max(0, Number(cellRow) || 0);
  const sw = Math.max(1, Number(sizeW) || 1);
  const sh = Math.max(1, Number(sizeH) || 1);
  const cw = Math.max(sw, 1.2) * cellW * pad;
  const ch = Math.max(sh, 1.2) * cellH * pad;
  const baseX = originX + col * cellW;
  const baseY = originY + row * cellH;
  return {
    x0: Math.max(0, Math.floor(baseX - (cw - sw * cellW) * 0.35)),
    y0: Math.max(0, Math.floor(baseY - (ch - sh * cellH) * 0.2)),
    cw: Math.min(matchW, Math.ceil(cw)),
    ch: Math.min(matchH, Math.ceil(ch)),
  };
}

/**
 * @param {{ w: number, h: number, gray: Float32Array, alpha: Uint8Array }} hay
 * @param {number} x0
 * @param {number} y0
 * @param {number} cw
 * @param {number} ch
 */
export function extractGrayRegion(hay, x0, y0, cw, ch) {
  const x = Math.max(0, Math.floor(x0));
  const y = Math.max(0, Math.floor(y0));
  const w = Math.max(1, Math.min(hay.w - x, Math.ceil(cw)));
  const h = Math.max(1, Math.min(hay.h - y, Math.ceil(ch)));
  const gray = new Float32Array(w * h);
  const alpha = new Uint8Array(w * h);
  for (let yy = 0; yy < h; yy++) {
    const src = (y + yy) * hay.w + x;
    const dst = yy * w;
    gray.set(hay.gray.subarray(src, src + w), dst);
    alpha.set(hay.alpha.subarray(src, src + w), dst);
  }
  return { w, h, gray, alpha, x0: x, y0: y };
}

/**
 * NCC inside a cell crop (maps hit coords back to full match-space).
 * Beats full-bag false peaks on tall winged swords like Falcon Blade.
 *
 * @param {{ w: number, h: number, gray: Float32Array, alpha: Uint8Array }} shotGray
 * @param {string} spriteFile
 * @param {{ cellCol: number, cellRow: number, sizeW: number, sizeH: number, pad?: number, grid?: GridPitch | null }} cues
 * @param {{ scales?: number[], rotations?: number[], stride?: number }} [opts]
 */
export async function matchSpriteInCell(shotGray, spriteFile, cues, opts = {}) {
  const pad = cues.pad ?? 1.8;
  const box = cellCropBoxMatch(
    shotGray.w,
    shotGray.h,
    cues.cellCol,
    cues.cellRow,
    cues.sizeW,
    cues.sizeH,
    pad,
    cues.grid || null,
  );
  // Clamp box into image
  box.cw = Math.min(box.cw, shotGray.w - box.x0);
  box.ch = Math.min(box.ch, shotGray.h - box.y0);
  if (box.cw < 24 || box.ch < 24) {
    return { score: -1, x: 0, y: 0, scale: 1, rot: 0, tw: 0, th: 0 };
  }
  const region = extractGrayRegion(shotGray, box.x0, box.y0, box.cw, box.ch);
  const hit = await matchSprite(region, spriteFile, opts);
  if (hit.score < 0) return hit;
  return {
    ...hit,
    x: hit.x + region.x0,
    y: hit.y + region.y0,
  };
}

/**
 * Crop a region from the full-res screenshot to a PNG data URL.
 * Prefers cell+size for weak NCC or large footprints; may union with NCC peak.
 *
 * @param {string} shotPath
 * @param {{ score?: number, x?: number, y?: number, tw?: number, th?: number } | null} hit
 * @param {{
 *   cellCol?: number,
 *   cellRow?: number,
 *   sizeW?: number,
 *   sizeH?: number,
 *   matchW: number,
 *   matchH: number,
 *   pad?: number,
 *   grid?: GridPitch | null,
 * }} cues
 */
export async function cropRegionDataUrl(shotPath, hit, cues) {
  const img = await loadImage(shotPath);
  const sx = img.width / cues.matchW;
  const sy = img.height / cues.matchH;
  const sizeW = Math.max(1, Number(cues.sizeW) || 1);
  const sizeH = Math.max(1, Number(cues.sizeH) || 1);
  const area = sizeW * sizeH;
  const score = hit?.score ?? -1;
  const preferCell = !hit || score < NCC_OK || area >= 4;

  /** Full-res pitch from match-space grid or legacy 9×11 */
  let cellW;
  let cellH;
  let originX = 0;
  let originY = 0;
  if (cues.grid?.cellW > 0 && cues.grid?.cellH > 0) {
    cellW = cues.grid.cellW * sx;
    cellH = cues.grid.cellH * sy;
    originX = (cues.grid.originX || 0) * sx;
    originY = (cues.grid.originY || 0) * sy;
  } else {
    cellW = img.width / 9;
    cellH = img.height / 11;
  }
  const col = Math.max(0, Number(cues.cellCol) || 0);
  const row = Math.max(0, Number(cues.cellRow) || 0);

  let cellPad = Number(cues.pad) || 1.35;
  if (!cues.pad) {
    if (area >= 6) cellPad = 2.0;
    else if (area >= 4) cellPad = 1.75;
  }

  const cellBox = {
    x0: originX + col * cellW,
    y0: originY + row * cellH,
    cw: Math.max(sizeW, 1.2) * cellW * cellPad,
    ch: Math.max(sizeH, 1.2) * cellH * cellPad,
  };

  let nccBox = null;
  if (hit && hit.tw > 0 && score > 0) {
    const nccPad = area >= 4 ? 1.7 : 1.4;
    const tw = hit.tw * sx;
    const th = hit.th * sy;
    nccBox = {
      x0: hit.x * sx - (tw * nccPad - tw) / 2,
      y0: hit.y * sy - (th * nccPad - th) / 2,
      cw: tw * nccPad,
      ch: th * nccPad,
    };
  }

  /** @type {{ x0: number, y0: number, cw: number, ch: number }} */
  let box;
  /** @type {string} */
  let mode;

  if (preferCell) {
    box = cellBox;
    mode = 'cell';
    // Expand cell crop to include a middling NCC peak so the blob stays in frame
    if (nccBox && score >= 0.3) {
      const x1 = Math.max(cellBox.x0 + cellBox.cw, nccBox.x0 + nccBox.cw);
      const y1 = Math.max(cellBox.y0 + cellBox.ch, nccBox.y0 + nccBox.ch);
      const x0 = Math.min(cellBox.x0, nccBox.x0);
      const y0 = Math.min(cellBox.y0, nccBox.y0);
      box = { x0, y0, cw: x1 - x0, ch: y1 - y0 };
      mode = 'cell+ncc';
    }
  } else if (nccBox) {
    box = nccBox;
    mode = 'ncc';
  } else {
    box = cellBox;
    mode = 'cell';
  }

  let x0 = Math.round(box.x0);
  let y0 = Math.round(box.y0);
  let cw = Math.round(box.cw);
  let ch = Math.round(box.ch);

  x0 = Math.max(0, Math.min(img.width - 8, x0));
  y0 = Math.max(0, Math.min(img.height - 8, y0));
  cw = Math.max(16, Math.min(img.width - x0, cw));
  ch = Math.max(16, Math.min(img.height - y0, ch));

  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, x0, y0, cw, ch, 0, 0, cw, ch);
  const buf = canvas.toBuffer('image/png');
  return {
    dataUrl: `data:image/png;base64,${buf.toString('base64')}`,
    box: { x: x0, y: y0, w: cw, h: ch },
    mode,
  };
}

export const NCC_OK = 0.42;
