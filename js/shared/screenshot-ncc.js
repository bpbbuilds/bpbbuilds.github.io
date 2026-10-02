/**
 * Grayscale NCC template matching for screenshot import (browser + Node).
 * Callers supply hay/needle gray buffers; image loading stays outside.
 */

export const NCC_OK = 0.42;
/** Soft floor for ranked poses in the tiling solver */
export const NCC_RANK_FLOOR = 0.28;

/**
 * @typedef {{ w: number, h: number, gray: Float32Array, alpha: Uint8Array }} GrayBuf
 */

/**
 * @param {ImageData} imageData
 * @returns {GrayBuf}
 */
export function imageDataToGray(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const data = imageData.data;
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
 * Box-downsample a gray buffer by an integer-ish factor (alpha averaged).
 * @param {GrayBuf} buf
 * @param {number} factor  >= 1
 * @returns {GrayBuf}
 */
export function downsampleGray(buf, factor) {
  const f = Math.max(1, factor);
  if (f === 1) return buf;
  const w = Math.max(1, Math.floor(buf.w / f));
  const h = Math.max(1, Math.floor(buf.h / f));
  const gray = new Float32Array(w * h);
  const alpha = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor(y * f);
    const sy1 = Math.min(buf.h, Math.max(sy0 + 1, Math.floor((y + 1) * f)));
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x * f);
      const sx1 = Math.min(buf.w, Math.max(sx0 + 1, Math.floor((x + 1) * f)));
      let g = 0;
      let a = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        const row = sy * buf.w;
        for (let sx = sx0; sx < sx1; sx++) {
          g += buf.gray[row + sx];
          a += buf.alpha[row + sx];
          n++;
        }
      }
      const p = y * w + x;
      gray[p] = n ? g / n : 0;
      alpha[p] = n ? Math.round(a / n) : 0;
    }
  }
  return { w, h, gray, alpha };
}

/**
 * @param {GrayBuf} hay
 * @param {GrayBuf} needle
 * @param {number} [stride=4]
 * @param {{ x0?: number, y0?: number, x1?: number, y1?: number } | null} [bounds]
 * @returns {{ score: number, x: number, y: number }}
 */
export function bestNcc(hay, needle, stride = 4, bounds = null) {
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
  const x0 = Math.max(0, Math.min(maxX, bounds?.x0 ?? 0));
  const y0 = Math.max(0, Math.min(maxY, bounds?.y0 ?? 0));
  const x1 = Math.max(x0, Math.min(maxX, bounds?.x1 ?? maxX));
  const y1 = Math.max(y0, Math.min(maxY, bounds?.y1 ?? maxY));

  for (let y = y0; y <= y1; y += stride) {
    for (let x = x0; x <= x1; x += stride) {
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
 * Draw HTMLImageElement / CanvasImageSource into a rotated+scaled gray buffer.
 * Uses a provided 2d canvas factory so Node can pass a napi canvas.
 *
 * @param {{ width: number, height: number }} img
 * @param {number} rotDeg
 * @param {number} scale
 * @param {(w: number, h: number) => { getContext: (t: string) => any, width: number, height: number }} makeCanvas
 * @param {(src: unknown, canvas: any) => void} drawImage
 * @returns {GrayBuf}
 */
export function prepareTemplateGray(img, rotDeg, scale, makeCanvas, drawImage) {
  const sw = Math.max(1, Math.round(img.width * scale));
  const sh = Math.max(1, Math.round(img.height * scale));
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const bw = Math.max(1, Math.round(sw * cos + sh * sin));
  const bh = Math.max(1, Math.round(sw * sin + sh * cos));
  const canvas = makeCanvas(bw, bh);
  const ctx = canvas.getContext('2d');
  ctx.translate(bw / 2, bh / 2);
  ctx.rotate(rad);
  drawImage(img, ctx, -sw / 2, -sh / 2, sw, sh);
  const { data } = ctx.getImageData(0, 0, bw, bh);
  return imageDataToGray({ width: bw, height: bh, data });
}

/**
 * Browser helper: prepare template from HTMLImageElement.
 * @param {HTMLImageElement | HTMLCanvasElement} img
 * @param {number} rotDeg
 * @param {number} scale
 */
export function prepareTemplateBrowser(img, rotDeg, scale) {
  return prepareTemplateGray(
    img,
    rotDeg,
    scale,
    (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    },
    (source, ctx, x, y, w, h) => {
      ctx.drawImage(/** @type {CanvasImageSource} */ (source), x, y, w, h);
    },
  );
}

/**
 * @param {number} cellWPx
 * @param {number} displayWCells  sprite-display.w
 * @param {number} templateNativeW  thumb/sprite natural width
 * @returns {number[]}
 */
export function knownScales(cellWPx, displayWCells, templateNativeW) {
  if (!(cellWPx > 0) || !(displayWCells > 0) || !(templateNativeW > 0)) {
    return [0.9, 1.1, 1.35, 1.6];
  }
  const center = (cellWPx * displayWCells) / templateNativeW;
  if (!(center > 0.05) || !(center < 8)) return [0.9, 1.1, 1.35, 1.6];
  return [0.85, 0.95, 1, 1.05, 1.15].map((m) => Math.round(center * m * 1000) / 1000);
}

/**
 * Match a prepared gray haystack against an image template across scales/rots.
 *
 * @param {GrayBuf} hay
 * @param {{ width: number, height: number }} img
 * @param {{
 *   scales?: number[],
 *   rotations?: number[],
 *   stride?: number,
 *   prepare: (img: any, rot: number, scale: number) => GrayBuf,
 *   bounds?: { x0?: number, y0?: number, x1?: number, y1?: number } | null,
 * }} opts
 */
export function matchTemplateAtScales(hay, img, opts) {
  const scales = opts.scales || [0.9, 1.15, 1.4, 1.7];
  const rotations = opts.rotations || [0, 90, 180, 270];
  const stride = opts.stride || 4;
  const bounds = opts.bounds || null;
  let best = { score: -1, x: 0, y: 0, scale: 1, rot: 0, tw: 0, th: 0 };
  for (const scale of scales) {
    for (const rot of rotations) {
      const needle = opts.prepare(img, rot, scale);
      if (needle.w > hay.w * 0.85 || needle.h > hay.h * 0.85) continue;
      if (needle.w < 10 || needle.h < 10) continue;
      const hit = bestNcc(hay, needle, stride, bounds);
      if (hit.score > best.score) {
        best = { ...hit, scale, rot, tw: needle.w, th: needle.h };
      }
    }
  }
  return best;
}

/**
 * Zero a region on the haystack after placing (reduces double-hits).
 * @param {GrayBuf} hay
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
