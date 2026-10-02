/**
 * P14 crop recut. Eval only. Does not change the importer or benchmark truth.
 * real-003 and real-008 use the bag rectangle split into 9×7.
 * leather-quad keeps that same 9×7 pitch and shifts the origin onto the pig.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { bestNcc, imageDataToGray, knownScales, prepareTemplateGray } from '../../../js/shared/screenshot-ncc.js';
import { CELL_PX, fixturePng, footprint, loadCatalog, repo } from '../p8/shared.mjs';

const P8 = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p8');
const P13 = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p13/report.json');
const OUT = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p14');
const TARGETS = ['real-003', 'real-008', 'leather-quad'];

const { shapes, display, byNorm } = loadCatalog();
const manifest = JSON.parse(fs.readFileSync(path.join(P8, 'manifest.json'), 'utf8'));
const geo = JSON.parse(fs.readFileSync(P13, 'utf8')).geometry;
const draw = (img, ctx, x, y, w, h) => ctx.drawImage(img, x, y, w, h);

function bagOf(shot) {
  const b = geo[shot].bag;
  return { x: b.x, y: b.y, w: b.w, h: b.h, cols: Number(geo[shot].detected.split('x')[0]), rows: Number(geo[shot].detected.split('x')[1]) };
}

function oldMap(shot) {
  const bag = bagOf(shot);
  return { shot, kind: 'detected', originX: bag.x, originY: bag.y, cellW: bag.w / bag.cols, cellH: bag.h / bag.rows, cols: bag.cols, rows: bag.rows };
}

function canonMap(shot) {
  const bag = bagOf(shot);
  return { shot, kind: 'bag-9x7', originX: bag.x, originY: bag.y, cellW: bag.w / 9, cellH: bag.h / 7, cols: 9, rows: 7 };
}

async function pigShift(bag) {
  const fix = manifest.fixtures.find((f) => f.fixture === 'real-010');
  const inst = fix.instances.find((it) => it.name === 'Piggybank' && it.x === 1 && it.y === 5);
  const disp = display[`${inst.image}.png`];
  const sprite = await loadImage(path.join(repo, 'assets/item-thumbs/2x', `${inst.image}.webp`));
  const hayImg = await loadImage(path.join(P8, inst.match));
  const canvas = createCanvas(hayImg.width, hayImg.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(hayImg, 0, 0);
  const data = ctx.getImageData(0, 0, hayImg.width, hayImg.height).data;
  const hay = imageDataToGray({ width: hayImg.width, height: hayImg.height, data });
  const scale = knownScales(CELL_PX, Number(disp.w) || 1, sprite.width)[2] || 1;
  const needle = prepareTemplateGray(sprite, (inst.r || 0) * 90, scale, (w, h) => createCanvas(w, h), draw);
  const ecx = inst.cxr + (Number(disp.anchorX) || 0) * CELL_PX;
  const ecy = inst.cyr + (Number(disp.anchorY) || 0) * CELL_PX;
  const placed = bestNcc(hay, needle, 2, {
    x0: Math.floor(ecx - needle.w / 2) - 12,
    x1: Math.floor(ecx - needle.w / 2) + 12,
    y0: Math.floor(ecy - needle.h / 2) - 12,
    y1: Math.floor(ecy - needle.h / 2) + 12,
  });
  const patch = new Uint8ClampedArray(needle.w * needle.h * 4);
  for (let i = 0; i < needle.alpha.length; i++) {
    if (needle.alpha[i] < 24) continue;
    const hx = placed.x + (i % needle.w);
    const hy = placed.y + ((i / needle.w) | 0);
    if (hx < 0 || hy < 0 || hx >= hay.w || hy >= hay.h) continue;
    const si = (hy * hay.w + hx) * 4;
    const di = i * 4;
    patch[di] = data[si];
    patch[di + 1] = data[si + 1];
    patch[di + 2] = data[si + 2];
    patch[di + 3] = 255;
  }
  const ref = imageDataToGray({ width: needle.w, height: needle.h, data: patch });
  const board = createCanvas(9 * CELL_PX, 7 * CELL_PX);
  const leather = await loadImage(fixturePng('leather-quad'));
  board.getContext('2d').drawImage(leather, bag.x, bag.y, bag.w, bag.h, 0, 0, board.width, board.height);
  const boardData = board.getContext('2d').getImageData(0, 0, board.width, board.height).data;
  const boardHay = imageDataToGray({ width: board.width, height: board.height, data: boardData });
  const coarse = bestNcc(boardHay, ref, 4, { x0: 0, x1: board.width - ref.w, y0: 0, y1: board.height - ref.h });
  const fine = bestNcc(boardHay, ref, 1, { x0: coarse.x - 6, x1: coarse.x + 6, y0: coarse.y - 6, y1: coarse.y + 6 });
  const cls = byNorm.get('piggybank');
  const fp = footprint(shapes, cls, { x: 2, y: 0, r: 0 });
  const truthCx = (fp.x0 + fp.x1 + 1) / 2;
  const truthCy = (fp.y0 + fp.y1 + 1) / 2;
  const actualCx = (fine.x + ref.w / 2) / CELL_PX;
  const actualCy = (fine.y + ref.h / 2) / CELL_PX;
  const shiftX = (actualCx - truthCx) * (bag.w / 9);
  const shiftY = (actualCy - truthCy) * (bag.h / 7);
  return {
    pigScore: Number(fine.score.toFixed(3)),
    pigAt: { x: fine.x, y: fine.y },
    truthCenterCells: { x: truthCx, y: truthCy },
    actualCenterCells: { x: Number(actualCx.toFixed(3)), y: Number(actualCy.toFixed(3)) },
    shiftCells: { x: Number((actualCx - truthCx).toFixed(3)), y: Number((actualCy - truthCy).toFixed(3)) },
    shiftPx: { x: Number(shiftX.toFixed(2)), y: Number(shiftY.toFixed(2)) },
  };
}

function boxFor(map, b, pad) {
  return {
    x0: map.originX + b.x0 * map.cellW - pad * map.cellW,
    y0: map.originY + b.y0 * map.cellH - pad * map.cellH,
    x1: map.originX + (b.x1 + 1) * map.cellW + pad * map.cellW,
    y1: map.originY + (b.y1 + 1) * map.cellH + pad * map.cellH,
  };
}

function cutCrop(src, fullW, fullH, map, b) {
  const raw = boxFor(map, b, 1.5);
  const x0 = Math.max(0, Math.floor(raw.x0));
  const y0 = Math.max(0, Math.floor(raw.y0));
  const x1 = Math.min(fullW, Math.ceil(raw.x1));
  const y1 = Math.min(fullH, Math.ceil(raw.y1));
  const sx = map.cellW / CELL_PX;
  const sy = map.cellH / CELL_PX;
  const sw = Math.max(8, Math.floor((x1 - x0) / sx));
  const sh = Math.max(8, Math.floor((y1 - y0) / sy));
  const canvas = createCanvas(sw, sh);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(sw, sh);
  let inside = 0;
  let asked = 0;
  for (let y = 0; y < sh; y++) {
    const sy0 = Math.floor(y * sy);
    const sy1 = Math.min(y1 - y0, Math.max(sy0 + 1, Math.floor((y + 1) * sy)));
    for (let x = 0; x < sw; x++) {
      const sx0 = Math.floor(x * sx);
      const sx1 = Math.min(x1 - x0, Math.max(sx0 + 1, Math.floor((x + 1) * sx)));
      let r = 0; let g = 0; let bv = 0; let n = 0;
      for (let yy = sy0; yy < sy1; yy++) {
        const py = y0 + yy;
        if (py < 0 || py >= fullH) continue;
        for (let xx = sx0; xx < sx1; xx++) {
          const px = x0 + xx;
          asked++;
          if (px < 0 || px >= fullW) continue;
          const o = (py * fullW + px) * 4;
          r += src[o]; g += src[o + 1]; bv += src[o + 2]; n++; inside++;
        }
      }
      const di = (y * sw + x) * 4;
      img.data[di] = n ? r / n : 0;
      img.data[di + 1] = n ? g / n : 0;
      img.data[di + 2] = n ? bv / n : 0;
      img.data[di + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const cx = ((b.x0 + b.x1 + 1) / 2) * map.cellW + map.originX;
  const cy = ((b.y0 + b.y1 + 1) / 2) * map.cellH + map.originY;
  const cell = boxFor(map, b, 0);
  const cellArea = Math.max(1, (cell.x1 - cell.x0) * (cell.y1 - cell.y0));
  const ix0 = Math.max(cell.x0, 0);
  const iy0 = Math.max(cell.y0, 0);
  const ix1 = Math.min(cell.x1, fullW);
  const iy1 = Math.min(cell.y1, fullH);
  const cover = Math.max(0, ix1 - ix0) * Math.max(0, iy1 - iy0) / cellArea;
  return {
    canvas, sw, sh,
    cxr: (cx - x0) / sx,
    cyr: (cy - y0) / sy,
    cover: Number(cover.toFixed(3)),
    clipped: cover < 0.98,
    outside: cover < 0.2,
  };
}

const leatherBag = bagOf('leather-quad');
const shift = await pigShift(leatherBag);
console.log('leather shift', JSON.stringify(shift));

const maps = {
  'real-003': canonMap('real-003'),
  'real-008': canonMap('real-008'),
  'leather-quad': {
    ...canonMap('leather-quad'),
    kind: '9x7-origin-shift',
    originX: leatherBag.x + shift.shiftPx.x,
    originY: leatherBag.y + shift.shiftPx.y,
    leather: shift,
  },
};

fs.mkdirSync(path.join(OUT, 'overlays'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'zooms'), { recursive: true });
const crops = [];
for (const shot of TARGETS) {
  const img = await loadImage(fixturePng(shot));
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const src = ctx.getImageData(0, 0, img.width, img.height).data;
  const map = maps[shot];
  const prev = oldMap(shot);
  const fix = manifest.fixtures.find((f) => f.fixture === shot);
  const scale = Math.min(1, 1500 / img.width);
  const board = createCanvas(Math.round(img.width * scale), Math.round(img.height * scale));
  const bctx = board.getContext('2d');
  bctx.drawImage(img, 0, 0, board.width, board.height);
  bctx.save();
  bctx.scale(scale, scale);
  bctx.lineWidth = 3;
  for (const inst of fix.instances) {
    if (inst.kind !== 'item' || !inst.b) continue;
    const corrected = boxFor(map, inst.b, 0);
    const detected = boxFor(prev, inst.b, 0);
    bctx.strokeStyle = '#ff4d4d';
    bctx.strokeRect(detected.x0, detected.y0, detected.x1 - detected.x0, detected.y1 - detected.y0);
    bctx.strokeStyle = '#39ff14';
    bctx.lineWidth = 4;
    bctx.strokeRect(corrected.x0, corrected.y0, corrected.x1 - corrected.x0, corrected.y1 - corrected.y0);
    bctx.fillStyle = '#fffaf0';
    bctx.font = `${Math.round(22 / scale)}px sans-serif`;
    bctx.fillText(`${inst.name} ${inst.x},${inst.y}`, corrected.x0, Math.max(24, corrected.y0 - 4));
    const cut = cutCrop(src, img.width, img.height, map, inst.b);
    const file = `crops/${shot}/${inst.i}.png`;
    fs.mkdirSync(path.join(OUT, 'crops', shot), { recursive: true });
    fs.writeFileSync(path.join(OUT, file), cut.canvas.toBuffer('image/png'));
    crops.push({
      fixture: shot, i: inst.i, name: inst.name, x: inst.x, y: inst.y, r: inst.r ?? 0,
      truthId: inst.truthId, image: inst.image, oblong: inst.oblong, b: inst.b,
      match: file, cxr: cut.cxr, cyr: cut.cyr, w: cut.sw, h: cut.sh,
      cover: cut.cover, clipped: cut.clipped, outside: cut.outside,
    });
    const zx0 = Math.max(0, Math.floor(corrected.x0 - map.cellW));
    const zy0 = Math.max(0, Math.floor(corrected.y0 - map.cellH));
    const zx1 = Math.min(img.width, Math.ceil(corrected.x1 + map.cellW));
    const zy1 = Math.min(img.height, Math.ceil(corrected.y1 + map.cellH));
    const zoom = createCanvas(Math.max(8, zx1 - zx0), Math.max(8, zy1 - zy0));
    const z = zoom.getContext('2d');
    z.drawImage(img, zx0, zy0, zoom.width, zoom.height, 0, 0, zoom.width, zoom.height);
    z.strokeStyle = '#ff4d4d';
    z.lineWidth = 3;
    z.strokeRect(detected.x0 - zx0, detected.y0 - zy0, detected.x1 - detected.x0, detected.y1 - detected.y0);
    z.strokeStyle = '#39ff14';
    z.lineWidth = 4;
    z.strokeRect(corrected.x0 - zx0, corrected.y0 - zy0, corrected.x1 - corrected.x0, corrected.y1 - corrected.y0);
    z.fillStyle = '#fffaf0';
    z.font = '28px sans-serif';
    z.fillText(`${inst.name} ${inst.x},${inst.y}`, 8, 32);
    const zs = Math.min(1, 900 / zoom.width);
    const outZ = createCanvas(Math.round(zoom.width * zs), Math.round(zoom.height * zs));
    outZ.getContext('2d').drawImage(zoom, 0, 0, outZ.width, outZ.height);
    fs.writeFileSync(path.join(OUT, 'zooms', `${shot}-${inst.name.replace(/[^a-z0-9]+/gi, '-')}-${inst.x}-${inst.y}.png`), outZ.toBuffer('image/png'));
  }
  bctx.restore();
  fs.writeFileSync(path.join(OUT, 'overlays', `${shot}-corrected.png`), board.toBuffer('image/png'));
  console.log(shot, 'crops', crops.filter((c) => c.fixture === shot).length, 'clipped', crops.filter((c) => c.fixture === shot && c.clipped).length);
}

fs.writeFileSync(path.join(OUT, 'mapping.json'), JSON.stringify({
  note: 'Green boxes are the corrected cells. Red boxes are the P13 detected cells. leather origin is the pig-center shift, pitch unchanged.',
  maps, crops,
}, null, 2));
console.log('wrote', OUT);
