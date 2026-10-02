/**
 * Deterministic, per-region photometric normalizations.
 * Parameters are algorithm constants, not fit per screenshot.
 */

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const lumaAt = (rgb, i) => 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2];

function copy(rgb) {
  return new Uint8Array(rgb);
}

function histPercentile(hist, total, p) {
  const target = (p / 100) * total;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= target) return i;
  }
  return 255;
}

function channelHist(rgb, w, h, ch, mask) {
  const hist = new Uint32Array(256);
  let n = 0;
  for (let p = 0, i = ch; p < w * h; p++, i += 3) {
    if (mask && !mask[p]) continue;
    hist[rgb[i]]++;
    n++;
  }
  return { hist, n };
}

/** Outer ring used as a background estimate. */
function borderMask(w, h) {
  const bw = Math.max(4, Math.round(w * 0.12));
  const bh = Math.max(4, Math.round(h * 0.12));
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < bw || y < bh || x >= w - bw || y >= h - bh) mask[y * w + x] = 1;
    }
  }
  return mask;
}

function medianBorder(rgb, w, h) {
  const mask = borderMask(w, h);
  const med = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const { hist, n } = channelHist(rgb, w, h, c, mask);
    med[c] = histPercentile(hist, Math.max(1, n), 50);
  }
  return med;
}

export function percentileStretch(rgb, w, h) {
  const out = new Uint8Array(rgb.length);
  for (let c = 0; c < 3; c++) {
    const { hist, n } = channelHist(rgb, w, h, c, null);
    const lo = histPercentile(hist, n, 2);
    const hi = histPercentile(hist, n, 98);
    const span = Math.max(8, hi - lo);
    for (let p = 0, i = c; p < w * h; p++, i += 3) {
      out[i] = clamp(((rgb[i] - lo) * 255) / span);
    }
  }
  return out;
}

export function lumaScale(rgb, w, h) {
  let sum = 0;
  const n = w * h;
  for (let p = 0, i = 0; p < n; p++, i += 3) sum += lumaAt(rgb, i);
  const mean = sum / n;
  if (mean < 2) return copy(rgb);
  const k = 140 / mean;
  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < rgb.length; i++) out[i] = clamp(rgb[i] * k);
  return out;
}

export function gammaMid(rgb, w, h) {
  let sum = 0;
  const n = w * h;
  for (let p = 0, i = 0; p < n; p++, i += 3) sum += lumaAt(rgb, i);
  const m = sum / n / 255;
  if (m < 0.05 || m > 0.92) return copy(rgb);
  let g = Math.log(0.5) / Math.log(m);
  g = Math.min(2.6, Math.max(0.4, g));
  const lut = new Uint8Array(256);
  for (let v = 0; v < 256; v++) lut[v] = clamp(255 * (v / 255) ** g);
  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < rgb.length; i++) out[i] = lut[rgb[i]];
  return out;
}

function mapLuma(rgb, w, h, mapY) {
  const out = new Uint8Array(rgb.length);
  const n = w * h;
  for (let p = 0, i = 0; p < n; p++, i += 3) {
    const y = lumaAt(rgb, i);
    const dst = mapY(y, p);
    const scale = y > 1 ? dst / y : 1;
    out[i] = clamp(rgb[i] * scale);
    out[i + 1] = clamp(rgb[i + 1] * scale);
    out[i + 2] = clamp(rgb[i + 2] * scale);
  }
  return out;
}

export function histEq(rgb, w, h) {
  const hist = new Uint32Array(256);
  const n = w * h;
  const ys = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 3) {
    const y = lumaAt(rgb, i);
    ys[p] = y;
    hist[clamp(y)]++;
  }
  const cdf = new Uint32Array(256);
  cdf[0] = hist[0];
  for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
  const lut = new Uint8Array(256);
  const c0 = cdf.find((v) => v > 0) || 0;
  for (let i = 0; i < 256; i++) {
    lut[i] = clamp(((cdf[i] - c0) * 255) / Math.max(1, n - c0));
  }
  return mapLuma(rgb, w, h, (y) => lut[clamp(y)]);
}

function clipHist(hist, clip) {
  const excess = hist.reduce((a, v) => a + Math.max(0, v - clip), 0);
  const add = excess / 256;
  for (let i = 0; i < 256; i++) hist[i] = Math.min(hist[i], clip) + add;
}

/**
 * CLAHE on luminance. 8×8 tiles, clip limit 2 — OpenCV defaults, not fit per image.
 */
