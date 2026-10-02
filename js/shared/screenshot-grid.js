/**
 * Bag grid detection from leather-cell seams (1D autocorrelation).
 * Pure math — works on Node and browser grayscale buffers.
 */

/**
 * @typedef {{
 *   w: number,
 *   h: number,
 *   gray: Float32Array,
 * }} GrayImage
 */

/**
 * @typedef {{
 *   ok: boolean,
 *   cellW: number,
 *   cellH: number,
 *   originX: number,
 *   originY: number,
 *   cols: number,
 *   rows: number,
 *   bagRect: { x: number, y: number, w: number, h: number },
 *   score: number,
 * }} BagGrid
 */

/**
 * @param {Float32Array} profile
 * @param {number} lagMin
 * @param {number} lagMax
 * @param {{ preferLag?: number, axisLen?: number }} [opts]
 * @returns {{ lag: number, score: number }}
 */
function bestAutocorrLag(profile, lagMin, lagMax, opts = {}) {
  const n = profile.length;
  if (n < 8) return { lag: 0, score: 0 };

  let mean = 0;
  for (let i = 0; i < n; i++) mean += profile[i];
  mean /= n;

  let varSum = 0;
  for (let i = 0; i < n; i++) {
    const d = profile[i] - mean;
    varSum += d * d;
  }
  if (varSum < 1e-6) return { lag: 0, score: 0 };

  const lo = Math.max(2, Math.floor(lagMin));
  const hi = Math.min(Math.floor(n / 2), Math.floor(lagMax));
  if (hi < lo) return { lag: 0, score: 0 };

  /** @type {{ lag: number, score: number }[]} */
  const peaks = [];
  let prev = -Infinity;
  let rising = false;
  for (let lag = lo; lag <= hi; lag++) {
    let num = 0;
    const count = n - lag;
    for (let i = 0; i < count; i++) {
      num += (profile[i] - mean) * (profile[i + lag] - mean);
    }
    const score = num / varSum;
    if (score > prev) rising = true;
    else if (rising && score < prev) {
      peaks.push({ lag: lag - 1, score: prev });
      rising = false;
    }
    prev = score;
  }
  if (rising) peaks.push({ lag: hi, score: prev });
  peaks.sort((a, b) => b.score - a.score);

  if (!peaks.length) return { lag: 0, score: 0 };

  // Prefer a fundamental whose period tiles the axis into ~6–14 cells (bag width).
  const axisLen = opts.axisLen || n;
  const prefer = opts.preferLag || 0;
  let best = peaks[0];
  let bestRank = -Infinity;
  for (const p of peaks.slice(0, 12)) {
    if (p.score < peaks[0].score * 0.45) continue;
    const cells = axisLen / p.lag;
    let fit = 0;
    if (cells >= 6 && cells <= 14) fit = 1;
    else if (cells >= 5 && cells <= 16) fit = 0.5;
    // Prefer larger lag when scores are close (avoid half-cell harmonics)
    const sizeBonus = p.lag / hi;
    const preferBonus = prefer > 0 ? 1 - Math.min(1, Math.abs(p.lag - prefer) / prefer) : 0;
    const rank = p.score * (1 + fit * 1.2 + sizeBonus * 0.35 + preferBonus * 0.4);
    if (rank > bestRank) {
      bestRank = rank;
      best = p;
    }
  }

  // If best is small, try 2× / 3× harmonic as fundamental when in range
  for (const mult of [2, 3]) {
    const cand = best.lag * mult;
    if (cand > hi) break;
    let num = 0;
    const count = n - cand;
    for (let i = 0; i < count; i++) {
      num += (profile[i] - mean) * (profile[i + cand] - mean);
    }
    const score = num / varSum;
    const cells = axisLen / cand;
    if (score >= best.score * 0.55 && cells >= 6 && cells <= 14) {
      best = { lag: cand, score };
    }
  }

  return best;
}

/**
 * Offset in [0, pitch) that maximizes seam energy on lattice lines.
 * @param {Float32Array} profile
 * @param {number} pitch
 */
