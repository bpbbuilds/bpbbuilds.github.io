/**
 * P3 masked NCC (thumbs arm) on each P8 normalization.
 *   node scripts/screenshot-eval/p8/retrieve.mjs pine-protector
 *   P8_BENCH=1 node scripts/screenshot-eval/p8/retrieve.mjs pine-protector
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { knownScales, prepareTemplateGray } from '../../../js/shared/screenshot-ncc.js';
import { CELL_PX, FIXTURES, JITTER, STRIDE, isOblong, loadCatalog, outDir, repo } from './shared.mjs';
import { METHODS, applyPrep } from './normalize.mjs';

const bench = process.env.P8_BENCH === '1';
const want = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const fixtures = want.length ? want : FIXTURES;
const methodFilter = (process.env.P8_METHODS || '').split(',').filter(Boolean);
const methods = methodFilter.length ? METHODS.filter((m) => methodFilter.includes(m.id)) : METHODS;

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

function bestNccFast(hay, hayW, hayH, needle, stride, bounds) {
  const { w: tw, h: th, idx, tC, tNorm, tCount } = needle;
  if (tw < 6 || th < 6 || tw >= hayW || th >= hayH || tCount < 16 || tNorm < 1e-3) {
    return { score: -1, x: 0, y: 0 };
  }
  const rel = new Int32Array(idx.length);
  for (let k = 0; k < idx.length; k++) {
    const p = idx[k];
    rel[k] = ((p / tw) | 0) * hayW + (p % tw);
  }
  const maxX = hayW - tw;
  const maxY = hayH - th;
  const x0 = Math.max(0, Math.min(maxX, bounds?.x0 ?? 0));
  const y0 = Math.max(0, Math.min(maxY, bounds?.y0 ?? 0));
  const x1 = Math.max(x0, Math.min(maxX, bounds?.x1 ?? maxX));
  const y1 = Math.max(y0, Math.min(maxY, bounds?.y1 ?? maxY));
  const minCount = tCount * 0.7;
  let best = -1;
  let bestX = 0;
  let bestY = 0;
  for (let y = y0; y <= y1; y += stride) {
    for (let x = x0; x <= x1; x += stride) {
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
      if (score > best) {
        best = score;
        bestX = x;
        bestY = y;
      }
    }
  }
  return { score: best, x: bestX, y: bestY };
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
  const displayW = Number(disp.w) || 1;
  const scale = knownScales(CELL_PX, displayW, img.width)[2] || 1;
  const faces = [0, 1, 2, 3];
  const byFace = [];
  for (const r of faces) {
    const gray = prepareTemplateGray(img, r * 90, scale, makeCanvas, drawImage);
    const edge = packNeedle({ w: gray.w, h: gray.h, gray: sobel(gray.gray, gray.w, gray.h), alpha: gray.alpha });
    byFace[r] = { gray: packNeedle(gray), edge };
  }
  const id = pool.length;
  pool.push({
    id: c.id, name: c.name, image: c.image, pool: id,
    oblong: isOblong(shapes, c),
    anchorX: Number(disp.anchorX) || 0,
    anchorY: Number(disp.anchorY) || 0,
  });
  needles.set(c.id, byFace);
}
fs.mkdirSync(outDir, { recursive: true });
if (!fs.existsSync(path.join(outDir, 'pool.json'))) {
  fs.writeFileSync(path.join(outDir, 'pool.json'), JSON.stringify(pool.map((p) => ({ id: p.id, name: p.name, image: p.image, pool: p.pool }))));
}
console.log(`pool ${pool.length}`);

function rgbOf(file) {
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

function toGray(rgb, w, h) {
  const gray = new Float32Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 3) gray[p] = 0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2];
  return gray;
}

function rankOne(rgb, w, h, inst, method) {
  const prepped = applyPrep(method.prep, rgb, w, h);
  const gray = toGray(prepped, w, h);
  const edge = sobel(gray, w, h);
  const results = [];
  for (const cand of pool) {
    const faces = cand.oblong ? [0, 1, 2, 3] : [0];
    const ecx = inst.cxr + cand.anchorX * CELL_PX;
    const ecy = inst.cyr + cand.anchorY * CELL_PX;
    const packed = needles.get(cand.id);
    let best = null;
    for (const r of faces) {
      const gN = packed[r].gray;
      const eN = packed[r].edge;
      if (gN.w < 8 || gN.h < 8 || gN.w >= w || gN.h >= h) continue;
      const bx0 = Math.max(0, Math.floor(ecx - gN.w / 2) - JITTER);
      const by0 = Math.max(0, Math.floor(ecy - gN.h / 2) - JITTER);
      const bx1 = Math.min(w - gN.w, Math.floor(ecx - gN.w / 2) + JITTER);
      const by1 = Math.min(h - gN.h, Math.floor(ecy - gN.h / 2) + JITTER);
      const bounds = { x0: bx0, y0: by0, x1: Math.max(bx0, bx1), y1: Math.max(by0, by1) };
      const gHit = method.grayW > 0 ? bestNccFast(gray, w, h, gN, STRIDE, bounds) : { score: 0 };
      const eHit = method.edgeW > 0 ? bestNccFast(edge, w, h, eN, STRIDE, bounds) : { score: 0 };
      const score = method.grayW * gHit.score + method.edgeW * eHit.score;
      if (!best || score > best.score) best = { r, score, gray: gHit.score, edge: eHit.score };
    }
    if (best) results.push({ pool: cand.pool, id: cand.id, name: cand.name, ...best });
  }
  results.sort((a, b) => b.score - a.score);
  const at = results.findIndex((q) => q.id === inst.truthId);
  return {
    n: results.length,
    rank: at + 1,
    score: at >= 0 ? Math.round(results[at].score * 1000) / 1000 : null,
    gray: at >= 0 ? Math.round(results[at].gray * 1000) / 1000 : null,
    edge: at >= 0 ? Math.round(results[at].edge * 1000) / 1000 : null,
    face: at >= 0 ? results[at].r : null,
    top5: results.slice(0, 5).map((q) => ({ id: q.id, name: q.name, r: q.r, score: Math.round(q.score * 1000) / 1000 })),
    order: results.map((q) => q.pool),
  };
}

const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
fs.mkdirSync(path.join(outDir, 'scores'), { recursive: true });

for (const name of fixtures) {
  const fix = manifest.fixtures.find((f) => f.fixture === name);
  if (!fix?.gridOk) {
    console.log(`${name}: no grid`);
    continue;
  }
  const t0 = Date.now();
  const rows = [];
  let n = 0;
  for (const inst of fix.instances) {
    if (!inst.match || inst.missing) {
      rows.push({ i: inst.i, name: inst.name, x: inst.x, y: inst.y, r: inst.r, kind: inst.kind, missing: inst.missing || 'no-crop' });
      continue;
    }
    if (bench && n >= 1) break;
    const { rgb, w, h } = await rgbOf(path.join(outDir, inst.match));
    const methodsOut = {};
    const itemT = Date.now();
    for (const method of methods) {
      methodsOut[method.id] = rankOne(rgb, w, h, inst, method);
    }
    n++;
    const raw = methodsOut.raw || methodsOut[methods[0].id];
    console.log(`  ${name} ${inst.name} @${inst.x},${inst.y} raw#${raw.rank} ${((Date.now() - itemT) / 1000).toFixed(1)}s`);
    rows.push({
      i: inst.i, name: inst.name, x: inst.x, y: inst.y, r: inst.r, kind: inst.kind,
      truthId: inst.truthId, oblong: inst.oblong, area: inst.area, methods: methodsOut,
    });
  }
  const elapsedMs = Date.now() - t0;
  fs.writeFileSync(path.join(outDir, 'scores', `${name}.json`), JSON.stringify({ fixture: name, elapsedMs, pool: pool.length, rows }));
  console.log(`${name} done ${(elapsedMs / 1000).toFixed(1)}s`);
}
