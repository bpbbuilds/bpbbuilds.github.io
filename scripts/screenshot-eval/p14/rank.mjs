/**
 * P14 catalog retrieval on the corrected crops. Same scorer as P10 at ±8.
 * Eval only. Does not change the importer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { bestNcc, imageDataToGray, knownScales, prepareTemplateGray } from '../../../js/shared/screenshot-ncc.js';
import { CELL_PX, STRIDE, isOblong, loadCatalog, repo } from '../p8/shared.mjs';

const P8 = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p8');
const P10 = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p10/report.json');
const OUT = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p14');
const RADIUS = 8;
const TARGETS = ['real-003', 'real-008', 'leather-quad'];
const UNCHANGED = ['pine-protector', 'real-001', 'real-010', 'real-007', 'real-013'];

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

function bestIn(hay, hayW, hayH, needle, originX, originY) {
  const { w: tw, h: th, idx, tC, tNorm, tCount } = needle;
  if (tw < 8 || th < 8 || tw >= hayW || th >= hayH || tCount < 16 || tNorm < 1e-3) {
    return { score: -1, dx: 0, dy: 0 };
  }
  const rel = new Int32Array(idx.length);
  for (let k = 0; k < idx.length; k++) {
    const p = idx[k];
    rel[k] = ((p / tw) | 0) * hayW + (p % tw);
  }
  const maxX = hayW - tw;
  const maxY = hayH - th;
  const x0 = Math.max(0, Math.min(maxX, originX - RADIUS));
  const y0 = Math.max(0, Math.min(maxY, originY - RADIUS));
  const x1 = Math.max(x0, Math.min(maxX, originX + RADIUS));
  const y1 = Math.max(y0, Math.min(maxY, originY + RADIUS));
  let best = -1;
  let dx = 0;
  let dy = 0;
  for (let y = y0; y <= y1; y += STRIDE) {
    for (let x = x0; x <= x1; x += STRIDE) {
      const base = y * hayW + x;
      let sSum = 0;
      for (let k = 0; k < rel.length; k++) sSum += hay[base + rel[k]];
      const sMean = sSum / rel.length;
      let num = 0;
      let sVar = 0;
      for (let k = 0; k < rel.length; k++) {
        const sv = hay[base + rel[k]] - sMean;
        num += sv * tC[k];
        sVar += sv * sv;
      }
      if (sVar < 1e-3) continue;
      const score = num / (Math.sqrt(sVar) * tNorm);
      if (score > best) {
        best = score;
        dx = x - originX;
        dy = y - originY;
      }
    }
  }
  return { score: best, dx, dy };
}

const { classes, shapes, display } = loadCatalog();
const makeCanvas = (w, h) => createCanvas(w, h);
const drawImage = (source, ctx, x, y, w, h) => ctx.drawImage(source, x, y, w, h);
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
    id: c.id, name: c.name, oblong: isOblong(shapes, c),
    anchorX: Number(disp.anchorX) || 0, anchorY: Number(disp.anchorY) || 0,
  });
  needles.set(c.id, byFace);
}
console.log('pool', pool.length);

function rankOne(hay, inst) {
  const rows = [];
  for (const cand of pool) {
    const faces = cand.oblong ? [0, 1, 2, 3] : [0];
    const ecx = inst.cxr + cand.anchorX * CELL_PX;
    const ecy = inst.cyr + cand.anchorY * CELL_PX;
    const packed = needles.get(cand.id);
    let best = null;
    for (const face of faces) {
      const gN = packed[face].gray;
      const eN = packed[face].edge;
      if (gN.w < 8 || gN.h < 8 || gN.w >= hay.w || gN.h >= hay.h) continue;
      const ox = Math.floor(ecx - gN.w / 2);
      const oy = Math.floor(ecy - gN.h / 2);
      const g = bestIn(hay.gray, hay.w, hay.h, gN, ox, oy);
      const e = bestIn(hay.edge, hay.w, hay.h, eN, ox, oy);
      const score = 0.5 * g.score + 0.5 * e.score;
      if (!best || score > best.score) best = { face, score, gray: g.score, dx: g.dx, dy: g.dy };
    }
    if (best) rows.push({ id: cand.id, name: cand.name, ...best });
  }
  rows.sort((a, b) => b.score - a.score);
  const at = rows.findIndex((q) => q.id === inst.truthId);
  const truth = at >= 0 ? rows[at] : null;
  return {
    rank: at >= 0 ? at + 1 : 0,
    score: truth ? Number(truth.score.toFixed(3)) : null,
    gray: truth ? Number(truth.gray.toFixed(3)) : null,
    dx: truth ? truth.dx : null,
    dy: truth ? truth.dy : null,
    face: truth ? truth.face : null,
    top: rows[0] ? rows[0].name : null,
  };
}

async function rgbOf(file) {
  const img = await loadImage(file);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  const g = new Float32Array(img.width * img.height);
  for (let p = 0, i = 0; p < g.length; p++, i += 4) g[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return { gray: g, edge: sobel(g, img.width, img.height), w: img.width, h: img.height };
}

const mapping = JSON.parse(fs.readFileSync(path.join(OUT, 'mapping.json'), 'utf8'));
const p10 = JSON.parse(fs.readFileSync(P10, 'utf8'));
const corrected = [];
for (const inst of mapping.crops) {
  const hay = await rgbOf(path.join(OUT, inst.match));
  const hit = rankOne(hay, inst);
  corrected.push({ ...inst, b: undefined, hit });
  console.log(`${inst.fixture} ${inst.name} @${inst.x},${inst.y} #${hit.rank} gray ${hit.gray} top ${hit.top}`);
}

function recalls(rows, pick) {
  const hit = (k) => rows.filter((row) => {
    const rank = pick(row);
    return rank > 0 && rank <= k;
  }).length;
  return { n: rows.length, top1: hit(1), top3: hit(3), top5: hit(5), top10: hit(10), top20: hit(20) };
}

function dist(vals) {
  const s = vals.filter((v) => v != null && v >= 0).sort((a, b) => a - b);
  const mid = s.length ? s[Math.floor(s.length / 2)] : null;
  return {
    n: s.length,
    median: mid,
    ge045: s.filter((v) => v >= 0.45).length,
    ge060: s.filter((v) => v >= 0.6).length,
    ge070: s.filter((v) => v >= 0.7).length,
  };
}

const before = {};
const after = {};
for (const shot of TARGETS) {
  const oldRows = p10.items.filter((it) => it.fixture === shot);
  const newRows = corrected.filter((it) => it.fixture === shot);
  before[shot] = recalls(oldRows, (row) => row.radii?.[8]?.rank || 0);
  after[shot] = recalls(newRows, (row) => row.hit.rank);
  before[shot].gray = dist(oldRows.map((row) => row.radii?.[8]?.gray));
  after[shot].gray = dist(newRows.map((row) => row.hit.gray));
  before[shot].combined = dist(oldRows.map((row) => row.radii?.[8]?.score));
  after[shot].combined = dist(newRows.map((row) => row.hit.score));
}

const unchanged = {};
for (const shot of UNCHANGED) {
  const rows = p10.items.filter((it) => it.fixture === shot);
  unchanged[shot] = recalls(rows, (row) => row.radii?.[8]?.rank || 0);
}
const globalRows = [
  ...UNCHANGED.flatMap((shot) => p10.items.filter((it) => it.fixture === shot).map((row) => row.radii?.[8]?.rank || 0)),
  ...corrected.map((row) => row.hit.rank),
];
const global = recalls(globalRows.map((rank) => ({ rank })), (row) => row.rank);
const originalGlobal = recalls(p10.items, (row) => row.radii?.[8]?.rank || 0);

const transfers = [
  ['Star of Courage', 'real-010', 0, 5, 'real-008', 7, 2],
  ['Banana', 'real-010', 4, 3, 'real-008', 6, 4],
  ['Prismatic Orb', 'real-001', 5, 1, 'real-008', 2, 1],
  ['Piggybank', 'real-010', 1, 5, 'leather-quad', 2, 0],
  ['Amulet of Steel', 'real-001', 1, 0, 'real-003', 6, 5],
];
const p8manifest = JSON.parse(fs.readFileSync(path.join(P8, 'manifest.json'), 'utf8'));
const transferRows = [];
for (const [name, srcShot, sx, sy, dstShot, dx, dy] of transfers) {
  const src = p8manifest.fixtures.find((f) => f.fixture === srcShot).instances.find((it) => it.name === name && it.x === sx && it.y === sy);
  const dst = mapping.crops.find((it) => it.fixture === dstShot && it.name === name && it.x === dx && it.y === dy);
  const disp = display[`${src.image}.png`];
  const sprite = await loadImage(path.join(repo, 'assets/item-thumbs/2x', `${src.image}.webp`));
  const srcHay = await rgbOf(path.join(P8, src.match));
  const scale = knownScales(CELL_PX, Number(disp.w) || 1, sprite.width)[2] || 1;
  const mask = prepareTemplateGray(sprite, (src.r || 0) * 90, scale, makeCanvas, drawImage);
  const ecx = src.cxr + (Number(disp.anchorX) || 0) * CELL_PX;
  const ecy = src.cyr + (Number(disp.anchorY) || 0) * CELL_PX;
  const placed = bestNcc({ w: srcHay.w, h: srcHay.h, gray: srcHay.gray }, mask, 2, {
    x0: Math.floor(ecx - mask.w / 2) - 12, x1: Math.floor(ecx - mask.w / 2) + 12,
    y0: Math.floor(ecy - mask.h / 2) - 12, y1: Math.floor(ecy - mask.h / 2) + 12,
  });
  const live = { w: mask.w, h: mask.h, gray: new Float32Array(mask.w * mask.h), alpha: new Uint8Array(mask.w * mask.h) };
  for (let i = 0; i < mask.alpha.length; i++) {
    if (mask.alpha[i] < 24) continue;
    const hx = placed.x + (i % mask.w);
    const hy = placed.y + ((i / mask.w) | 0);
    if (hx < 0 || hy < 0 || hx >= srcHay.w || hy >= srcHay.h) continue;
    live.alpha[i] = 255;
    live.gray[i] = srcHay.gray[hy * srcHay.w + hx];
  }
  const dstHay = await rgbOf(path.join(OUT, dst.match));
  const turns = (((dst.r || 0) - (src.r || 0)) % 4 + 4) % 4;
  let cur = live;
  for (let t = 0; t < turns; t++) {
    const nw = cur.h;
    const nh = cur.w;
    const ng = new Float32Array(nw * nh);
    const na = new Uint8Array(nw * nh);
    for (let y = 0; y < cur.h; y++) {
      for (let x = 0; x < cur.w; x++) {
        const di = x * nw + (cur.h - 1 - y);
        const si = y * cur.w + x;
        ng[di] = cur.gray[si];
        na[di] = cur.alpha[si];
      }
    }
    cur = { w: nw, h: nh, gray: ng, alpha: na };
  }
  const dcx = dst.cxr;
  const dcy = dst.cyr;
  const hit = bestNcc({ w: dstHay.w, h: dstHay.h, gray: dstHay.gray }, cur, 2, {
    x0: Math.floor(dcx - cur.w / 2) - 12, x1: Math.floor(dcx - cur.w / 2) + 12,
    y0: Math.floor(dcy - cur.h / 2) - 12, y1: Math.floor(dcy - cur.h / 2) + 12,
  });
  transferRows.push({
    item: name, from: srcShot, to: dstShot, at: `${dx},${dy}`,
    catalogOnWorking: Number(placed.score.toFixed(3)),
    correctedTransfer: Number(hit.score.toFixed(3)),
  });
  console.log(`xfer ${name} ${srcShot}->${dstShot} ${hit.score.toFixed(3)}`);
}

const report = {
  kind: 'bpb-p14-corrected-registration',
  before, after, unchanged, global, originalGlobal, transferRows,
  items: corrected.map((row) => ({ fixture: row.fixture, name: row.name, x: row.x, y: row.y, cover: row.cover, clipped: row.clipped, hit: row.hit })),
};
fs.writeFileSync(path.join(OUT, 'retrieval.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ before, after, global, originalGlobal }, null, 2));