function bestPhase(profile, pitch) {
  const p = Math.max(2, Math.round(pitch));
  let bestOff = 0;
  let bestEnergy = -Infinity;
  for (let off = 0; off < p; off++) {
    let energy = 0;
    let count = 0;
    for (let i = off; i < profile.length; i += p) {
      energy += profile[i];
      count += 1;
      // Neighbors also sit near seams
      if (i > 0) {
        energy += profile[i - 1] * 0.5;
        count += 0.5;
      }
      if (i + 1 < profile.length) {
        energy += profile[i + 1] * 0.5;
        count += 0.5;
      }
    }
    const avg = count > 0 ? energy / count : 0;
    if (avg > bestEnergy) {
      bestEnergy = avg;
      bestOff = off;
    }
  }
  return bestOff;
}

/**
 * Downsample grayscale if large (nearest-ish box average).
 * @param {GrayImage} img
 * @param {number} maxSide
 * @returns {{ img: GrayImage, scale: number }}
 */
function maybeDownsample(img, maxSide = 800) {
  const side = Math.max(img.w, img.h);
  if (side <= maxSide) return { img, scale: 1 };
  const scale = maxSide / side;
  const nw = Math.max(1, Math.round(img.w * scale));
  const nh = Math.max(1, Math.round(img.h * scale));
  const gray = new Float32Array(nw * nh);
  for (let y = 0; y < nh; y++) {
    const sy0 = Math.floor((y / nh) * img.h);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) / nh) * img.h));
    for (let x = 0; x < nw; x++) {
      const sx0 = Math.floor((x / nw) * img.w);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) / nw) * img.w));
      let sum = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1 && sy < img.h; sy++) {
        const row = sy * img.w;
        for (let sx = sx0; sx < sx1 && sx < img.w; sx++) {
          sum += img.gray[row + sx];
          n += 1;
        }
      }
      gray[y * nw + x] = n ? sum / n : 0;
    }
  }
  return { img: { w: nw, h: nh, gray }, scale };
}

/**
 * Column / row profiles that emphasize leather seams, not item sprites.
 * Uses mid-tone brown pixels + absolute gradient, down-weighted on bright glows.
 * @param {GrayImage} img
 */
function gradientProfiles(img) {
  const { w, h, gray } = img;
  const colProf = new Float32Array(w);
  const rowProf = new Float32Array(h);
  const colDark = new Float32Array(w);
  const rowDark = new Float32Array(h);
  const colN = new Float32Array(w);
  const rowN = new Float32Array(h);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const v = gray[row + x];
      // Leather cells are mid-brown; skip bright glows / near-white parchment
      const leather = v > 45 && v < 175 ? 1 : 0.15;
      if (x > 0) {
        const g = Math.abs(v - gray[row + x - 1]) * leather;
        colProf[x] += g;
        rowProf[y] += g;
      }
      if (y > 0) {
        const g = Math.abs(v - gray[row - w + x]) * leather;
        rowProf[y] += g;
        colProf[x] += g;
      }
      // Dark seam energy (inverted luminance on leather)
      const dark = (220 - v) * leather;
      colDark[x] += dark;
      rowDark[y] += dark;
      colN[x] += leather;
      rowN[y] += leather;
    }
  }

  for (let x = 0; x < w; x++) {
    const n = Math.max(1, colN[x]);
    colProf[x] = colProf[x] / n + 0.35 * (colDark[x] / n);
  }
  for (let y = 0; y < h; y++) {
    const n = Math.max(1, rowN[y]);
    rowProf[y] = rowProf[y] / n + 0.35 * (rowDark[y] / n);
  }
  return { colProf, rowProf };
}

/**
 * Bounding box of leather-like mid-tones (excludes parchment / empty margins).
 * @param {GrayImage} img
 */
function leatherBounds(img) {
  const { w, h, gray } = img;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let n = 0;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const v = gray[row + x];
      if (v > 50 && v < 170) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        n += 1;
      }
    }
  }
  if (n < w * h * 0.05) {
    return { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
  }
  // Inset slightly — outer parchment bleed
  const pad = 2;
  return {
    x0: Math.max(0, minX + pad),
    y0: Math.max(0, minY + pad),
    x1: Math.min(w - 1, maxX - pad),
    y1: Math.min(h - 1, maxY - pad),
  };
}

