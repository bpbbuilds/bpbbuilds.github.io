/**
 * P18 visual-anchor audit. Eval only.
 * Correct class, all four visual faces, full recognition crop.
 * Does not change the live importer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { knownScales, prepareTemplateGray } from '../../../js/shared/screenshot-ncc.js';
import { CELL_PX, STRIDE, bodyCells, boundsOf, loadCatalog, repo } from '../p8/shared.mjs';

const P8 = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p8');
const OUT = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p18');
const TRUST = new Set(['real-001', 'real-007', 'real-010', 'pine-protector']);
const TAG = {
  'real-003': 'mislocalized',
  'real-008': 'mislocalized',
  'leather-quad': 'mislocalized',
  'real-013': 'lowres',
};

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

/** Clockwise 90° steps in y-down, matching canvas rotate and bodyCells. */
function spinAnchor(ax, ay, face) {
  let x = ax;
  let y = ay;
  for (let i = 0; i < ((Number(face) || 0) % 4 + 4) % 4; i++) {
    const nx = -y;
    y = x;
    x = nx;
  }
  return { x, y };
}

function scan(hay, hayW, hayH, needle, flat, spun) {
  const { w: tw, h: th, idx, tC, tNorm, tCount } = needle;
  const empty = { score: -1, dx: 0, dy: 0 };
  if (tw < 8 || th < 8 || tw >= hayW || th >= hayH || tCount < 16 || tNorm < 1e-3) {
    return { global: empty, pm8: empty, pm40: empty, spun8: empty };
  }
  const rel = new Int32Array(idx.length);
  for (let k = 0; k < idx.length; k++) rel[k] = ((idx[k] / tw) | 0) * hayW + (idx[k] % tw);
  const maxX = hayW - tw;
  const maxY = hayH - th;
  const boxes = {
    global: { score: -1, dx: 0, dy: 0 },
    pm8: { score: -1, dx: 0, dy: 0 },
    pm40: { score: -1, dx: 0, dy: 0 },
    spun8: { score: -1, dx: 0, dy: 0 },
  };
  const consider = (box, score, dx, dy) => {
    if (score > box.score) {
      box.score = score;
      box.dx = dx;
      box.dy = dy;
    }
  };
  for (let y = 0; y <= maxY; y += STRIDE) {
    for (let x = 0; x <= maxX; x += STRIDE) {
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
      const dx = x - flat.ox;
      const dy = y - flat.oy;
      consider(boxes.global, score, dx, dy);
      if (Math.abs(dx) <= 8 && Math.abs(dy) <= 8) consider(boxes.pm8, score, dx, dy);
      if (Math.abs(dx) <= 40 && Math.abs(dy) <= 40) consider(boxes.pm40, score, dx, dy);
      const sx = x - spun.ox;
      const sy = y - spun.oy;
      if (Math.abs(sx) <= 8 && Math.abs(sy) <= 8) consider(boxes.spun8, score, sx, sy);
    }
  }
  return boxes;
}

