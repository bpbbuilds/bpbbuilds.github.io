/**
 * P10 registration-window sweep. Eval only.
 * Same P3 thumbs NCC as P8 raw (gray 0.5 + edge 0.5, stride 2, 518 classes,
 * oblong faces, candidate anchors). The only change is the translation radius.
 *
 *   node scripts/screenshot-eval/p10/sweep.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { knownScales, prepareTemplateGray } from '../../../js/shared/screenshot-ncc.js';
import { CELL_PX, CLEAN_BRIGHT, FIXTURES, STRIDE, isOblong, loadCatalog, repo } from '../p8/shared.mjs';

const P8 = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p8');
const OUT = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p10');
const RADII = [4, 6, 8, 12];
const FAILING = new Set(['real-003', 'real-007', 'real-008', 'real-013', 'leather-quad']);
const KNOWN_ASSET = new Set(['Vampiric Armor', 'Shovel-B01 3000', 'Con-Trap-Tron']);

function sobel(buf, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -buf[i - w - 1] - 2 * buf[i - 1] - buf[i + w - 1] + buf[i - w + 1] + 2 * buf[i + 1] + buf[i + w + 1];
      const gy = -buf[i - w - 1] - 2 * buf[i - w] - buf[i - w + 1] + buf[i + w - 1] + 2 * buf[i + w] + buf[i + w + 1];
      out[i] = Math.hypot(gx, gy);
    }
  }
  return out;
}

function packNeedle(grayBuf) {
  const { w, h, gray, alpha } = grayBuf;
  const idx = [];
  for (let i = 0; i < gray.length; i++) if (alpha[i] >= 24) idx.push(i);
  const index = new Int32Array(idx);
  let sum = 0;
  for (const i of index) sum += gray[i];
  const mean = index.length ? sum / index.length : 0;
  const tC = new Float32Array(index.length);
  let varSum = 0;
  for (let k = 0; k < index.length; k++) {
    const d = gray[index[k]] - mean;
    tC[k] = d;
    varSum += d * d;
  }
  return { w, h, idx: index, tC, tNorm: Math.sqrt(varSum), tCount: index.length };
}

function gridsFor(originX, originY, maxX, maxY) {
  return RADII.map((r) => {
    const x0 = Math.max(0, Math.min(maxX, originX - r));
    const y0 = Math.max(0, Math.min(maxY, originY - r));
    const x1 = Math.max(x0, Math.min(maxX, originX + r));
    const y1 = Math.max(y0, Math.min(maxY, originY + r));
    return { r, x0, y0, x1, y1 };
  });
}

function bestByRadius(hay, hayW, hayH, needle, originX, originY) {
  const { w: tw, h: th, idx, tC, tNorm, tCount } = needle;
  if (tw < 8 || th < 8 || tw >= hayW || th >= hayH || tCount < 16 || tNorm < 1e-3) {
    const empty = {};
    for (const r of RADII) empty[r] = { score: -1, x: originX, y: originY, dx: 0, dy: 0 };
    return empty;
  }
  const maxX = hayW - tw;
  const maxY = hayH - th;
  const grids = gridsFor(originX, originY, maxX, maxY);
  const seen = new Set();
  const pts = [];
  for (const g of grids) {
    for (let y = g.y0; y <= g.y1; y += STRIDE) {
      for (let x = g.x0; x <= g.x1; x += STRIDE) {
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pts.push(x, y);
      }
    }
  }
  const rel = new Int32Array(idx.length);
  for (let k = 0; k < idx.length; k++) {
    const p = idx[k];
    rel[k] = ((p / tw) | 0) * hayW + (p % tw);
  }
  const best = {};
  for (const r of RADII) best[r] = { score: -1, x: originX, y: originY, dx: 0, dy: 0 };
  const minCount = tCount * 0.7;
  for (let p = 0; p < pts.length; p += 2) {
    const x = pts[p];
    const y = pts[p + 1];
    const base = y * hayW + x;
    let sSum = 0;
    let sCount = 0;
    for (let k = 0; k < rel.length; k++) {
      sSum += hay[base + rel[k]];
      sCount++;
    }
    if (sCount < minCount) continue;
    const sMean = sSum / sCount;
    let num = 0;
    let sVar = 0;
    for (let k = 0; k < rel.length; k++) {
      const sv = hay[base + rel[k]] - sMean;
      num += sv * tC[k];
      sVar += sv * sv;
    }
    if (sVar < 1e-3) continue;
    const score = num / (Math.sqrt(sVar) * tNorm);
    const dx = x - originX;
    const dy = y - originY;
    for (const g of grids) {
      if (x < g.x0 || x > g.x1 || y < g.y0 || y > g.y1) continue;
      if ((x - g.x0) % STRIDE !== 0 || (y - g.y0) % STRIDE !== 0) continue;
      if (score > best[g.r].score) best[g.r] = { score, x, y, dx, dy };
    }
  }
  return best;
}

function median(vals) {
  if (!vals.length) return null;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mean(vals) {
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function round3(n) {
  return n == null || !Number.isFinite(n) ? null : Math.round(n * 1000) / 1000;
}

const { classes, shapes, display } = loadCatalog();
const makeCanvas = (w, h) => createCanvas(w, h);
const drawImage = (source, ctx, x, y, w, h) => ctx.drawImage(source, x, y, w, h);

console.log('loading thumbs…');
const pool = [];
const needles = new Map();
for (const c of classes) {
  const file = path.join(repo, 'assets/item-thumbs/2x', `${c.image}.webp`);
  if (!fs.existsSync(file)) continue;
  const img = await loadImage(file);
  const disp = display[`${c.image}.png`] || {};
  const scale = knownScales(CELL_PX, Number(disp.w) || 1, img.width)[2] || 1;
  const byFace = [];
  for (const r of [0, 1, 2, 3]) {
    const gray = prepareTemplateGray(img, r * 90, scale, makeCanvas, drawImage);
    byFace[r] = {
      gray: packNeedle(gray),
      edge: packNeedle({ w: gray.w, h: gray.h, gray: sobel(gray.gray, gray.w, gray.h), alpha: gray.alpha }),
    };
  }
  pool.push({
    id: c.id,
    name: c.name,
    image: c.image,
    pool: pool.length,
    oblong: isOblong(shapes, c),
    anchorX: Number(disp.anchorX) || 0,
    anchorY: Number(disp.anchorY) || 0,
  });
  needles.set(c.id, byFace);
}
console.log(`pool ${pool.length}`);

function rankRadii(gray, edge, w, h, inst) {
  const ranked = Object.fromEntries(RADII.map((r) => [r, []]));
  for (const cand of pool) {
    const faces = cand.oblong ? [0, 1, 2, 3] : [0];
    const ecx = inst.cxr + cand.anchorX * CELL_PX;
    const ecy = inst.cyr + cand.anchorY * CELL_PX;
    const packed = needles.get(cand.id);
    const faceHits = [];
    for (const face of faces) {
      const gN = packed[face].gray;
      const eN = packed[face].edge;
      if (gN.w < 8 || gN.h < 8 || gN.w >= w || gN.h >= h) continue;
      const ox = Math.floor(ecx - gN.w / 2);
      const oy = Math.floor(ecy - gN.h / 2);
      faceHits.push({
        face,
        gray: bestByRadius(gray, w, h, gN, ox, oy),
        edge: bestByRadius(edge, w, h, eN, ox, oy),
      });
    }
    if (!faceHits.length) continue;
    for (const radius of RADII) {
      let best = null;
      for (const hit of faceHits) {
        const g = hit.gray[radius];
        const e = hit.edge[radius];
        const score = 0.5 * g.score + 0.5 * e.score;
        if (!best || score > best.score) {
          best = { face: hit.face, score, gray: g.score, edge: e.score, dx: g.dx, dy: g.dy };
        }
      }
      ranked[radius].push({ id: cand.id, name: cand.name, ...best });
    }
  }
  const out = {};
  for (const radius of RADII) {
    const rows = ranked[radius];
    rows.sort((a, b) => b.score - a.score);
    const at = rows.findIndex((q) => q.id === inst.truthId);
    const truth = at >= 0 ? rows[at] : null;
    const top = rows[0] || null;
    out[radius] = {
      rank: at >= 0 ? at + 1 : 0,
      score: truth ? round3(truth.score) : null,
      gray: truth ? round3(truth.gray) : null,
      dx: truth ? truth.dx : null,
      dy: truth ? truth.dy : null,
      face: truth ? truth.face : null,
      top: top ? { id: top.id, name: top.name, score: round3(top.score) } : null,
    };
  }
  return out;
}

async function rgbOf(file) {
  const img = await loadImage(file);
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
  const w = img.width;
  const h = img.height;
  const g = new Float32Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 3) g[p] = 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2];
  return { gray: g, edge: sobel(g, w, h), w, h };
}

const manifest = JSON.parse(fs.readFileSync(path.join(P8, 'manifest.json'), 'utf8'));
const items = [];
const t0 = Date.now();
for (const name of FIXTURES) {
  const fix = manifest.fixtures.find((f) => f.fixture === name);
  const ft = Date.now();
  for (const inst of fix.instances) {
    if (inst.kind !== 'item') continue;
    if (!inst.match || inst.missing) {
      items.push({ fixture: name, name: inst.name, x: inst.x, y: inst.y, miss: inst.missing || 'no-crop' });
      continue;
    }
    const hay = await rgbOf(path.join(P8, inst.match));
    const radii = rankRadii(hay.gray, hay.edge, hay.w, hay.h, inst);
    items.push({ fixture: name, name: inst.name, x: inst.x, y: inst.y, truthId: inst.truthId, radii });
    const c = radii[4];
    const w12 = radii[12];
    console.log(`${name} ${inst.name} @${inst.x},${inst.y} ±4#${c.rank} ±12#${w12.rank} gray12=${w12.gray}`);
  }
  console.log(`${name} ${(Date.now() - ft) / 1000}s`);
}
const elapsedMs = Date.now() - t0;

function recalls(rows) {
  const pack = (k) => rows.filter((row) => row.radii && row.radii[k] && row.radii[k].rank > 0 && row.radii[k].rank <= 1).length;
  const out = {};
  for (const r of RADII) {
    const hit = (k) => rows.filter((row) => row.radii?.[r]?.rank > 0 && row.radii[r].rank <= k).length;
    out[r] = { n: rows.length, top1: hit(1), top3: hit(3), top5: hit(5), top10: hit(10), top20: hit(20) };
    void pack;
  }
  return out;
}

function shifts(rows, radius) {
  const dx = [];
  const dy = [];
  let outside = 0;
  let strong = 0;
  let strongOutside = 0;
  for (const row of rows) {
    const hit = row.radii?.[radius];
    if (!hit || hit.gray == null) continue;
    dx.push(hit.dx);
    dy.push(hit.dy);
    const out = Math.abs(hit.dx) > 4 || Math.abs(hit.dy) > 4;
    if (out) outside++;
    if (hit.gray >= 0.7) {
      strong++;
      if (out) strongOutside++;
    }
  }
  return {
    n: dx.length,
    meanDx: round3(mean(dx)),
    meanDy: round3(mean(dy)),
    medianDx: median(dx),
    medianDy: median(dy),
    optimumOutside4: outside,
    optimumOutside4Pct: dx.length ? round3(outside / dx.length) : null,
    grayAtLeast070: strong,
    strongOutside4: strongOutside,
    strongOutside4Pct: strong ? round3(strongOutside / strong) : null,
  };
}

function displaced(rows, fromRank) {
  const lists = {};
  for (const r of RADII) {
    if (r === 4) continue;
    const hits = [];
    for (const row of rows) {
      const a = row.radii?.[4];
      const b = row.radii?.[r];
      if (!a || !b) continue;
      const was = a.rank > 0 && a.rank <= fromRank;
      const now = b.rank > 0 && b.rank <= fromRank;
      if (was && !now) {
        hits.push({
          fixture: row.fixture,
          name: row.name,
          x: row.x,
          y: row.y,
          rank4: a.rank,
          rank: b.rank,
          displacedBy: b.top?.name || null,
        });
      }
    }
    lists[r] = hits;
  }
  return lists;
}

const hist = {};
for (const row of items) {
  const hit = row.radii?.[12];
  if (!hit || hit.gray == null || hit.gray < 0.7) continue;
  const key = `${hit.dx},${hit.dy}`;
  hist[key] = (hist[key] || 0) + 1;
}

const poor = [];
for (const row of items) {
  const hit = row.radii?.[12];
  if (!hit) {
    poor.push({ fixture: row.fixture, name: row.name, x: row.x, y: row.y, category: 'no-crop', gray: null, rank: 0 });
    continue;
  }
  if (hit.gray == null) {
    poor.push({ fixture: row.fixture, name: row.name, x: row.x, y: row.y, category: 'template-miss', gray: null, rank: 0 });
    continue;
  }
  if (hit.gray < 0.45) {
    poor.push({
      fixture: row.fixture,
      name: row.name,
      x: row.x,
      y: row.y,
      category: KNOWN_ASSET.has(row.name) ? 'known-asset-mismatch' : 'low-ncc',
      gray: hit.gray,
      rank: hit.rank,
      dx: hit.dx,
      dy: hit.dy,
    });
  }
}

const byFixture = {};
for (const name of FIXTURES) {
  byFixture[name] = recalls(items.filter((row) => row.fixture === name));
}

const report = {
  kind: 'bpb-p10-window',
  method: 'P3 thumbs NCC, gray 0.5 + Sobel edge 0.5, stride 2, 518 classes, oblong 4 faces, candidate anchor. Radius is the only change.',
  nOrdinary: items.length,
  elapsedMs,
  overall: recalls(items),
  perScreenshotTop5: Object.fromEntries(FIXTURES.map((name) => [name, Object.fromEntries(RADII.map((r) => [r, byFixture[name][r].top5]))])),
  cleanBright: recalls(items.filter((row) => CLEAN_BRIGHT.has(row.fixture))),
  previouslyFailing: recalls(items.filter((row) => FAILING.has(row.fixture))),
  real001: recalls(items.filter((row) => row.fixture === 'real-001')),
  shifts: Object.fromEntries(RADII.map((r) => [r, shifts(items, r)])),
  histogramGrayAtLeast070Within12: hist,
  displacedFromTop1: displaced(items, 1),
  displacedFromTop5: displaced(items, 5),
  poorAt12: {
    n: poor.length,
    knownAssetMismatch: poor.filter((row) => row.category === 'known-asset-mismatch').length,
    lowNcc: poor.filter((row) => row.category === 'low-ncc').length,
    templateMiss: poor.filter((row) => row.category === 'template-miss').length,
    noCrop: poor.filter((row) => row.category === 'no-crop').length,
    rows: poor,
  },
  items,
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report));
const brief = { ...report, items: undefined, displacedFromTop1: Object.fromEntries(Object.entries(report.displacedFromTop1).map(([k, v]) => [k, v.length])), displacedFromTop5: Object.fromEntries(Object.entries(report.displacedFromTop5).map(([k, v]) => [k, v.length])), poorAt12: { ...report.poorAt12, rows: undefined } };
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(brief, null, 2));
console.log(JSON.stringify(brief, null, 2));
console.log('wrote', OUT);