/**
 * Brute-force best pitch + phase maximizing seam energy on a lattice.
 * @param {Float32Array} profile
 * @param {number} i0  start index (inclusive)
 * @param {number} i1  end index (inclusive)
 * @param {number} lagMin
 * @param {number} lagMax
 */
function bestLattice(profile, i0, i1, lagMin, lagMax) {
  const span = Math.max(1, i1 - i0 + 1);
  const lo = Math.max(8, Math.floor(lagMin));
  const hi = Math.min(Math.floor(span / 5), Math.floor(lagMax));
  if (hi < lo) return { lag: 0, origin: 0, score: 0 };

  let best = { lag: lo, origin: 0, score: -Infinity };
  for (let lag = lo; lag <= hi; lag++) {
    const cells = span / lag;
    if (cells < 5.5 || cells > 14.5) continue;
    for (let off = 0; off < lag; off++) {
      let energy = 0;
      let count = 0;
      for (let i = i0 + off; i <= i1; i += lag) {
        energy += profile[i];
        count += 1;
        if (i > i0) {
          energy += profile[i - 1] * 0.4;
          count += 0.4;
        }
        if (i < i1) {
          energy += profile[i + 1] * 0.4;
          count += 0.4;
        }
      }
      if (count < 4) continue;
      // Prefer ~8–11 cells (typical backpack width)
      const prefer =
        cells >= 7 && cells <= 11 ? 1.15 : cells >= 6 && cells <= 12 ? 1.05 : 1;
      const score = (energy / count) * prefer;
      if (score > best.score) best = { lag, origin: off, score };
    }
  }
  // Normalize score roughly against profile mean
  let mean = 0;
  let n = 0;
  for (let i = i0; i <= i1; i++) {
    mean += profile[i];
    n += 1;
  }
  mean = n ? mean / n : 1;
  const norm = mean > 1e-6 ? best.score / mean : 0;
  return { lag: best.lag, origin: best.origin, score: norm };
}

/**
 * @param {GrayImage} grayImg
 * @returns {BagGrid}
 */