export function clahe(rgb, w, h) {
  const tiles = 8;
  const tx = Math.min(tiles, Math.max(1, Math.floor(w / 16)));
  const ty = Math.min(tiles, Math.max(1, Math.floor(h / 16)));
  const n = w * h;
  const ys = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 3) ys[p] = lumaAt(rgb, i);
  const tw = w / tx;
  const th = h / ty;
  const maps = [];
  for (let tyi = 0; tyi < ty; tyi++) {
    for (let txi = 0; txi < tx; txi++) {
      const x0 = Math.floor(txi * tw);
      const y0 = Math.floor(tyi * th);
      const x1 = Math.floor((txi + 1) * tw);
      const y1 = Math.floor((tyi + 1) * th);
      const hist = new Uint32Array(256);
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          hist[clamp(ys[y * w + x])]++;
          count++;
        }
      }
      const clip = Math.max(1, (count / 256) * 2);
      clipHist(hist, clip);
      let acc = 0;
      const lut = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        acc += hist[i];
        lut[i] = clamp((acc * 255) / Math.max(1, count));
      }
      maps.push({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, lut });
    }
  }
  const outY = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = Math.min(tx - 1, Math.max(0, Math.floor(x / tw)));
      const gy = Math.min(ty - 1, Math.max(0, Math.floor(y / th)));
      const x0 = Math.max(0, gx - (x < maps[gy * tx + gx].cx ? 1 : 0));
      const y0 = Math.max(0, gy - (y < maps[gy * tx + gx].cy ? 1 : 0));
      const x1 = Math.min(tx - 1, x0 + 1);
      const y1 = Math.min(ty - 1, y0 + 1);
      const m00 = maps[y0 * tx + x0];
      const m10 = maps[y0 * tx + x1];
      const m01 = maps[y1 * tx + x0];
      const m11 = maps[y1 * tx + x1];
      const fx = x1 === x0 ? 0 : (x - m00.cx) / Math.max(1e-3, m10.cx - m00.cx);
      const fy = y1 === y0 ? 0 : (y - m00.cy) / Math.max(1e-3, m01.cy - m00.cy);
      const v = clamp(ys[y * w + x]);
      const a = m00.lut[v] * (1 - fx) + m10.lut[v] * fx;
      const b = m01.lut[v] * (1 - fx) + m11.lut[v] * fx;
      outY[y * w + x] = a * (1 - fy) + b * fy;
    }
  }
  return mapLuma(rgb, w, h, (_y, p) => outY[p]);
}

function srgbToLin(u) {
  const x = u / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}
function linToSrgb(u) {
  const x = u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055;
  return clamp(x * 255);
}
function fLab(t) {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}
function finv(t) {
  const t3 = t * t * t;
  return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
}
function rgbToLab(r, g, b) {
  const R = srgbToLin(r);
  const G = srgbToLin(g);
  const B = srgbToLin(b);
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
  const z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const fx = fLab(x);
  const fy = fLab(y);
  const fz = fLab(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function labToRgb(L, a, b) {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const x = finv(fx) * 0.95047;
  const y = finv(fy);
  const z = finv(fz) * 1.08883;
  const R = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const G = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  const B = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
  return [linToSrgb(R), linToSrgb(G), linToSrgb(B)];
}

export function labLNormalize(rgb, w, h) {
  const n = w * h;
  const labs = new Float32Array(n * 3);
  let sum = 0;
  for (let p = 0, i = 0; p < n; p++, i += 3) {
    const lab = rgbToLab(rgb[i], rgb[i + 1], rgb[i + 2]);
    labs[p * 3] = lab[0];
    labs[p * 3 + 1] = lab[1];
    labs[p * 3 + 2] = lab[2];
    sum += lab[0];
  }
  const mean = sum / n;
  let v = 0;
  for (let p = 0; p < n; p++) {
    const d = labs[p * 3] - mean;
    v += d * d;
  }
  const std = Math.sqrt(v / n);
  if (std < 1) return copy(rgb);
  const out = new Uint8Array(rgb.length);
  for (let p = 0, i = 0; p < n; p++, i += 3) {
    const L = ((labs[p * 3] - mean) / std) * 18 + 55;
    const rgb2 = labToRgb(Math.min(100, Math.max(0, L)), labs[p * 3 + 1], labs[p * 3 + 2]);
    out[i] = rgb2[0];
    out[i + 1] = rgb2[1];
    out[i + 2] = rgb2[2];
  }
  return out;
}

function hsvOf(r, g, b) {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, max === 0 ? 0 : d / max, max];
}
function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const m = [v, q, p, p, t, v][i % 6];
  const n = [t, v, v, q, p, p][i % 6];
  const o = [p, p, t, v, v, q][i % 6];
  return [clamp(m * 255), clamp(n * 255), clamp(o * 255)];
}