function rgbOf(img) {
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  const g = new Float32Array(img.width * img.height);
  for (let p = 0, i = 0; p < g.length; p++, i += 4) g[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  return { gray: g, edge: sobel(g, img.width, img.height), w: img.width, h: img.height };
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function mean(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

const { classes, shapes, display } = loadCatalog();
const byId = new Map(classes.map((c) => [c.id, c]));
const makeCanvas = (w, h) => createCanvas(w, h);
const drawImage = (source, ctx, x, y, w, h) => ctx.drawImage(source, x, y, w, h);

console.log('templates');
const faces = new Map();
for (const c of classes) {
  const file = path.join(repo, 'assets/item-thumbs/2x', `${c.image}.webp`);
  if (!fs.existsSync(file)) continue;
  const img = await loadImage(file);
  const disp = display[`${c.image}.png`] || {};
  const scale = knownScales(CELL_PX, Number(disp.w) || 1, img.width)[2] || 1;
  const packed = [];
  for (const r of [0, 1, 2, 3]) packed[r] = pack(prepareTemplateGray(img, r * 90, scale, makeCanvas, drawImage));
  const b = boundsOf(bodyCells(shapes, c, 0));
  const w = b.x1 - b.x0 + 1;
  const h = b.y1 - b.y0 + 1;
  faces.set(c.id, {
    packed,
    anchorX: Number(disp.anchorX) || 0,
    anchorY: Number(disp.anchorY) || 0,
    displayW: Number(disp.w) || 1,
    displayH: Number(disp.h) || 1,
    kind: w === 1 && h === 1 ? '1x1' : (w === h ? 'square' : 'rect'),
    foot: `${w}x${h}`,
  });
}

const manifest = JSON.parse(fs.readFileSync(path.join(P8, 'manifest.json'), 'utf8'));
const items = [];
for (const fix of manifest.fixtures) {
  for (const inst of fix.instances || []) {
    if (inst.kind !== 'item' || !inst.match) continue;
    items.push({ ...inst, fixture: fix.fixture });
  }
}

const formulas = {
  cellPx: CELL_PX,
  gameCellPx: 80,
  footprintCenter: 'cxr = ((bbox.x0 + bbox.x1 + 1) / 2 * cellW - cropLeft) / (cellW / 48)',
  bbox: 'body cells (shape value 1) rotated (x,y)->(-y,x) per face, then shifted so min cell is (0,0). Truth (x,y) is that normalized top-left.',
  matcherCenter: 'sprite center = (cxr, cyr) + (anchorX, anchorY) * 48. Anchor is not rotated. Template is rotated about its own image center, then its top-left is center - size/2.',
  gameCenter: 'drawSpriteFace translates to the rotated AABB center, rotates by face*90°, then draws at (-w/2 + anchorX*cell, -h/2 + anchorY*cell). The anchor rotates with the sprite.',
  spunAnchor: 'face 0 (ax,ay); face 1 (-ay, ax); face 2 (-ax, -ay); face 3 (ay, -ax).',
  bananaScene: 'Banana.tscn Icon.position = CollisionMap.position = (17, -19). anchorX = anchorY = 0. Rotating the anchor does not move Banana.',
};

console.log('search', items.length);
const t0 = Date.now();
const rows = [];
for (const inst of items) {
  const meta = faces.get(inst.truthId);
  const cls = byId.get(inst.truthId);
  if (!meta || !cls) continue;
  const hay = rgbOf(await loadImage(path.join(P8, inst.match)));
  const tag = TAG[inst.fixture] || (/wooden sword|shortbow/i.test(inst.name) ? 'alt-art' : null);
  const faceRows = [];
  for (const face of [0, 1, 2, 3]) {
    const needle = meta.packed[face];
    const spun = spinAnchor(meta.anchorX, meta.anchorY, face);
    const flat = {
      ox: Math.floor(inst.cxr + meta.anchorX * CELL_PX - needle.w / 2),
      oy: Math.floor(inst.cyr + meta.anchorY * CELL_PX - needle.h / 2),
    };
    const spunOrigin = {
      ox: Math.floor(inst.cxr + spun.x * CELL_PX - needle.w / 2),
      oy: Math.floor(inst.cyr + spun.y * CELL_PX - needle.h / 2),
    };
    const hit = scan(hay.gray, hay.w, hay.h, needle, flat, spunOrigin);
    faceRows.push({
      face,
      gray: round3(hit.global.score),
      dx: hit.global.dx,
      dy: hit.global.dy,
      pm8: round3(hit.pm8.score),
      pm40: round3(hit.pm40.score),
      spun8: round3(hit.spun8.score),
      spunDx: spun.x * CELL_PX - meta.anchorX * CELL_PX,
      spunDy: spun.y * CELL_PX - meta.anchorY * CELL_PX,
    });
  }
  faceRows.sort((a, b) => b.gray - a.gray);
  const best = faceRows[0];
  const labeled = inst.r == null ? null : ((Number(inst.r) % 4) + 4) % 4;
  const labeledRow = labeled == null ? null : faceRows.find((f) => f.face === labeled);
  const cells = bodyCells(shapes, cls, labeled || 0);
  const box = boundsOf(cells);
  rows.push({
    fixture: inst.fixture,
    name: inst.name,
    x: inst.x,
    y: inst.y,
    labeledFace: labeled,
    kind: meta.kind,
    foot: meta.foot,
    anchorX: meta.anchorX,
    anchorY: meta.anchorY,
    displayW: meta.displayW,
    displayH: meta.displayH,
    tag,
    trusted: TRUST.has(inst.fixture) && !tag,
    cells: cells.map((p) => [p.x, p.y]),
    bbox: [box.x0, box.y0, box.x1 - box.x0 + 1, box.y1 - box.y0 + 1],
    bestFace: best.face,
    gray: best.gray,
    dx: best.dx,
    dy: best.dy,
    dxCells: round3(best.dx / CELL_PX),
    dyCells: round3(best.dy / CELL_PX),
    inside8: Math.abs(best.dx) <= 8 && Math.abs(best.dy) <= 8,
    inside40: Math.abs(best.dx) <= 40 && Math.abs(best.dy) <= 40,
    pm8: Math.max(...faceRows.map((f) => f.pm8)),
    pm40: Math.max(...faceRows.map((f) => f.pm40)),
    spun8: Math.max(...faceRows.map((f) => f.spun8)),
    labeledGray: labeledRow ? labeledRow.gray : null,
    labeledDx: labeledRow ? labeledRow.dx : null,
    labeledDy: labeledRow ? labeledRow.dy : null,
    faces: faceRows.map((f) => ({ face: f.face, gray: f.gray, dx: f.dx, dy: f.dy, pm8: f.pm8 })),
  });
  if (inst.name === 'Banana') console.log(inst.fixture, inst.x, inst.y, 'face', best.face, 'gray', best.gray, 'd', best.dx, best.dy);
}
const elapsed = Date.now() - t0;

function ceiling(list) {
  const strong = (key, t) => list.filter((r) => r[key] >= t).length;
  return {
    n: list.length,
    pm8: { g45: strong('pm8', 0.45), g60: strong('pm8', 0.6), g70: strong('pm8', 0.7), g80: strong('pm8', 0.8) },
    pm40: { g45: strong('pm40', 0.45), g60: strong('pm40', 0.6), g70: strong('pm40', 0.7), g80: strong('pm40', 0.8) },
    crop: { g45: strong('gray', 0.45), g60: strong('gray', 0.6), g70: strong('gray', 0.7), g80: strong('gray', 0.8) },
    spun8: { g45: strong('spun8', 0.45), g60: strong('spun8', 0.6), g70: strong('spun8', 0.7), g80: strong('spun8', 0.8) },
  };
}

function cluster(list, keyFn) {
  const groups = new Map();
  for (const row of list) {
    const key = keyFn(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const out = {};
  for (const [key, group] of groups) {
    out[key] = {
      n: group.length,
      meanDx: round3(mean(group.map((r) => r.dx))),
      meanDy: round3(mean(group.map((r) => r.dy))),
      medDx: round3(median(group.map((r) => r.dx))),
      medDy: round3(median(group.map((r) => r.dy))),
    };
  }
  return out;
}

const trusted = rows.filter((r) => r.trusted);
const convincing = trusted.filter((r) => r.gray >= 0.6);
const anchored = convincing.filter((r) => Math.abs(r.anchorX) > 0.05 || Math.abs(r.anchorY) > 0.05);
const zeroAnchor = convincing.filter((r) => Math.abs(r.anchorX) <= 0.05 && Math.abs(r.anchorY) <= 0.05);

const report = {
  kind: 'bpb-p18-anchor',
  formulas,
  runtimeMs: elapsed,
  items: rows.length,
  trusted: trusted.length,
  ceilingTrusted: ceiling(trusted),
  ceilingAll: ceiling(rows),
  offsetsConvincing: {
    n: convincing.length,
    byFixture: cluster(convincing, (r) => r.fixture),
    byFace: cluster(convincing, (r) => String(r.bestFace)),
    byKind: cluster(convincing, (r) => r.kind),
    byFoot: cluster(convincing, (r) => r.foot),
    zeroAnchor: cluster(zeroAnchor, () => 'zero'),
    nonzeroAnchor: cluster(anchored, () => 'nonzero'),
  },
  bananas: rows.filter((r) => r.name === 'Banana').map((r) => ({
    fixture: r.fixture, x: r.x, y: r.y, tag: r.tag, labeledFace: r.labeledFace,
    cells: r.cells, bbox: r.bbox, anchorX: r.anchorX, anchorY: r.anchorY,
    bestFace: r.bestFace, gray: r.gray, dx: r.dx, dy: r.dy, dxCells: r.dxCells, dyCells: r.dyCells,
    inside8: r.inside8, pm8: r.pm8, spun8: r.spun8, labeledGray: r.labeledGray,
    labeledDx: r.labeledDx, labeledDy: r.labeledDy, faces: r.faces,
  })),
  gainedOutside8: trusted.filter((r) => r.pm8 < 0.6 && r.gray >= 0.6).map((r) => ({
    fixture: r.fixture, name: r.name, at: `${r.x},${r.y}`, face: r.bestFace,
    pm8: r.pm8, gray: r.gray, dx: r.dx, dy: r.dy, kind: r.kind, anchorX: r.anchorX, anchorY: r.anchorY,
  })),
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'anchor.json'), JSON.stringify(report));
fs.writeFileSync(path.join(OUT, 'rows.json'), JSON.stringify(rows));
console.log(JSON.stringify({
  runtimeMs: elapsed,
  trusted: trusted.length,
  ceilingTrusted: report.ceilingTrusted,
  convincing: convincing.length,
  anchored: anchored.length,
  byFixture: report.offsetsConvincing.byFixture,
  byFace: report.offsetsConvincing.byFace,
  byKind: report.offsetsConvincing.byKind,
  gained: report.gainedOutside8.length,
}, null, 2));
