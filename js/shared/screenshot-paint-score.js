/**
 * Color match score: painted board vs bag-crop screenshot (lower = better).
 * Pure ImageData — browser and Node.
 */

/** Leather-vs-item residual threshold (sum |ΔRGB| from bag median). */
export const NON_LEATHER_THRESH = 48;
/** Paint alpha: covered compare */
export const PAINT_COVERED_A = 32;
/** Paint alpha: treated as empty for unexplained */
export const PAINT_EMPTY_A = 16;

/**
 * @typedef {{ r: number, g: number, b: number }} Rgb
 * @typedef {{ covered: number, unexplained: number, total: number, coveredN: number, unexplainedN: number }} PaintScore
 */

/**
 * @param {ImageData | { data: Uint8ClampedArray | Uint8Array, width: number, height: number }} img
 * @returns {Rgb}
 */
export function bagMedianRgb(img) {
  const { data, width: w, height: h } = img;
  const rs = [];
  const gs = [];
  const bs = [];
  // Sample every 4th pixel for speed
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      rs.push(data[i]);
      gs.push(data[i + 1]);
      bs.push(data[i + 2]);
    }
  }
  const mid = (arr) => {
    if (!arr.length) return 0;
    arr.sort((a, b) => a - b);
    return arr[(arr.length / 2) | 0];
  };
  return { r: mid(rs), g: mid(gs), b: mid(bs) };
}

/**
 * @param {ImageData | { data: Uint8ClampedArray | Uint8Array, width: number, height: number }} shot
 * @param {ImageData | { data: Uint8ClampedArray | Uint8Array, width: number, height: number }} paint
 * @param {{ leather?: Rgb }} [opts]
 * @returns {PaintScore}
 */
export function scorePaintVsShot(shot, paint, opts = {}) {
  if (shot.width !== paint.width || shot.height !== paint.height) {
    return {
      covered: 1e9,
      unexplained: 1e9,
      total: 2e9,
      coveredN: 0,
      unexplainedN: 0,
    };
  }
  const leather = opts.leather || bagMedianRgb(shot);
  const sd = shot.data;
  const pd = paint.data;
  const n = shot.width * shot.height;
  let coveredSum = 0;
  let coveredN = 0;
  let unexSum = 0;
  let unexN = 0;

  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const pa = pd[i + 3];
    const sr = sd[i];
    const sg = sd[i + 1];
    const sb = sd[i + 2];

    if (pa >= PAINT_COVERED_A) {
      // Blend paint over shot? Compare paint RGB to shot where painted.
      const pr = pd[i];
      const pg = pd[i + 1];
      const pb = pd[i + 2];
      // Account for partial alpha: expected = lerp(shot, paint, a)
      const a = pa / 255;
      const er = sr * (1 - a) + pr * a;
      const eg = sg * (1 - a) + pg * a;
      const eb = sb * (1 - a) + pb * a;
      // Distance of shot from what paint claims — use direct |paint-shot| weighted by a
      coveredSum += (Math.abs(pr - sr) + Math.abs(pg - sg) + Math.abs(pb - sb)) * a;
      coveredN += 1;
      void er;
      void eg;
      void eb;
    } else if (pa < PAINT_EMPTY_A) {
      const d =
        Math.abs(sr - leather.r) +
        Math.abs(sg - leather.g) +
        Math.abs(sb - leather.b);
      if (d >= NON_LEATHER_THRESH) {
        unexSum += d;
        unexN += 1;
      }
    }
  }

  const covered = coveredN ? coveredSum / coveredN : 0;
  const unexplained = unexN ? unexSum / unexN : 0;
  // Prefer fewer unexplained pixels: weight by density too
  const unexDensity = n ? unexN / n : 0;
  const unexplainedTerm = unexplained + unexDensity * 80;
  const total = covered + 0.75 * unexplainedTerm;
  return { covered, unexplained: unexplainedTerm, total, coveredN, unexplainedN: unexN };
}