export function hsvVNormalize(rgb, w, h) {
  const n = w * h;
  let sum = 0;
  const hsv = new Float32Array(n * 3);
  for (let p = 0, i = 0; p < n; p++, i += 3) {
    const t = hsvOf(rgb[i], rgb[i + 1], rgb[i + 2]);
    hsv[p * 3] = t[0];
    hsv[p * 3 + 1] = t[1];
    hsv[p * 3 + 2] = t[2];
    sum += t[2];
  }
  const mean = sum / n;
  if (mean < 0.02) return copy(rgb);
  const k = 0.55 / mean;
  const out = new Uint8Array(rgb.length);
  for (let p = 0, i = 0; p < n; p++, i += 3) {
    const rgb2 = hsvToRgb(hsv[p * 3], hsv[p * 3 + 1], Math.min(1, hsv[p * 3 + 2] * k));
    out[i] = rgb2[0];
    out[i + 1] = rgb2[1];
    out[i + 2] = rgb2[2];
  }
  return out;
}

export function grayStretch(rgb, w, h) {
  const n = w * h;
  const ys = new Uint8Array(n);
  const hist = new Uint32Array(256);
  for (let p = 0, i = 0; p < n; p++, i += 3) {
    const y = clamp(lumaAt(rgb, i));
    ys[p] = y;
    hist[y]++;
  }
  const lo = histPercentile(hist, n, 2);
  const hi = histPercentile(hist, n, 98);
  const span = Math.max(8, hi - lo);
  const out = new Uint8Array(rgb.length);
  for (let p = 0, i = 0; p < n; p++, i += 3) {
    const y = clamp(((ys[p] - lo) * 255) / span);
    out[i] = y;
    out[i + 1] = y;
    out[i + 2] = y;
  }
  return out;
}

function shiftFromBg(rgb, w, h, fn) {
  const bg = medianBorder(rgb, w, h);
  const out = new Uint8Array(rgb.length);
  for (let i = 0; i < rgb.length; i += 3) {
    out[i] = clamp(fn(rgb[i], bg[0]));
    out[i + 1] = clamp(fn(rgb[i + 1], bg[1]));
    out[i + 2] = clamp(fn(rgb[i + 2], bg[2]));
  }
  return out;
}

/** Subtract the border median and recenter. Inverts a flat overlay up to scale. */
export function bgRelative(rgb, w, h) {
  return shiftFromBg(rgb, w, h, (v, b) => v - b + 128);
}

/**
 * Game Item.setEditMode(false) draws the idle layer at modulate.a = 0.6.
 * Invert out = 0.6*item + 0.4*bg using the region's own border as bg.
 */
export function unblendEditMode(rgb, w, h) {
  return shiftFromBg(rgb, w, h, (v, b) => (v - 0.4 * b) / 0.6);
}

const PREP = {
  pct: percentileStretch,
  luma: lumaScale,
  gamma: gammaMid,
  histeq: histEq,
  clahe,
  labL: labLNormalize,
  hsvV: hsvVNormalize,
  gray: grayStretch,
  bg: bgRelative,
  unblend60: unblendEditMode,
  bgPct: (rgb, w, h) => percentileStretch(bgRelative(rgb, w, h), w, h),
  unblend60Pct: (rgb, w, h) => percentileStretch(unblendEditMode(rgb, w, h), w, h),
};

export const METHODS = [
  { id: 'raw', prep: null, grayW: 0.5, edgeW: 0.5 },
  { id: 'pct', prep: 'pct', grayW: 0.5, edgeW: 0.5 },
  { id: 'luma', prep: 'luma', grayW: 0.5, edgeW: 0.5 },
  { id: 'gamma', prep: 'gamma', grayW: 0.5, edgeW: 0.5 },
  { id: 'histeq', prep: 'histeq', grayW: 0.5, edgeW: 0.5 },
  { id: 'clahe', prep: 'clahe', grayW: 0.5, edgeW: 0.5 },
  { id: 'lab-l', prep: 'labL', grayW: 0.5, edgeW: 0.5 },
  { id: 'hsv-v', prep: 'hsvV', grayW: 0.5, edgeW: 0.5 },
  { id: 'gray', prep: 'gray', grayW: 0.5, edgeW: 0.5 },
  { id: 'edge', prep: null, grayW: 0, edgeW: 1 },
  { id: 'bg-rel', prep: 'bg', grayW: 0.5, edgeW: 0.5 },
  { id: 'unblend60', prep: 'unblend60', grayW: 0.5, edgeW: 0.5 },
  { id: 'clahe-edge', prep: 'clahe', grayW: 0.25, edgeW: 0.75 },
  { id: 'bg-pct', prep: 'bgPct', grayW: 0.5, edgeW: 0.5 },
  { id: 'unblend60-pct', prep: 'unblend60Pct', grayW: 0.5, edgeW: 0.5 },
];

export function applyPrep(id, rgb, w, h) {
  if (!id) return rgb;
  const fn = PREP[id];
  if (!fn) throw new Error(`unknown prep ${id}`);
  return fn(rgb, w, h);
}
