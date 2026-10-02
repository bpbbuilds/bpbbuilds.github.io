/**
 * P16 visual bounds and occlusion-tolerant scoring. Eval only.
 * Does not change the importer, truth, or the live matcher.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { knownScales, prepareTemplateGray } from '../../../js/shared/screenshot-ncc.js';
import { CELL_PX, STRIDE, footprint, isOblong, loadCatalog, fixturePng, repo } from '../p8/shared.mjs';

const OUT = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p16');
const p13 = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p13/report.json'), 'utf8'));
const p14 = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p14/mapping.json'), 'utf8'));
const sockets = JSON.parse(fs.readFileSync(path.join(repo, 'assets/data/socket-offsets.json'), 'utf8')).byImage || {};
const { classes, shapes, display, byNorm } = loadCatalog();
const RADIUS = 8;
const KEEPS = [1, 0.85, 0.7, 0.55];

function mapOf(shot) {
  if (shot === 'real-008' && p14.maps[shot]) return p14.maps[shot];
  const g = p13.geometry[shot];
  const cols = Number(g.detected.split('x')[0]);
  const rows = Number(g.detected.split('x')[1]);
  return { originX: g.bag.x, originY: g.bag.y, cellW: g.bag.w / cols, cellH: g.bag.h / rows };
}

function spriteFile(image) {
  const opts = [
    path.join(repo, 'tools/game-extract-full/Items/Sprites', `${image}.png`),
    path.join(repo, 'tools/game-extract-full/Items/Exclusive/Sprites', `${image}.png`),
    path.join(repo, 'assets/item-thumbs/2x', `${image}.webp`),
  ];
  return opts.find((p) => fs.existsSync(p));
}

function rotPt(x, y, face) {
  let px = x;
  let py = y;
  for (let i = 0; i < ((face % 4) + 4) % 4; i++) {
    const nx = -py;
    py = px;
    px = nx;
  }
  return { x: px, y: py };
}

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

function blur3(buf, w, h) {
  const out = new Float32Array(buf.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          s += buf[yy * w + xx];
          n++;
        }
      }
      out[y * w + x] = s / n;
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
  return { w, h, gray, alpha, idx: index, tC, tNorm: Math.sqrt(varSum) };
}

function nccAt(hay, hayW, hayH, needle, x, y, keep = 1) {
  const s = [];
  const t = [];
  const bin = [];
  for (let k = 0; k < needle.idx.length; k++) {
    const p = needle.idx[k];
    const tx = p % needle.w;
    const ty = (p / needle.w) | 0;
    const hx = x + tx;
    const hy = y + ty;
    if (hx < 0 || hy < 0 || hx >= hayW || hy >= hayH) continue;
    s.push(hay[hy * hayW + hx]);
    t.push(needle.gray[p]);
    bin.push(((ty / 16) | 0) * 64 + ((tx / 16) | 0));
  }
  if (s.length < 16) return { score: -1, n: s.length };
  const scoreOf = (sel) => {
    let sm = 0;
    let tm = 0;
    for (const i of sel) {
      sm += s[i];
      tm += t[i];
    }
    sm /= sel.length;
    tm /= sel.length;
    let num = 0;
    let sv = 0;
    let tv = 0;
    for (const i of sel) {
      const ds = s[i] - sm;
      const dt = t[i] - tm;
      num += ds * dt;
      sv += ds * ds;
      tv += dt * dt;
    }
    if (sv < 1e-3 || tv < 1e-3) return -1;
    return num / Math.sqrt(sv * tv);
  };
  const all = s.map((_, i) => i);
  const full = scoreOf(all);
  if (keep >= 0.999) return { score: full, n: s.length };
  const sm0 = s.reduce((a, b) => a + b, 0) / s.length;
  const tm0 = t.reduce((a, b) => a + b, 0) / t.length;
  const order = all.slice().sort((i, j) => (s[i] - sm0) * (t[i] - tm0) - (s[j] - sm0) * (t[j] - tm0));
  const drop = Math.floor(s.length * (1 - keep));
  const trimmed = scoreOf(order.slice(drop));
  const groups = new Map();
  for (let i = 0; i < bin.length; i++) {
    if (!groups.has(bin[i])) groups.set(bin[i], []);
    groups.get(bin[i]).push(i);
  }
  const patches = [...groups.values()].filter((g) => g.length >= 8).map((g) => ({ g, score: scoreOf(g) }));
  patches.sort((a, b) => b.score - a.score);
  const useN = Math.max(1, Math.ceil(patches.length * keep));
  const kept = [];
  for (let i = 0; i < useN; i++) kept.push(...patches[i].g);
  return { score: trimmed, patch: kept.length >= 16 ? scoreOf(kept) : -1, n: s.length - drop };
}

function bestPose(hay, hayW, hayH, needle, ox, oy) {
  const { w: tw, h: th, idx, tC, tNorm } = needle;
  if (tw < 8 || th < 8 || tw >= hayW || th >= hayH || idx.length < 16 || tNorm < 1e-3) {
    return { score: -1, x: ox, y: oy, dx: 0, dy: 0 };
  }
  const rel = new Int32Array(idx.length);
  for (let k = 0; k < idx.length; k++) rel[k] = ((idx[k] / tw) | 0) * hayW + (idx[k] % tw);
  const maxX = hayW - tw;
  const maxY = hayH - th;
  const x0 = Math.max(0, Math.min(maxX, ox - RADIUS));
  const y0 = Math.max(0, Math.min(maxY, oy - RADIUS));
  const x1 = Math.max(x0, Math.min(maxX, ox + RADIUS));
  const y1 = Math.max(y0, Math.min(maxY, oy + RADIUS));
  let best = -1;
  let bx = ox;
  let by = oy;
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
        bx = x;
        by = y;
      }
    }
  }
  return { score: best, x: bx, y: by, dx: bx - ox, dy: by - oy };
}

const shots = new Map();
async function shotOf(name) {
  if (shots.has(name)) return shots.get(name);
  const img = await loadImage(fixturePng(name));
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const rec = { w: img.width, h: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data, map: mapOf(name) };
  shots.set(name, rec);
  return rec;
}

function resample(src, fullW, fullH, box, cellW, cellH) {
  const x0 = Math.max(0, Math.floor(box.x0));
  const y0 = Math.max(0, Math.floor(box.y0));
  const x1 = Math.min(fullW, Math.ceil(box.x1));
  const y1 = Math.min(fullH, Math.ceil(box.y1));
  const sx = cellW / CELL_PX;
  const sy = cellH / CELL_PX;
  const sw = Math.max(8, Math.floor((x1 - x0) / sx));
  const sh = Math.max(8, Math.floor((y1 - y0) / sy));
  const canvas = createCanvas(sw, sh);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(sw, sh);
  for (let y = 0; y < sh; y++) {
    const sy0 = Math.floor(y * sy);
    const sy1 = Math.min(y1 - y0, Math.max(sy0 + 1, Math.floor((y + 1) * sy)));
    for (let x = 0; x < sw; x++) {
      const sx0 = Math.floor(x * sx);
      const sx1 = Math.min(x1 - x0, Math.max(sx0 + 1, Math.floor((x + 1) * sx)));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let yy = sy0; yy < sy1; yy++) {
        const py = y0 + yy;
        if (py < 0 || py >= fullH) continue;
        for (let xx = sx0; xx < sx1; xx++) {
          const px = x0 + xx;
          if (px < 0 || px >= fullW) continue;
          const o = (py * fullW + px) * 4;
          r += src[o];
          g += src[o + 1];
          b += src[o + 2];
          n++;
        }
      }
      const d = (y * sw + x) * 4;
      img.data[d] = n ? r / n : 0;
      img.data[d + 1] = n ? g / n : 0;
      img.data[d + 2] = n ? b / n : 0;
      img.data[d + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const gray = new Float32Array(sw * sh);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = 0.299 * img.data[p] + 0.587 * img.data[p + 1] + 0.114 * img.data[p + 2];
  return { canvas, gray, edge: sobel(gray, sw, sh), w: sw, h: sh, x0, y0 };
}

const makeCanvas = (w, h) => createCanvas(w, h);
const drawImage = (source, ctx, x, y, w, h) => ctx.drawImage(source, x, y, w, h);
console.log('pool');
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
    byFace[r] = { gray: pack(gray), edge: pack({ w: gray.w, h: gray.h, gray: sobel(gray.gray, gray.w, gray.h), alpha: gray.alpha }), rgba: gray };
  }
  pool.push({
    id: c.id, name: c.name, image: c.image, oblong: isOblong(shapes, c),
    anchorX: Number(disp.anchorX) || 0, anchorY: Number(disp.anchorY) || 0,
  });
  needles.set(c.id, byFace);
}
console.log('pool', pool.length);

function punchSockets(needle, image, face) {
  const offs = sockets[`${image}.png`] || [];
  const alpha = new Uint8Array(needle.alpha);
  if (!offs.length) return pack({ w: needle.w, h: needle.h, gray: needle.gray, alpha });
  const r = 0.4 * CELL_PX;
  for (const off of offs) {
    const p = rotPt(off.x, off.y, face);
    const cx = needle.w / 2 + p.x * CELL_PX;
    const cy = needle.h / 2 + p.y * CELL_PX;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(needle.h - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(needle.w - 1, Math.ceil(cx + r)); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) alpha[y * needle.w + x] = 0;
      }
    }
  }
  return pack({ w: needle.w, h: needle.h, gray: needle.gray, alpha });
}

const CASES = [
  { id: 'banana-007', shot: 'real-007', name: 'Banana', x: 6, y: 0, r: 1, kind: 'diagnostic' },
  { id: 'doom-007', shot: 'real-007', name: 'Doom Cap', x: 4, y: 2, r: 0, kind: 'diagnostic' },
  { id: 'saber-007', shot: 'real-007', name: 'Darksaber', x: 0, y: 1, r: 2, kind: 'diagnostic' },
  { id: 'banana-008', shot: 'real-008', name: 'Banana', x: 6, y: 4, r: 0, kind: 'diagnostic' },
  { id: 'flute-008', shot: 'real-008', name: 'Flute', x: 5, y: 4, r: 3, kind: 'diagnostic' },
  { id: 'pine-008', shot: 'real-008', name: 'Pineapple', x: 8, y: 4, r: 0, kind: 'diagnostic' },
  { id: 'armor-008', shot: 'real-008', name: 'Holy Armor', x: 4, y: 0, r: 1, kind: 'diagnostic' },
  { id: 'banana-010', shot: 'real-010', name: 'Banana', x: 4, y: 3, r: 3, kind: 'control' },
  { id: 'star-010', shot: 'real-010', name: 'Star of Courage', x: 0, y: 5, r: 0, kind: 'control' },
  { id: 'falcon-pine', shot: 'pine-protector', name: 'Falcon Blade', x: 3, y: 1, r: 0, kind: 'control' },
  { id: 'potion-pine', shot: 'pine-protector', name: 'Strong Stone Skin Potion', x: 0, y: 0, r: 0, kind: 'control' },
];

function round3(n) {
  return n == null || !Number.isFinite(n) ? null : Math.round(n * 1000) / 1000;
}

async function prepareCase(spec) {
  const cls = byNorm.get(spec.name.replace(/[^A-Za-z0-9]/g, '').toLowerCase());
  const shot = await shotOf(spec.shot);
  const map = shot.map;
  const face = spec.r ?? 0;
  const fp = footprint(shapes, cls, { x: spec.x, y: spec.y, r: face });
  const play = {
    x0: map.originX + fp.x0 * map.cellW,
    y0: map.originY + fp.y0 * map.cellH,
    x1: map.originX + (fp.x1 + 1) * map.cellW,
    y1: map.originY + (fp.y1 + 1) * map.cellH,
  };
  const disp = display[`${cls.image}.png`] || {};
  const art = await loadImage(spriteFile(cls.image));
  const nominal = (map.cellW * (Number(disp.w) || 1)) / art.width;
  const painted = prepareTemplateGray(art, face * 90, nominal, makeCanvas, drawImage);
  const cx = (play.x0 + play.x1) / 2 + (Number(disp.anchorX) || 0) * map.cellW;
  const cy = (play.y0 + play.y1) / 2 + (Number(disp.anchorY) || 0) * map.cellH;
  const left = cx - painted.w / 2;
  const top = cy - painted.h / 2;
  let alphaN = 0;
  let outPlay = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < painted.alpha.length; i++) {
    if (painted.alpha[i] < 24) continue;
    alphaN++;
    const px = left + (i % painted.w);
    const py = top + ((i / painted.w) | 0);
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
    if (px < play.x0 || py < play.y0 || px >= play.x1 || py >= play.y1) outPlay++;
  }
  const recog = {
    x0: play.x0 - 1.5 * map.cellW,
    y0: play.y0 - 1.5 * map.cellH,
    x1: play.x1 + 1.5 * map.cellW,
    y1: play.y1 + 1.5 * map.cellH,
  };
  let inRecog = 0;
  for (let i = 0; i < painted.alpha.length; i++) {
    if (painted.alpha[i] < 24) continue;
    const px = left + (i % painted.w);
    const py = top + ((i / painted.w) | 0);
    if (px >= recog.x0 && py >= recog.y0 && px < recog.x1 && py < recog.y1) inRecog++;
  }
  const visual = {
    x0: Math.min(recog.x0, minX - 0.5 * map.cellW),
    y0: Math.min(recog.y0, minY - 0.5 * map.cellH),
    x1: Math.max(recog.x1, maxX + 0.5 * map.cellW),
    y1: Math.max(recog.y1, maxY + 0.5 * map.cellH),
  };
  const cellsW = fp.x1 - fp.x0 + 1;
  const cellsH = fp.y1 - fp.y0 + 1;
  const audit = {
    id: spec.id,
    kind: spec.kind,
    gameplayCells: `${cellsW}x${cellsH}`,
    spriteCells: `${(painted.w / map.cellW).toFixed(2)}x${(painted.h / map.cellH).toFixed(2)}`,
    outsidePx: outPlay,
    outsideCells: round3(outPlay / Math.max(1, map.cellW * map.cellH)),
    outsidePct: round3(outPlay / Math.max(1, alphaN)),
    inRecognitionPct: round3(inRecog / Math.max(1, alphaN)),
    visualWider: visual.x1 - visual.x0 > recog.x1 - recog.x0 + 1 || visual.y1 - visual.y0 > recog.y1 - recog.y0 + 1,
  };
  const existing = resample(shot.data, shot.w, shot.h, recog, map.cellW, map.cellH);
  const visualHay = resample(shot.data, shot.w, shot.h, visual, map.cellW, map.cellH);
  const center = (hay, box) => ({
    cxr: (cx - box.x0) / (map.cellW / CELL_PX),
    cyr: (cy - box.y0) / (map.cellH / CELL_PX),
    hay,
  });
  return { spec, cls, disp, audit, existing: center(existing, { x0: existing.x0, y0: existing.y0 }), visual: center(visualHay, { x0: visualHay.x0, y0: visualHay.y0 }) };
}

function scoreTruth(prepared, which, faceMode) {
  const view = prepared[which];
  const cand = pool.find((c) => c.id === prepared.cls.id);
  const faces = faceMode === 'truth' ? [prepared.spec.r ?? 0] : (cand.oblong ? [0, 1, 2, 3] : [0]);
  const packed = needles.get(prepared.cls.id);
  let best = null;
  for (const face of faces) {
    const gN = packed[face].gray;
    const eN = packed[face].edge;
    const ox = Math.floor(view.cxr + cand.anchorX * CELL_PX - gN.w / 2);
    const oy = Math.floor(view.cyr + cand.anchorY * CELL_PX - gN.h / 2);
    const g = bestPose(view.hay.gray, view.hay.w, view.hay.h, gN, ox, oy);
    const e = bestPose(view.hay.edge, view.hay.w, view.hay.h, eN, ox, oy);
    const row = { face, gray: g.score, edge: e.score, combined: 0.5 * g.score + 0.5 * e.score, dx: g.dx, dy: g.dy, gx: g.x, gy: g.y };
    if (!best || row.combined > best.combined) best = row;
  }
  const trims = {};
  if (best && best.gray >= 0) {
    const gN = packed[best.face].gray;
    const eN = packed[best.face].edge;
    const socketG = punchSockets(packed[best.face].rgba, prepared.cls.image, best.face);
    const socketE = pack({ w: socketG.w, h: socketG.h, gray: sobel(socketG.gray, socketG.w, socketG.h), alpha: socketG.alpha });
    for (const keep of KEEPS) {
      const g = nccAt(view.hay.gray, view.hay.w, view.hay.h, gN, best.gx, best.gy, keep);
      const e = nccAt(view.hay.edge, view.hay.w, view.hay.h, eN, best.gx, best.gy, keep);
      trims[String(keep)] = { gray: round3(g.score), edge: round3(e.score), patch: round3(g.patch), combined: round3(0.5 * g.score + 0.5 * e.score) };
    }
    const sg = nccAt(view.hay.gray, view.hay.w, view.hay.h, socketG, best.gx, best.gy, 1);
    const se = nccAt(view.hay.edge, view.hay.w, view.hay.h, socketE, best.gx, best.gy, 1);
    trims.socket = { gray: round3(sg.score), edge: round3(se.score), combined: round3(0.5 * sg.score + 0.5 * se.score), masked: socketG.idx.length < gN.idx.length };
    const blurred = blur3(view.hay.gray, view.hay.w, view.hay.h);
    const bg = bestPose(blurred, view.hay.w, view.hay.h, gN, Math.floor(view.cxr + cand.anchorX * CELL_PX - gN.w / 2), Math.floor(view.cyr + cand.anchorY * CELL_PX - gN.h / 2));
    trims.blur = { gray: round3(bg.score) };
  }
  return {
    face: best?.face ?? null,
    gray: round3(best?.gray),
    edge: round3(best?.edge),
    combined: round3(best?.combined),
    dx: best?.dx ?? null,
    dy: best?.dy ?? null,
    trims,
  };
}

function rankView(prepared, which, scoreOf) {
  const view = prepared[which];
  const rows = [];
  for (const cand of pool) {
    const faces = cand.oblong ? [0, 1, 2, 3] : [0];
    const packed = needles.get(cand.id);
    let best = null;
    for (const face of faces) {
      const gN = packed[face].gray;
      const eN = packed[face].edge;
      if (gN.w >= view.hay.w || gN.h >= view.hay.h) continue;
      const ox = Math.floor(view.cxr + cand.anchorX * CELL_PX - gN.w / 2);
      const oy = Math.floor(view.cyr + cand.anchorY * CELL_PX - gN.h / 2);
      const g = bestPose(view.hay.gray, view.hay.w, view.hay.h, gN, ox, oy);
      const e = bestPose(view.hay.edge, view.hay.w, view.hay.h, eN, ox, oy);
      const scored = scoreOf(cand, face, g, e, view);
      if (!best || scored.combined > best.combined) best = { name: cand.name, id: cand.id, ...scored };
    }
    if (best) rows.push(best);
  }
  rows.sort((a, b) => b.combined - a.combined);
  const at = rows.findIndex((q) => q.id === prepared.cls.id);
  return {
    rank: at >= 0 ? at + 1 : 0,
    gray: at >= 0 ? round3(rows[at].gray) : null,
    combined: at >= 0 ? round3(rows[at].combined) : null,
    top: rows[0]?.name || null,
  };
}

const prepared = [];
for (const spec of CASES) {
  const item = await prepareCase(spec);
  const existingMatcher = scoreTruth(item, 'existing', 'matcher');
  const visualMatcher = scoreTruth(item, 'visual', 'matcher');
  const existingTruth = scoreTruth(item, 'existing', 'truth');
  const visualTruth = scoreTruth(item, 'visual', 'truth');
  prepared.push({ item, existingMatcher, visualMatcher, existingTruth, visualTruth });
  console.log(spec.id, 'out', item.audit.outsidePct, 'inCrop', item.audit.inRecognitionPct, 'exist', existingMatcher.gray, 'visual', visualMatcher.gray, 'truthFace', visualTruth.gray);
}

const full = (cand, face, g, e) => ({ gray: g.score, combined: 0.5 * g.score + 0.5 * e.score });
const trim70 = (cand, face, g, e, view) => {
  const packed = needles.get(cand.id);
  const gg = nccAt(view.hay.gray, view.hay.w, view.hay.h, packed[face].gray, g.x, g.y, 0.7);
  const ee = nccAt(view.hay.edge, view.hay.w, view.hay.h, packed[face].edge, e.x, e.y, 0.7);
  return { gray: gg.score, combined: 0.5 * gg.score + 0.5 * ee.score };
};

const ranks = [];
for (const row of prepared) {
  const base = rankView(row.item, 'existing', full);
  const visual = rankView(row.item, 'visual', full);
  const trimmed = rankView(row.item, 'visual', trim70);
  ranks.push({ id: row.item.spec.id, kind: row.item.spec.kind, base, visual, trim70: trimmed });
  console.log('rank', row.item.spec.id, 'base', base.rank, base.top, 'visual', visual.rank, visual.top, 'trim70', trimmed.rank, trimmed.top);
}

const report = {
  kind: 'bpb-p16-visual-bounds',
  note: 'Matcher faces follow P10: four faces for oblong items, face 0 otherwise. truthFace is the labeled rotation, reported separately.',
  audit: prepared.map((row) => row.item.audit),
  scores: prepared.map((row) => ({
    id: row.item.spec.id,
    kind: row.item.spec.kind,
    existingMatcher: row.existingMatcher,
    visualMatcher: row.visualMatcher,
    existingTruthFace: row.existingTruth,
    visualTruthFace: row.visualTruth,
  })),
  ranks,
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log('wrote', OUT);