export function detectBagGrid(grayImg) {
  const fail = {
    ok: false,
    cellW: 0,
    cellH: 0,
    originX: 0,
    originY: 0,
    cols: 0,
    rows: 0,
    bagRect: { x: 0, y: 0, w: 0, h: 0 },
    score: 0,
  };

  if (!grayImg?.gray || !(grayImg.w > 16) || !(grayImg.h > 16)) return fail;

  const { img, scale } = maybeDownsample(grayImg, 800);
  const { colProf, rowProf } = gradientProfiles(img);
  const bounds = leatherBounds(img);

  const bagW = bounds.x1 - bounds.x0 + 1;
  const bagH = bounds.y1 - bounds.y0 + 1;
  const lagMin = Math.min(bagW, bagH) * 0.07;
  const lagMax = Math.min(bagW, bagH) * 0.2;

  const xFit = bestLattice(colProf, bounds.x0, bounds.x1, lagMin, lagMax);
  const yFit = bestLattice(rowProf, bounds.y0, bounds.y1, lagMin, lagMax);

  const MIN_SCORE = 1.05; // above mean seam energy
  if (xFit.score < MIN_SCORE && yFit.score < MIN_SCORE) {
    return { ...fail, score: Math.max(xFit.score, yFit.score) };
  }

  // Square cells: trust the stronger axis, or average when both ok
  let cell;
  let originX;
  let originY;
  let score;
  if (xFit.score >= MIN_SCORE && yFit.score >= MIN_SCORE) {
    cell = (xFit.lag + yFit.lag) / 2;
    // Re-fit phase with shared pitch
    originX = bestPhase(colProf, cell);
    originY = bestPhase(rowProf, cell);
    // Snap origins into bag bounds
    while (originX < bounds.x0 && cell > 0) originX += cell;
    while (originY < bounds.y0 && cell > 0) originY += cell;
    while (originX >= bounds.x0 + cell) originX -= cell;
    while (originY >= bounds.y0 + cell) originY -= cell;
    score = (xFit.score + yFit.score) / 2;
  } else if (xFit.score >= yFit.score) {
    cell = xFit.lag;
    originX = bounds.x0 + xFit.origin;
    originY = bestPhase(rowProf, cell);
    while (originY < bounds.y0) originY += cell;
    while (originY >= bounds.y0 + cell) originY -= cell;
    score = xFit.score;
  } else {
    cell = yFit.lag;
    originY = bounds.y0 + yFit.origin;
    originX = bestPhase(colProf, cell);
    while (originX < bounds.x0) originX += cell;
    while (originX >= bounds.x0 + cell) originX -= cell;
    score = yFit.score;
  }

  if (!(cell >= 8)) return { ...fail, score };

  // Expand lattice to cover leather AABB (don't leave left/top cells outside bagRect)
  // A sliver under half a cell is frame/shadow, not a missing column/row.
  const slack = cell * 0.5;
  let ox = originX;
  let oy = originY;
  while (ox > bounds.x0 + slack) ox -= cell;
  while (oy > bounds.y0 + slack) oy -= cell;
  while (ox + cell < bounds.x0) ox += cell;
  while (oy + cell < bounds.y0) oy += cell;
  originX = ox;
  originY = oy;

  const inv = scale > 0 ? 1 / scale : 1;
  const cellF = cell * inv;
  let originXF = originX * inv;
  let originYF = originY * inv;

  const cols = Math.max(
    1,
    Math.floor((Math.min(grayImg.w, bounds.x1 * inv + cellF) - originXF) / cellF),
  );
  const rows = Math.max(
    1,
    Math.floor((Math.min(grayImg.h, bounds.y1 * inv + cellF) - originYF) / cellF),
  );
  const bagRectW = Math.min(grayImg.w - originXF, cols * cellF);
  const bagRectH = Math.min(grayImg.h - originYF, rows * cellF);

  return {
    ok: true,
    cellW: cellF,
    cellH: cellF,
    originX: originXF,
    originY: originYF,
    cols,
    rows,
    bagRect: {
      x: Math.max(0, Math.round(originXF)),
      y: Math.max(0, Math.round(originYF)),
      w: Math.max(1, Math.round(bagRectW)),
      h: Math.max(1, Math.round(bagRectH)),
    },
    score,
  };
}

/**
 * @param {BagGrid} grid
 * @param {number} col
 * @param {number} row
 */
export function cellToPx(grid, col, row) {
  return {
    x: grid.originX + Number(col) * grid.cellW,
    y: grid.originY + Number(row) * grid.cellH,
  };
}

/**
 * @param {BagGrid} grid
 * @param {number} x
 * @param {number} y
 */
export function pxToCell(grid, x, y) {
  return {
    col: Math.floor((Number(x) - grid.originX) / grid.cellW),
    row: Math.floor((Number(y) - grid.originY) / grid.cellH),
  };
}

/**
 * @param {BagGrid} grid
 */
export function cropBagRect(grid) {
  if (!grid?.ok) return { x: 0, y: 0, w: 0, h: 0 };
  return { ...grid.bagRect };
}

/**
 * Fallback grid when detection fails: divide full image into cols×rows.
 * @param {number} imgW
 * @param {number} imgH
 * @param {number} [cols=9]
 * @param {number} [rows=11]
 * @returns {BagGrid}
 */
export function fallbackGrid(imgW, imgH, cols = 9, rows = 11) {
  const w = Math.max(1, Number(imgW) || 1);
  const h = Math.max(1, Number(imgH) || 1);
  const c = Math.max(1, cols);
  const r = Math.max(1, rows);
  return {
    ok: false,
    cellW: w / c,
    cellH: h / r,
    originX: 0,
    originY: 0,
    cols: c,
    rows: r,
    bagRect: { x: 0, y: 0, w, h },
    score: 0,
  };
}
