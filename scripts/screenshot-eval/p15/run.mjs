/**
 * P15 native-resolution forensic sheets. Eval only.
 * Does not change the importer, truth, or the matcher.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { bestNcc, imageDataToGray } from '../../../js/shared/screenshot-ncc.js';
import { fixturePng, footprint, loadCatalog, repo } from '../p8/shared.mjs';

const OUT = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p15');
const p13 = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p13/report.json'), 'utf8'));
const p14 = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p14/mapping.json'), 'utf8'));
const { shapes, display, byNorm } = loadCatalog();
const draw = (img, ctx, x, y, w, h) => ctx.drawImage(img, x, y, w, h);

function mapOf(shot) {
  if (p14.maps[shot]) return p14.maps[shot];
  const g = p13.geometry[shot];
  const cols = Number(g.detected.split('x')[0]);
  const rows = Number(g.detected.split('x')[1]);
  return { originX: g.bag.x, originY: g.bag.y, cellW: g.bag.w / cols, cellH: g.bag.h / rows, kind: 'detected' };
}

function spriteFile(image) {
  const opts = [
    path.join(repo, 'tools/game-extract-full/Items/Sprites', `${image}.png`),
    path.join(repo, 'tools/game-extract-full/Items/Exclusive/Sprites', `${image}.png`),
    path.join(repo, 'assets/item-sprites', `${image}.png`),
    path.join(repo, 'assets/item-thumbs/2x', `${image}.webp`),
  ];
  return opts.find((p) => fs.existsSync(p)) || null;
}

function cutNative(src, fullW, fullH, box) {
  const x0 = Math.max(0, Math.floor(box.x0));
  const y0 = Math.max(0, Math.floor(box.y0));
  const x1 = Math.min(fullW, Math.ceil(box.x1));
  const y1 = Math.min(fullH, Math.ceil(box.y1));
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = ((y0 + y) * fullW + (x0 + x)) * 4;
      const d = (y * w + x) * 4;
      img.data[d] = src[o];
      img.data[d + 1] = src[o + 1];
      img.data[d + 2] = src[o + 2];
      img.data[d + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function rgbaOf(canvas) {
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return data;
}

function paintSprite(img, rotDeg, scale) {
  const sw = Math.max(1, Math.round(img.width * scale));
  const sh = Math.max(1, Math.round(img.height * scale));
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const bw = Math.max(1, Math.round(sw * cos + sh * sin));
  const bh = Math.max(1, Math.round(sw * sin + sh * cos));
  const canvas = createCanvas(bw, bh);
  const ctx = canvas.getContext('2d');
  ctx.translate(bw / 2, bh / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
  return canvas;
}

function grayBufFrom(canvas) {
  const data = rgbaOf(canvas);
  return imageDataToGray({ width: canvas.width, height: canvas.height, data: data.data });
}

function align(hayCanvas, sprite, nominal, faces) {
  const hay = grayBufFrom(hayCanvas);
  const scales = [];
  for (let m = 0.55; m <= 1.75; m += 0.1) scales.push(nominal * m);
  let best = null;
  for (const face of faces) {
    for (const scale of scales) {
      const painted = paintSprite(sprite, face * 90, scale);
      if (painted.width >= hay.w || painted.height >= hay.h || painted.width < 8) continue;
      const needle = grayBufFrom(painted);
      const hit = bestNcc(hay, needle, 2);
      if (hit.score < 0) continue;
      if (!best || hit.score > best.score) {
        best = { score: hit.score, x: hit.x, y: hit.y, scale, face, painted };
      }
    }
  }
  return best;
}

function sobel(canvas) {
  const { width: w, height: h, data } = rgbaOf(canvas);
  const g = new Float32Array(w * h);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  const out = createCanvas(w, h);
  const img = out.getContext('2d').createImageData(w, h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] + g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1];
      const gy = -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] + g[i + w - 1] + 2 * g[i + w] + g[i + w + 1];
      const v = Math.min(255, Math.hypot(gx, gy));
      const d = i * 4;
      img.data[d] = img.data[d + 1] = img.data[d + 2] = v;
      img.data[d + 3] = 255;
    }
  }
  out.getContext('2d').putImageData(img, 0, 0);
  return out;
}

function composite(photo, spriteCanvas, x, y, mode) {
  const out = createCanvas(photo.width, photo.height);
  const ctx = out.getContext('2d');
  ctx.drawImage(photo, 0, 0);
  const photoData = rgbaOf(photo).data;
  const spr = rgbaOf(spriteCanvas).data;
  const img = ctx.getImageData(0, 0, out.width, out.height);
  for (let sy = 0; sy < spriteCanvas.height; sy++) {
    for (let sx = 0; sx < spriteCanvas.width; sx++) {
      const si = (sy * spriteCanvas.width + sx) * 4;
      if (spr[si + 3] < 24) continue;
      const px = x + sx;
      const py = y + sy;
      if (px < 0 || py < 0 || px >= out.width || py >= out.height) continue;
      const di = (py * out.width + px) * 4;
      if (mode === 'overlay') {
        img.data[di] = (photoData[di] + spr[si]) / 2;
        img.data[di + 1] = (photoData[di + 1] + spr[si + 1]) / 2;
        img.data[di + 2] = (photoData[di + 2] + spr[si + 2]) / 2;
      } else if (mode === 'abs') {
        img.data[di] = Math.abs(photoData[di] - spr[si]);
        img.data[di + 1] = Math.abs(photoData[di + 1] - spr[si + 1]);
        img.data[di + 2] = Math.abs(photoData[di + 2] - spr[si + 2]);
      } else if (mode === 'chroma') {
        const lp = 0.299 * photoData[di] + 0.587 * photoData[di + 1] + 0.114 * photoData[di + 2];
        const ls = 0.299 * spr[si] + 0.587 * spr[si + 1] + 0.114 * spr[si + 2];
        const k = ls / Math.max(8, lp);
        img.data[di] = Math.min(255, Math.abs(photoData[di] * k - spr[si]));
        img.data[di + 1] = Math.min(255, Math.abs(photoData[di + 1] * k - spr[si + 1]));
        img.data[di + 2] = Math.min(255, Math.abs(photoData[di + 2] * k - spr[si + 2]));
      }
      img.data[di + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function maskStats(canvas, pred) {
  const { width: w, height: h, data } = rgbaOf(canvas);
  const pts = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (pred(data, i, x, y)) pts.push({ x, y });
    }
  }
  if (pts.length < 8) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const cx = xs.reduce((a, b) => a + b, 0) / pts.length;
  const cy = ys.reduce((a, b) => a + b, 0) / pts.length;
  return { n: pts.length, x0, y0, x1, y1, cx, cy, aspect: (x1 - x0 + 1) / Math.max(1, y1 - y0 + 1) };
}

function landmarks(photo, spriteCanvas, x, y) {
  const spr = maskStats(spriteCanvas, (d, i) => d[i + 3] >= 24);
  const shifted = spr && {
    ...spr,
    cx: spr.cx + x,
    cy: spr.cy + y,
    x0: spr.x0 + x,
    y0: spr.y0 + y,
    x1: spr.x1 + x,
    y1: spr.y1 + y,
  };
  const photoMask = maskStats(photo, (d, i) => {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max < 1 ? 0 : (max - min) / max;
    return sat > 0.28 && max > 70;
  });
  const major = shifted ? Math.max(shifted.x1 - shifted.x0, shifted.y1 - shifted.y0) : 1;
  const delta = shifted && photoMask ? Math.hypot(shifted.cx - photoMask.cx, shifted.cy - photoMask.cy) / major : null;
  return {
    spriteAspect: shifted ? Number(shifted.aspect.toFixed(3)) : null,
    photoAspect: photoMask ? Number(photoMask.aspect.toFixed(3)) : null,
    centroidDelta: delta == null ? null : Number(delta.toFixed(3)),
    sprite: shifted,
    photo: photoMask,
  };
}

function fit(ctx, canvas, x, y, w, h) {
  const s = Math.min(w / canvas.width, h / canvas.height);
  const dw = Math.max(1, Math.round(canvas.width * s));
  const dh = Math.max(1, Math.round(canvas.height * s));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function sheet(title, panels) {
  const pw = 280;
  const ph = 260;
  const cols = 4;
  const rows = Math.ceil(panels.length / cols);
  const canvas = createCanvas(cols * pw, 36 + rows * ph);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1c1612';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffecdc';
  ctx.font = '18px sans-serif';
  ctx.fillText(title, 12, 24);
  panels.forEach((p, i) => {
    const cx = (i % cols) * pw;
    const cy = 36 + Math.floor(i / cols) * ph;
    ctx.fillStyle = '#3c261d';
    ctx.fillRect(cx + 6, cy + 6, pw - 12, ph - 12);
    ctx.fillStyle = '#ffecdc';
    ctx.font = '14px sans-serif';
    ctx.fillText(p.label, cx + 12, cy + 24);
    if (p.canvas) fit(ctx, p.canvas, cx + 12, cy + 32, pw - 24, ph - 48);
  });
  return canvas;
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

async function cropItem(spec) {
  const cls = byNorm.get(spec.name.replace(/[^A-Za-z0-9]/g, '').toLowerCase());
  const shot = await shotOf(spec.shot);
  const fp = footprint(shapes, cls, { x: spec.x, y: spec.y, r: spec.r ?? 0 });
  const map = shot.map;
  const pad = 0.45;
  const box = {
    x0: map.originX + (fp.x0 - pad) * map.cellW,
    y0: map.originY + (fp.y0 - pad) * map.cellH,
    x1: map.originX + (fp.x1 + 1 + pad) * map.cellW,
    y1: map.originY + (fp.y1 + 1 + pad) * map.cellH,
  };
  const tight = {
    x0: map.originX + (fp.x0 - 0.08) * map.cellW,
    y0: map.originY + (fp.y0 - 0.08) * map.cellH,
    x1: map.originX + (fp.x1 + 1 + 0.08) * map.cellW,
    y1: map.originY + (fp.y1 + 1 + 0.08) * map.cellH,
  };
  const tightCanvas = cutNative(shot.data, shot.w, shot.h, tight);
  const canvas = cutNative(shot.data, shot.w, shot.h, box);
  const disp = display[`${cls.image}.png`] || {};
  const file = spriteFile(cls.image);
  const sprite = await loadImage(file);
  const nominal = (map.cellW * (Number(disp.w) || 1)) / sprite.width;
  const faces = spec.r == null ? [0, 1, 2, 3] : [spec.r];
  const known = align(canvas, sprite, nominal, faces);
  const anyFace = spec.r == null ? known : align(canvas, sprite, nominal, [0, 1, 2, 3]);
  const tightScales = [];
  for (let m = 0.8; m <= 1.25; m += 0.05) tightScales.push(nominal * m);
  const tightHay = grayBufFrom(tightCanvas);
  let anchored = null;
  for (const face of (spec.r == null ? [0, 1, 2, 3] : [spec.r])) {
    for (const scale of tightScales) {
      const painted = paintSprite(sprite, face * 90, scale);
      if (painted.width >= tightHay.w || painted.height >= tightHay.h || painted.width < 8) continue;
      const hit = bestNcc(tightHay, grayBufFrom(painted), 1);
      if (hit.score < 0) continue;
      if (!anchored || hit.score > anchored.score) anchored = { score: hit.score, x: hit.x, y: hit.y, scale, face, painted, canvas: tightCanvas };
    }
  }
  return { spec, cls, canvas, tightCanvas, sprite, file, nominal, known, anyFace, anchored, cellW: map.cellW, cellH: map.cellH, native: `${canvas.width}x${canvas.height}` };
}

const CASES = [
  { id: 'banana-real010', shot: 'real-010', name: 'Banana', x: 4, y: 3, r: 3, role: 'working' },
  { id: 'banana-real008', shot: 'real-008', name: 'Banana', x: 6, y: 4, r: 0, role: 'fail', pair: 'banana-real010' },
  { id: 'banana-real007', shot: 'real-007', name: 'Banana', x: 6, y: 0, r: 1, role: 'fail', pair: 'banana-real010' },
  { id: 'sword-leather', shot: 'leather-quad', name: 'Wooden Sword', x: 2, y: 1, r: null, role: 'fail' },
  { id: 'star-real010', shot: 'real-010', name: 'Star of Courage', x: 0, y: 5, r: null, role: 'working' },
  { id: 'star-real013', shot: 'real-013', name: 'Star of Courage', x: 1, y: 2, r: null, role: 'fail', pair: 'star-real010' },
  { id: 'pig-real010', shot: 'real-010', name: 'Piggybank', x: 1, y: 5, r: 0, role: 'working' },
  { id: 'pig-leather', shot: 'leather-quad', name: 'Piggybank', x: 2, y: 0, r: null, role: 'control', pair: 'pig-real010' },
  { id: 'flute-real008', shot: 'real-008', name: 'Flute', x: 5, y: 4, r: 3, role: 'consistency' },
  { id: 'pine-real008', shot: 'real-008', name: 'Pineapple', x: 8, y: 4, r: 0, role: 'consistency' },
  { id: 'armor-real008', shot: 'real-008', name: 'Holy Armor', x: 4, y: 0, r: 1, role: 'consistency' },
  { id: 'cap-real008', shot: 'real-008', name: 'Cap of Resilience', x: 8, y: 1, r: 0, role: 'consistency' },
  { id: 'maneki-real008', shot: 'real-008', name: 'Maneki-neko', x: 0, y: 3, r: 0, role: 'consistency' },
  { id: 'buckler-leather', shot: 'leather-quad', name: 'Wooden Buckler', x: 0, y: 0, r: null, role: 'consistency' },
  { id: 'bow-leather', shot: 'leather-quad', name: 'Shortbow', x: 2, y: 2, r: null, role: 'consistency' },
  { id: 'broom-leather', shot: 'leather-quad', name: 'Broom', x: 0, y: 3, r: null, role: 'consistency' },
  { id: 'doom-real007', shot: 'real-007', name: 'Doom Cap', x: 4, y: 2, r: 0, role: 'consistency' },
  { id: 'saber-real007', shot: 'real-007', name: 'Darksaber', x: 0, y: 1, r: 2, role: 'consistency' },
  { id: 'berry-real007', shot: 'real-007', name: 'Blueberries', x: 8, y: 0, r: null, role: 'consistency' },
  { id: 'armor-real007', shot: 'real-007', name: 'Holy Armor', x: 0, y: 5, r: 3, role: 'consistency' },
  { id: 'pig-real013', shot: 'real-013', name: 'Piggybank', x: 0, y: 3, r: 2, role: 'consistency' },
  { id: 'buckler-real013', shot: 'real-013', name: 'Wooden Buckler', x: 2, y: 0, r: 0, role: 'consistency' },
  { id: 'stone-real013', shot: 'real-013', name: 'Whetstone', x: 1, y: 0, r: null, role: 'consistency' },
];

fs.mkdirSync(path.join(OUT, 'sheets'), { recursive: true });
const rows = [];
const built = new Map();
for (const spec of CASES) {
  const item = await cropItem(spec);
  built.set(spec.id, item);
  const altName = spec.name === 'Banana' ? 'SpicyBanana' : null;
  let alt = null;
  if (altName) {
    const altImg = await loadImage(spriteFile(altName));
    alt = align(item.canvas, altImg, item.nominal * (item.sprite.width / altImg.width), item.known ? [item.anyFace.face] : [0, 1, 2, 3]);
    alt = alt && { score: Number(alt.score.toFixed(3)), scale: Number(alt.scale.toFixed(3)), face: alt.face };
  }
  const marks = item.anyFace ? landmarks(item.canvas, item.anyFace.painted, item.anyFace.x, item.anyFace.y) : null;
  const row = {
    id: spec.id,
    shot: spec.shot,
    name: spec.name,
    at: `${spec.x},${spec.y}`,
    role: spec.role,
    native: item.native,
    cell: `${item.cellW.toFixed(1)}x${item.cellH.toFixed(1)}`,
    sprite: path.basename(item.file),
    nominalScale: Number(item.nominal.toFixed(3)),
    knownFace: spec.r,
    knownScore: item.known ? Number(item.known.score.toFixed(3)) : null,
    bestFace: item.anyFace ? item.anyFace.face : null,
    bestScore: item.anyFace ? Number(item.anyFace.score.toFixed(3)) : null,
    bestScale: item.anyFace ? Number(item.anyFace.scale.toFixed(3)) : null,
    scaleVsNominal: item.anyFace ? Number((item.anyFace.scale / item.nominal).toFixed(3)) : null,
    anchoredScore: item.anchored ? Number(item.anchored.score.toFixed(3)) : null,
    anchoredFace: item.anchored ? item.anchored.face : null,
    anchoredScale: item.anchored ? Number((item.anchored.scale / item.nominal).toFixed(3)) : null,
    alt,
    centroidDelta: marks?.centroidDelta ?? null,
    spriteAspect: marks?.spriteAspect ?? null,
    photoAspect: marks?.photoAspect ?? null,
  };
  const pair = spec.pair ? built.get(spec.pair) : null;
  let workOnFail = null;
  if (pair?.anyFace) {
    const masked = createCanvas(pair.anyFace.painted.width, pair.anyFace.painted.height);
    const mctx = masked.getContext('2d');
    mctx.drawImage(pair.canvas, pair.anyFace.x, pair.anyFace.y, pair.anyFace.painted.width, pair.anyFace.painted.height, 0, 0, masked.width, masked.height);
    const alpha = rgbaOf(pair.anyFace.painted).data;
    const md = rgbaOf(masked);
    for (let i = 0; i < alpha.length; i += 4) if (alpha[i + 3] < 24) md.data[i + 3] = 0;
    mctx.putImageData(md, 0, 0);
    const needle = grayBufFrom(masked);
    const hay = grayBufFrom(item.canvas);
    if (needle.w < hay.w && needle.h < hay.h) {
      const hit = bestNcc(hay, needle, 2);
      workOnFail = Number(hit.score.toFixed(3));
      row.workingOnFail = workOnFail;
    }
  }
  const pose = item.anyFace;
  const panels = [
    { label: `raw ${item.native}`, canvas: item.canvas },
    { label: 'catalog', canvas: pose ? pose.painted : null },
    { label: pose ? `catalog on photo ${pose.score.toFixed(2)} r${pose.face}` : 'no pose', canvas: pose ? composite(item.canvas, pose.painted, pose.x, pose.y, 'overlay') : null },
    { label: pair ? 'working raw' : 'no working shot', canvas: pair ? pair.canvas : null },
    { label: 'photo edges', canvas: sobel(item.canvas) },
    { label: 'catalog edges', canvas: pose ? sobel(pose.painted) : null },
    { label: 'absolute diff', canvas: pose ? composite(item.canvas, pose.painted, pose.x, pose.y, 'abs') : null },
    { label: 'color after luma', canvas: pose ? composite(item.canvas, pose.painted, pose.x, pose.y, 'chroma') : null },
  ];
  const pic = sheet(`${spec.id}  ${spec.name}  scale x${row.scaleVsNominal ?? '-'}`, panels);
  fs.writeFileSync(path.join(OUT, 'sheets', `${spec.id}.png`), pic.toBuffer('image/png'));
  if (item.anchored) {
    const a = item.anchored;
    const anchoredPic = sheet(`${spec.id} anchored r${a.face} ${a.score.toFixed(2)} x${(a.scale / item.nominal).toFixed(2)}`, [
      { label: 'tight raw', canvas: a.canvas },
      { label: 'catalog', canvas: a.painted },
      { label: 'catalog on item', canvas: composite(a.canvas, a.painted, a.x, a.y, 'overlay') },
      { label: 'absolute diff', canvas: composite(a.canvas, a.painted, a.x, a.y, 'abs') },
      { label: 'color after luma', canvas: composite(a.canvas, a.painted, a.x, a.y, 'chroma') },
      { label: 'photo edges', canvas: sobel(a.canvas) },
      { label: 'catalog edges', canvas: sobel(a.painted) },
    ]);
    fs.writeFileSync(path.join(OUT, 'sheets', `${spec.id}-anchored.png`), anchoredPic.toBuffer('image/png'));
  }
  fs.writeFileSync(path.join(OUT, 'sheets', `${spec.id}-raw.png`), item.canvas.toBuffer('image/png'));
  rows.push(row);
  console.log(spec.id, 'free', row.bestScore, 'anchored', row.anchoredScore, 'face', row.anchoredFace, 'x', row.anchoredScale);
}

const alts = [];
function walk(dir, hit) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === '.import' || ent.name === 'node_modules') continue;
      walk(p, hit);
    } else if (hit(ent.name)) alts.push(p.replace(repo + path.sep, '').replaceAll('\\', '/'));
  }
}
walk(path.join(repo, 'tools/game-extract-full/Items'), (n) => /banana|woodensword|starofcourage|starofcourage/i.test(n) && !n.endsWith('.import'));
walk(path.join(repo, 'assets/item-sprites'), (n) => /banana|woodensword|starofcourage/i.test(n));

fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({
  kind: 'bpb-p15-native-forensic',
  note: 'Scores are native-resolution gray NCC after a scale and rotation search. They are diagnostic alignment, not the P10 ±8 benchmark.',
  items: rows,
  alternateFiles: alts,
}, null, 2));
console.log('wrote', OUT);
