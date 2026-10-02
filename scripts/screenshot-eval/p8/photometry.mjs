/**
 * Part A + Part C. Paired pine-protector (bright capture) vs real-001 (same build).
 * Truth is used only to pair the same item at the same cell.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PAIR_A, PAIR_B, outDir } from './shared.mjs';
import { METHODS, applyPrep } from './normalize.mjs';

function loadRgb(file) {
  return loadImage(file).then((img) => {
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    const rgb = new Uint8Array(img.width * img.height * 3);
    for (let p = 0, i = 0; p < rgb.length; i += 4) {
      rgb[p++] = data[i];
      rgb[p++] = data[i + 1];
      rgb[p++] = data[i + 2];
    }
    return { rgb, w: img.width, h: img.height };
  });
}

const luma = (rgb, i) => 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2];

function hsv(r, g, b) {
  const R = r / 255; const G = g / 255; const B = b / 255;
  const max = Math.max(R, G, B); const min = Math.min(R, G, B); const d = max - min;
  return { s: max === 0 ? 0 : d / max, v: max };
}

function labL(r, g, b) {
  const lin = (u) => { const x = u / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const y = lin(r) * 0.2126729 + lin(g) * 0.7151522 + lin(b) * 0.072175;
  const fy = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  return 116 * fy - 16;
}

function sobelMean(rgb, w, h, rect) {
  const yb = new Float32Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 3) yb[p] = luma(rgb, i);
  let sum = 0; let n = 0;
  for (let y = Math.max(1, rect.y0); y < Math.min(h - 1, rect.y1); y++) {
    for (let x = Math.max(1, rect.x0); x < Math.min(w - 1, rect.x1); x++) {
      const i = y * w + x;
      const gx = -yb[i - w - 1] - 2 * yb[i - 1] - yb[i + w - 1] + yb[i - w + 1] + 2 * yb[i + 1] + yb[i + w + 1];
      const gy = -yb[i - w - 1] - 2 * yb[i - w] - yb[i - w + 1] + yb[i + w - 1] + 2 * yb[i + w] + yb[i + w + 1];
      sum += Math.hypot(gx, gy);
      n++;
    }
  }
  return n ? sum / n : 0;
}

function rectFor(w, h) {
  const cellsW = Math.round(w / 48) - 3;
  const cellsH = Math.round(h / 48) - 3;
  return { x0: 72, y0: 72, x1: 72 + cellsW * 48, y1: 72 + cellsH * 48, cellsW, cellsH };
}

function sample(rgb, w, h, rect, dx, dy) {
  const ys = [];
  const rgbs = [];
  for (let y = rect.y0; y < rect.y1; y += 2) {
    for (let x = rect.x0; x < rect.x1; x += 2) {
      const xx = x + dx; const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const i = (yy * w + xx) * 3;
      ys.push(luma(rgb, i));
      rgbs.push([rgb[i], rgb[i + 1], rgb[i + 2]]);
    }
  }
  return { ys, rgbs };
}

function mean(a) { return a.reduce((s, v) => s + v, 0) / Math.max(1, a.length); }
function std(a) {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length));
}
function r2(obs, pred) {
  const m = mean(obs);
  let ss = 0; let tt = 0;
  for (let i = 0; i < obs.length; i++) {
    ss += (obs[i] - pred[i]) ** 2;
    tt += (obs[i] - m) ** 2;
  }
  return tt < 1e-6 ? 0 : 1 - ss / tt;
}
function round(n, d = 1000) { return Math.round(n * d) / d; }

function fit(bright, dim) {
  const n = bright.length;
  let sb = 0; let sd = 0; let sbb = 0; let sbd = 0;
  for (let i = 0; i < n; i++) {
    sb += bright[i]; sd += dim[i]; sbb += bright[i] * bright[i]; sbd += bright[i] * dim[i];
  }
  const k = sbb > 1 ? sbd / sbb : 1;
  const predK = bright.map((v) => k * v);
  const denom = n * sbb - sb * sb;
  const a = denom !== 0 ? (n * sbd - sb * sd) / denom : 1;
  const c = (sd - a * sb) / n;
  const predA = bright.map((v) => a * v + c);
  let bestG = 1; let bestGR = -Infinity; let bestGk = 1;
  for (let g = 0.35; g <= 2.4; g += 0.05) {
    const base = bright.map((v) => 255 * (Math.max(0, v) / 255) ** g);
    let p2 = 0; let pd = 0;
    for (let i = 0; i < n; i++) { p2 += base[i] * base[i]; pd += base[i] * dim[i]; }
    const kk = p2 > 1 ? pd / p2 : 1;
    const pred = base.map((v) => kk * v);
    const score = r2(dim, pred);
    if (score > bestGR) { bestGR = score; bestG = g; bestGk = kk; }
  }
  return {
    multiplicative: { k: round(k), r2: round(r2(dim, predK)) },
    affine: { a: round(a), c: round(c), r2: round(r2(dim, predA)) },
    gamma: { g: round(bestG, 100), k: round(bestGk), r2: round(bestGR) },
  };
}

function regionStats(rgb, w, h, rect) {
  const { ys, rgbs } = sample(rgb, w, h, rect, 0, 0);
  let r = 0; let g = 0; let b = 0; let s = 0; let L = 0;
  for (const px of rgbs) {
    r += px[0]; g += px[1]; b += px[2];
    s += hsv(px[0], px[1], px[2]).s;
    L += labL(px[0], px[1], px[2]);
  }
  const n = Math.max(1, rgbs.length);
  const border = [];
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      if (x >= rect.x0 && x < rect.x1 && y >= rect.y0 && y < rect.y1) continue;
      border.push(luma(rgb, (y * w + x) * 3));
    }
  }
  const itemMean = mean(ys);
  const bgMean = mean(border);
  return {
    rgb: [round(r / n, 10), round(g / n, 10), round(b / n, 10)],
    sat: round(s / n),
    labL: round(L / n),
    luma: round(itemMean),
    lumaStd: round(std(ys)),
    contrast: round(Math.abs(itemMean - bgMean)),
    contrastOverBg: round(Math.abs(itemMean - bgMean) / (std(border) + 1)),
    edge: round(sobelMean(rgb, w, h, rect)),
  };
}

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let num = 0; let da = 0; let db = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - ma; const xb = b[i] - mb;
    num += xa * xb; da += xa * xa; db += xb * xb;
  }
  return da < 1e-6 || db < 1e-6 ? 0 : num / Math.sqrt(da * db);
}

function l2(a, b) {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s / Math.max(1, n));
}

const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
const A = manifest.fixtures.find((f) => f.fixture === PAIR_A);
const B = manifest.fixtures.find((f) => f.fixture === PAIR_B);
const key = (r) => `${r.name}|${r.x}|${r.y}`;
const bMap = new Map(B.instances.filter((r) => r.canon).map((r) => [key(r), r]));

const pairs = [];
for (const a of A.instances) {
  if (!a.canon || a.kind !== 'item') continue;
  const b = bMap.get(key(a));
  if (!b?.canon) continue;
  const imgA = await loadRgb(path.join(outDir, a.canon));
  const imgB = await loadRgb(path.join(outDir, b.canon));
  if (imgA.w !== imgB.w || imgA.h !== imgB.h) continue;
  const rect = rectFor(imgA.w, imgA.h);
  const stA = regionStats(imgA.rgb, imgA.w, imgA.h, rect);
  const stB = regionStats(imgB.rgb, imgB.w, imgB.h, rect);
  let best = { dx: 0, dy: 0, corr: -2 };
  const baseA = sample(imgA.rgb, imgA.w, imgA.h, rect, 0, 0).ys;
  for (let dy = -6; dy <= 6; dy += 2) {
    for (let dx = -6; dx <= 6; dx += 2) {
      const ys = sample(imgB.rgb, imgB.w, imgB.h, rect, dx, dy).ys;
      const corr = pearson(baseA, ys);
      if (corr > best.corr) best = { dx, dy, corr };
    }
  }
  const sA = sample(imgA.rgb, imgA.w, imgA.h, rect, 0, 0);
  const sB = sample(imgB.rgb, imgB.w, imgB.h, rect, best.dx, best.dy);
  const n = Math.min(sA.ys.length, sB.ys.length);
  const fitL = fit(sA.ys.slice(0, n), sB.ys.slice(0, n));
  const borderB = [];
  for (let y = 0; y < imgB.h; y += 3) {
    for (let x = 0; x < imgB.w; x += 3) {
      if (x >= rect.x0 && x < rect.x1 && y >= rect.y0 && y < rect.y1) continue;
      borderB.push(luma(imgB.rgb, (y * imgB.w + x) * 3));
    }
  }
  const C = mean(borderB);
  let bestA = 1; let bestAR = -Infinity;
  for (let alpha = 0.25; alpha <= 1.15; alpha += 0.05) {
    const pred = sA.ys.slice(0, n).map((v) => alpha * v + (1 - alpha) * C);
    const score = r2(sB.ys.slice(0, n), pred);
    if (score > bestAR) { bestAR = score; bestA = alpha; }
  }
  const norms = {};
  for (const method of METHODS) {
    if (!method.prep) continue;
    const na = applyPrep(method.prep, imgA.rgb, imgA.w, imgA.h);
    const nb = applyPrep(method.prep, imgB.rgb, imgB.w, imgB.h);
    const ya = sample(na, imgA.w, imgA.h, rect, 0, 0).ys;
    const yb = sample(nb, imgB.w, imgB.h, rect, best.dx, best.dy).ys;
    const m = Math.min(ya.length, yb.length);
    norms[method.id] = {
      l2: round(l2(ya.slice(0, m), yb.slice(0, m))),
      corr: round(pearson(ya.slice(0, m), yb.slice(0, m))),
    };
  }
  const rawL2 = round(l2(sA.ys.slice(0, n), sB.ys.slice(0, n)));
  const rawCorr = round(pearson(sA.ys.slice(0, n), sB.ys.slice(0, n)));
  pairs.push({
    name: a.name, x: a.x, y: a.y, area: a.area,
    shift: best,
    bright: stA,
    dimmed: stB,
    lumaRatio: round(stB.luma / Math.max(1, stA.luma)),
    stdRatio: round(stB.lumaStd / Math.max(1, stA.lumaStd)),
    satRatio: round(stB.sat / Math.max(0.01, stA.sat)),
    edgeRatio: round(stB.edge / Math.max(0.01, stA.edge)),
    contrastRatio: round(stB.contrast / Math.max(0.01, stA.contrast)),
    fit: { ...fitL, alphaOverlay: { alpha: round(bestA, 100), bg: round(C), r2: round(bestAR) } },
    distance: { raw: { l2: rawL2, corr: rawCorr }, ...norms },
  });
  console.log(`${a.name} @${a.x},${a.y} luma×${(stB.luma / Math.max(1, stA.luma)).toFixed(2)} affineR2 ${fitL.affine.r2} alpha ${bestA.toFixed(2)}`);
}

function med(arr, fn) {
  const v = arr.map(fn).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.floor(v.length / 2)];
}

const dimPairs = pairs.filter((p) => p.lumaRatio < 0.85);
const report = {
  pair: `${PAIR_B} (in-game) vs ${PAIR_A} (same cells)`,
  n: pairs.length,
  dimmedByLuma: dimPairs.length,
  median: {
    lumaRatio: med(pairs, (p) => p.lumaRatio),
    stdRatio: med(pairs, (p) => p.stdRatio),
    satRatio: med(pairs, (p) => p.satRatio),
    edgeRatio: med(pairs, (p) => p.edgeRatio),
    contrastRatio: med(pairs, (p) => p.contrastRatio),
    affineR2: med(pairs, (p) => p.fit.affine.r2),
    affineA: med(pairs, (p) => p.fit.affine.a),
    multK: med(pairs, (p) => p.fit.multiplicative.k),
    multR2: med(pairs, (p) => p.fit.multiplicative.r2),
    gamma: med(pairs, (p) => p.fit.gamma.g),
    gammaR2: med(pairs, (p) => p.fit.gamma.r2),
    alpha: med(pairs, (p) => p.fit.alphaOverlay.alpha),
    alphaR2: med(pairs, (p) => p.fit.alphaOverlay.r2),
    rawL2: med(pairs, (p) => p.distance.raw.l2),
    rawCorr: med(pairs, (p) => p.distance.raw.corr),
  },
  dimmedMedian: dimPairs.length ? {
    n: dimPairs.length,
    lumaRatio: med(dimPairs, (p) => p.lumaRatio),
    contrastRatio: med(dimPairs, (p) => p.contrastRatio),
    edgeRatio: med(dimPairs, (p) => p.edgeRatio),
    satRatio: med(dimPairs, (p) => p.satRatio),
    affineA: med(dimPairs, (p) => p.fit.affine.a),
    affineC: med(dimPairs, (p) => p.fit.affine.c),
    affineR2: med(dimPairs, (p) => p.fit.affine.r2),
    alpha: med(dimPairs, (p) => p.fit.alphaOverlay.alpha),
    alphaR2: med(dimPairs, (p) => p.fit.alphaOverlay.r2),
    gamma: med(dimPairs, (p) => p.fit.gamma.g),
    gammaR2: med(dimPairs, (p) => p.fit.gamma.r2),
    multR2: med(dimPairs, (p) => p.fit.multiplicative.r2),
  } : null,
  normDistanceMedian: Object.fromEntries(['raw', ...METHODS.filter((m) => m.prep).map((m) => m.id)].map((id) => [id, {
    l2: med(pairs, (p) => p.distance[id].l2),
    corr: med(pairs, (p) => p.distance[id].corr),
  }])),
  examples: [...pairs].sort((a, b) => a.lumaRatio - b.lumaRatio).filter((_, i, arr) => i < 3 || i >= arr.length - 2),
};
fs.writeFileSync(path.join(outDir, 'photometry.json'), JSON.stringify({ report, pairs }, null, 2));
console.log(JSON.stringify(report.median, null, 2));
console.log('dimmed', JSON.stringify(report.dimmedMedian, null, 2));
console.log('norm', JSON.stringify(report.normDistanceMedian, null, 2));
