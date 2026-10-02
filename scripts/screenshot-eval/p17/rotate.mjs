/**
 * P17 visual-rotation audit and benchmark. Eval only.
 * Same crops, ±8, 48px/cell, and NCC as P10. The only change is which faces are scored.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { knownScales, prepareTemplateGray } from '../../../js/shared/screenshot-ncc.js';
import { CELL_PX, STRIDE, boundsOf, bodyCells, isOblong, loadCatalog, repo } from '../p8/shared.mjs';

const P8 = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p8');
const OUT = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p17');
const RADIUS = 8;
const SYM = 0.97;

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

function pack(grayBuf) {
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

function nccBuf(a, b) {
  const n = Math.min(a.idx?.length || 0, b.idx?.length || 0);
  if (!a.gray || a.w !== b.w || a.h !== b.h) return 0;
  let as = 0;
  let bs = 0;
  let c = 0;
  for (let i = 0; i < a.gray.length; i++) {
    if (a.alpha[i] < 24 && b.alpha[i] < 24) continue;
    as += a.gray[i];
    bs += b.gray[i];
    c++;
  }
  if (c < 16) return 0;
  const am = as / c;
  const bm = bs / c;
  let num = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < a.gray.length; i++) {
    if (a.alpha[i] < 24 && b.alpha[i] < 24) continue;
    const da = a.gray[i] - am;
    const db = b.gray[i] - bm;
    num += da * db;
    va += da * da;
    vb += db * db;
  }
  if (va < 1e-3 || vb < 1e-3) return 0;
  return num / Math.sqrt(va * vb);
}

function bestIn(hay, hayW, hayH, needle, ox, oy) {
  const { w: tw, h: th, idx, tC, tNorm, tCount } = needle;
  if (tw < 8 || th < 8 || tw >= hayW || th >= hayH || tCount < 16 || tNorm < 1e-3) return { score: -1, dx: 0, dy: 0 };
  const rel = new Int32Array(idx.length);
  for (let k = 0; k < idx.length; k++) rel[k] = ((idx[k] / tw) | 0) * hayW + (idx[k] % tw);
  const maxX = hayW - tw;
  const maxY = hayH - th;
  const x0 = Math.max(0, Math.min(maxX, ox - RADIUS));
  const y0 = Math.max(0, Math.min(maxY, oy - RADIUS));
  const x1 = Math.max(x0, Math.min(maxX, ox + RADIUS));
  const y1 = Math.max(y0, Math.min(maxY, oy + RADIUS));
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
        dx = x - ox;
        dy = y - oy;
      }
    }
  }
  return { score: best, dx, dy };
}

const { classes, shapes, display } = loadCatalog();
const makeCanvas = (w, h) => createCanvas(w, h);
const drawImage = (source, ctx, x, y, w, h) => ctx.drawImage(source, x, y, w, h);

function footprintKind(cls) {
  const b = boundsOf(bodyCells(shapes, cls, 0));
  const w = b.x1 - b.x0 + 1;
  const h = b.y1 - b.y0 + 1;
  const kind = w === 1 && h === 1 ? '1x1' : (w === h ? 'square' : 'rect');
  return { w, h, kind };
}

console.log('loading faces');
const pool = [];
const needles = new Map();
const auditRows = [];
for (const c of classes) {
  const file = path.join(repo, 'assets/item-thumbs/2x', `${c.image}.webp`);
  if (!fs.existsSync(file)) continue;
  const img = await loadImage(file);
  const disp = display[`${c.image}.png`] || {};
  const scale = knownScales(CELL_PX, Number(disp.w) || 1, img.width)[2] || 1;
  const byFace = [];
  const raw = [];
  for (const r of [0, 1, 2, 3]) {
    const gray = prepareTemplateGray(img, r * 90, scale, makeCanvas, drawImage);
    raw[r] = gray;
    byFace[r] = { gray: pack(gray), edge: pack({ w: gray.w, h: gray.h, gray: sobel(gray.gray, gray.w, gray.h), alpha: gray.alpha }) };
  }
  const fp = footprintKind(c);
  const oblong = isOblong(shapes, c);
  const equiv = [0];
  for (const r of [1, 2, 3]) {
    const back = prepareTemplateGray(img, 0, scale, makeCanvas, drawImage);
    const turned = raw[r];
    const sim = back.w === turned.w && back.h === turned.h ? nccBuf(back, turned) : nccBuf(raw[0], turned);
    if (sim >= SYM) equiv.push(r);
  }
  const distinct = equiv.includes(1) ? 1 : (equiv.includes(2) ? 2 : 4);
  const tested = oblong ? 4 : 1;
  auditRows.push({
    name: c.name, image: c.image, footprint: `${fp.w}x${fp.h}`, kind: fp.kind,
    oblong, distinct, tested, short: tested < distinct, symmetric: distinct === 1,
  });
  pool.push({
    id: c.id, name: c.name, oblong, kind: fp.kind,
    anchorX: Number(disp.anchorX) || 0, anchorY: Number(disp.anchorY) || 0,
  });
  needles.set(c.id, byFace);
}

function tally(rows) {
  const bucket = (kind) => rows.filter((r) => r.kind === kind);
  const packBucket = (list) => ({
    n: list.length,
    symmetric: list.filter((r) => r.symmetric).length,
    asymmetric: list.filter((r) => !r.symmetric).length,
    testedShort: list.filter((r) => r.short).length,
  });
  return {
    classes: rows.length,
    testedShort: rows.filter((r) => r.short).length,
    symmetric: rows.filter((r) => r.symmetric).length,
    twoFold: rows.filter((r) => r.distinct === 2).length,
    fourFold: rows.filter((r) => r.distinct === 4).length,
    '1x1': packBucket(bucket('1x1')),
    square: packBucket(bucket('square')),
    rect: packBucket(bucket('rect')),
  };
}
const audit = tally(auditRows);
console.log(JSON.stringify(audit, null, 2));

function rgbOf(img) {
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  const g = new Float32Array(img.width * img.height);
  for (let p = 0, i = 0; p < g.length; p++, i += 4) g[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return { gray: g, edge: sobel(g, img.width, img.height), w: img.width, h: img.height };
}

function faceScore(hay, packed, cxr, cyr, anchorX, anchorY) {
  const gN = packed.gray;
  const eN = packed.edge;
  if (gN.w >= hay.w || gN.h >= hay.h) return null;
  const ox = Math.floor(cxr + anchorX * CELL_PX - gN.w / 2);
  const oy = Math.floor(cyr + anchorY * CELL_PX - gN.h / 2);
  const g = bestIn(hay.gray, hay.w, hay.h, gN, ox, oy);
  const e = bestIn(hay.edge, hay.w, hay.h, eN, ox, oy);
  return { score: 0.5 * g.score + 0.5 * e.score, gray: g.score, dx: g.dx, dy: g.dy };
}

const manifest = JSON.parse(fs.readFileSync(path.join(P8, 'manifest.json'), 'utf8'));
const items = [];
for (const fix of manifest.fixtures) {
  for (const inst of fix.instances || []) {
    if (inst.kind !== 'item' || !inst.match) continue;
    items.push({ ...inst, fixture: fix.fixture });
  }
}
console.log('items', items.length);
const t0 = Date.now();
let faceAll = 0;
let faceDedup = 0;
const scored = [];
for (const inst of items) {
  const hay = rgbOf(await loadImage(path.join(P8, inst.match)));
  const dedup = [];
  const all = [];
  for (const cand of pool) {
    const faces = cand.oblong ? [0, 1, 2, 3] : [0, 1, 2, 3];
    const packed = needles.get(cand.id);
    let bestAll = null;
    let bestDedup = null;
    for (const face of faces) {
      faceAll++;
      const hit = faceScore(hay, packed[face], inst.cxr, inst.cyr, cand.anchorX, cand.anchorY);
      if (!hit) continue;
      const row = { id: cand.id, name: cand.name, face, ...hit };
      if (!bestAll || row.score > bestAll.score) bestAll = row;
      const allowed = cand.oblong || face === 0;
      if (allowed) {
        faceDedup++;
        if (!bestDedup || row.score > bestDedup.score) bestDedup = row;
      }
    }
    if (bestAll) all.push(bestAll);
    if (bestDedup) dedup.push(bestDedup);
  }
  dedup.sort((a, b) => b.score - a.score);
  all.sort((a, b) => b.score - a.score);
  const dAt = dedup.findIndex((q) => q.id === inst.truthId);
  const aAt = all.findIndex((q) => q.id === inst.truthId);
  const cls = pool.find((c) => c.id === inst.truthId);
  scored.push({
    fixture: inst.fixture, name: inst.name, x: inst.x, y: inst.y, kind: cls?.kind || '?',
    dedupRank: dAt >= 0 ? dAt + 1 : 0,
    allRank: aAt >= 0 ? aAt + 1 : 0,
    dedupFace: dAt >= 0 ? dedup[dAt].face : null,
    allFace: aAt >= 0 ? all[aAt].face : null,
    dedupGray: dAt >= 0 ? Number(dedup[dAt].gray.toFixed(3)) : null,
    allGray: aAt >= 0 ? Number(all[aAt].gray.toFixed(3)) : null,
    dedupTop: dedup[0]?.name || null,
    allTop: all[0]?.name || null,
  });
  if (inst.fixture === 'real-010' && inst.name === 'Banana') {
    console.log('real-010 Banana', JSON.stringify(scored.at(-1)));
  }
}
const elapsed = Date.now() - t0;

function recalls(rows, pick) {
  const hit = (k) => rows.filter((row) => {
    const rank = pick(row);
    return rank > 0 && rank <= k;
  }).length;
  return { n: rows.length, top1: hit(1), top3: hit(3), top5: hit(5), top10: hit(10), top20: hit(20) };
}
function byShot(rows, pick) {
  const shots = [...new Set(rows.map((r) => r.fixture))];
  return Object.fromEntries(shots.map((shot) => [shot, recalls(rows.filter((r) => r.fixture === shot), pick)]));
}
const recovered = scored.filter((r) => r.dedupRank > 5 && r.allRank > 0 && r.allRank <= 5 && r.allFace !== 0 && !pool.find((c) => c.name === r.name && c.oblong));
const displaced = scored.filter((r) => r.dedupRank > 0 && r.dedupRank <= 5 && (r.allRank > 5 || r.allRank === 0));
const report = {
  kind: 'bpb-p17-visual-rotation',
  audit,
  deduped: recalls(scored, (r) => r.dedupRank),
  visual: recalls(scored, (r) => r.allRank),
  perShotDeduped: byShot(scored, (r) => r.dedupRank),
  perShotVisual: byShot(scored, (r) => r.allRank),
  byFootprint: {
    '1x1': { deduped: recalls(scored.filter((r) => r.kind === '1x1'), (r) => r.dedupRank), visual: recalls(scored.filter((r) => r.kind === '1x1'), (r) => r.allRank) },
    square: { deduped: recalls(scored.filter((r) => r.kind === 'square'), (r) => r.dedupRank), visual: recalls(scored.filter((r) => r.kind === 'square'), (r) => r.allRank) },
    rect: { deduped: recalls(scored.filter((r) => r.kind === 'rect'), (r) => r.dedupRank), visual: recalls(scored.filter((r) => r.kind === 'rect'), (r) => r.allRank) },
  },
  recoveredTop5: recovered.length,
  recovered: recovered.map((r) => ({ fixture: r.fixture, name: r.name, at: `${r.x},${r.y}`, from: r.dedupRank, to: r.allRank, face: r.allFace })),
  displacedTop5: displaced.length,
  displaced: displaced.map((r) => ({ fixture: r.fixture, name: r.name, at: `${r.x},${r.y}`, from: r.dedupRank, to: r.allRank })),
  runtimeMs: elapsed,
  faceEvals: { all: faceAll, dedupWouldBe: faceDedup, increase: Number((faceAll / Math.max(1, faceDedup)).toFixed(2)) },
  banana010: scored.filter((r) => r.fixture === 'real-010' && r.name === 'Banana'),
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'rotation.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify({ audit, examples: auditRows.filter((r) => r.short).slice(0, 30) }, null, 2));
console.log(JSON.stringify({ deduped: report.deduped, visual: report.visual, byFootprint: report.byFootprint, recoveredTop5: report.recoveredTop5, displacedTop5: report.displacedTop5, runtimeMs: elapsed, increase: report.faceEvals.increase, banana010: report.banana010 }, null, 2));
