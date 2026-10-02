/**
 * P17 part C. Replay the P15 native pose for real-007 Banana and
 * box-average that exact pair into 48px/cell. No new search.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { bestNcc, imageDataToGray } from '../../../js/shared/screenshot-ncc.js';
import { CELL_PX, fixturePng, footprint, loadCatalog, repo } from '../p8/shared.mjs';

const OUT = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p17');
const p13 = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p13/report.json'), 'utf8'));
const { shapes, display, byNorm } = loadCatalog();

function mapOf() {
  const g = p13.geometry['real-007'];
  const cols = Number(g.detected.split('x')[0]);
  const rows = Number(g.detected.split('x')[1]);
  return { originX: g.bag.x, originY: g.bag.y, cellW: g.bag.w / cols, cellH: g.bag.h / rows };
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
  return { canvas, x0, y0 };
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

function grayOf(canvas) {
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  return imageDataToGray({ width: canvas.width, height: canvas.height, data: data.data });
}

function nccPair(hay, needle) {
  let ts = 0;
  let n = 0;
  const idx = [];
  for (let i = 0; i < needle.alpha.length; i++) {
    if (needle.alpha[i] < 24) continue;
    idx.push(i);
    ts += needle.gray[i];
    n++;
  }
  if (n < 16) return -1;
  const tm = ts / n;
  let ss = 0;
  for (const i of idx) ss += hay.gray[i];
  const sm = ss / n;
  let num = 0;
  let sv = 0;
  let tv = 0;
  for (const i of idx) {
    const ds = hay.gray[i] - sm;
    const dt = needle.gray[i] - tm;
    num += ds * dt;
    sv += ds * ds;
    tv += dt * dt;
  }
  if (sv < 1e-3 || tv < 1e-3) return -1;
  return num / Math.sqrt(sv * tv);
}

function sample(src, w, h, x, y, kernel) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  let s = 0;
  let a = 0;
  let wt = 0;
  for (let yy = y0 - 1; yy <= y0 + 2; yy++) {
    for (let xx = x0 - 1; xx <= x0 + 2; xx++) {
      const kx = kernel(x - xx);
      const ky = kernel(y - yy);
      const k = kx * ky;
      if (k === 0 || xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const i = yy * w + xx;
      s += src.gray[i] * k;
      a += (src.alpha[i] >= 24 ? 1 : 0) * k;
      wt += k;
    }
  }
  return { g: wt ? s / wt : 0, a: wt && a / wt > 0.5 ? 255 : 0 };
}

function resize(src, ow, oh, mode) {
  const g = new Float32Array(ow * oh);
  const a = new Uint8Array(ow * oh);
  const fx = src.w / ow;
  const fy = src.h / oh;
  const catmull = (t) => {
    const u = Math.abs(t);
    if (u <= 1) return 1.5 * u * u * u - 2.5 * u * u + 1;
    if (u <= 2) return -0.5 * u * u * u + 2.5 * u * u - 4 * u + 2;
    return 0;
  };
  const linear = (t) => {
    const u = Math.abs(t);
    return u < 1 ? 1 - u : 0;
  };
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      if (mode === 'box') {
        const x0 = Math.floor(x * fx);
        const x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx));
        const y0 = Math.floor(y * fy);
        const y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
        let s = 0;
        let n = 0;
        let sa = 0;
        for (let yy = y0; yy < y1 && yy < src.h; yy++) {
          for (let xx = x0; xx < x1 && xx < src.w; xx++) {
            const i = yy * src.w + xx;
            if (src.alpha[i] < 24 && src.mask) continue;
            s += src.gray[i];
            if (src.alpha[i] >= 24) sa++;
            n++;
          }
        }
        g[y * ow + x] = n ? s / n : 0;
        a[y * ow + x] = sa > 0 ? 255 : 0;
      } else {
        const px = (x + 0.5) * fx - 0.5;
        const py = (y + 0.5) * fy - 0.5;
        const v = sample(src, src.w, src.h, px, py, mode === 'bicubic' ? catmull : linear);
        g[y * ow + x] = v.g;
        a[y * ow + x] = v.a;
      }
    }
  }
  return { w: ow, h: oh, gray: g, alpha: a };
}

const map = mapOf();
const cls = byNorm.get('banana');
const fp = footprint(shapes, cls, { x: 6, y: 0, r: 1 });
const img = await loadImage(fixturePng('real-007'));
const board = createCanvas(img.width, img.height);
board.getContext('2d').drawImage(img, 0, 0);
const src = board.getContext('2d').getImageData(0, 0, img.width, img.height).data;
const pad = 0.45;
const box = {
  x0: map.originX + (fp.x0 - pad) * map.cellW,
  y0: map.originY + (fp.y0 - pad) * map.cellH,
  x1: map.originX + (fp.x1 + 1 + pad) * map.cellW,
  y1: map.originY + (fp.y1 + 1 + pad) * map.cellH,
};
const crop = cutNative(src, img.width, img.height, box);
const sprite = await loadImage(path.join(repo, 'tools/game-extract-full/Items/Sprites/Banana.png'));
const disp = display['Banana.png'];
const nominal = (map.cellW * disp.w) / sprite.width;
const hay = grayOf(crop.canvas);
let best = null;
for (let m = 0.55; m <= 1.75; m += 0.1) {
  const scale = nominal * m;
  const painted = paintSprite(sprite, 90, scale);
  if (painted.width >= hay.w || painted.height >= hay.h || painted.width < 8) continue;
  const needle = grayOf(painted);
  const hit = bestNcc(hay, needle, 2);
  if (hit.score > (best?.score ?? -1)) best = { score: hit.score, x: hit.x, y: hit.y, scale, painted, needle };
}
const cx = map.originX + ((fp.x0 + fp.x1 + 1) / 2) * map.cellW + (disp.anchorX || 0) * map.cellW;
const cy = map.originY + ((fp.y0 + fp.y1 + 1) / 2) * map.cellH + (disp.anchorY || 0) * map.cellH;
const expectedLeft = cx - best.painted.width / 2 - crop.x0;
const expectedTop = cy - best.painted.height / 2 - crop.y0;
const f = map.cellW / CELL_PX;
const dxMatch = (best.x - expectedLeft) / f;
const dyMatch = (best.y - expectedTop) / f;

const photo = { w: best.painted.width, h: best.painted.height, gray: new Float32Array(best.painted.width * best.painted.height), alpha: new Uint8Array(best.painted.width * best.painted.height), mask: false };
for (let y = 0; y < photo.h; y++) {
  for (let x = 0; x < photo.w; x++) {
    const hx = best.x + x;
    const hy = best.y + y;
    const i = y * photo.w + x;
    if (hx < 0 || hy < 0 || hx >= hay.w || hy >= hay.h) continue;
    photo.gray[i] = hay.gray[hy * hay.w + hx];
    photo.alpha[i] = 255;
  }
}
const spriteBuf = { ...best.needle, mask: true };
const ow = Math.max(1, Math.floor(photo.w / f));
const oh = Math.max(1, Math.floor(photo.h / f));
const native = nccPair(photo, spriteBuf);
const boxPhoto = resize(photo, ow, oh, 'box');
const boxSprite = resize(spriteBuf, ow, oh, 'box');
const boxScore = nccPair(boxPhoto, boxSprite);
const resamplingLoss = native >= 0.6 && boxScore <= native - 0.25;
const resamplers = { box: Number(boxScore.toFixed(3)) };
if (resamplingLoss) {
  for (const mode of ['bilinear', 'bicubic']) {
    const hp = resize(photo, ow, oh, mode);
    const sp = resize(spriteBuf, ow, oh, mode);
    resamplers[mode] = Number(nccPair(hp, sp).toFixed(3));
  }
}
const report = {
  kind: 'bpb-p17-banana-native',
  replayScore: Number(best.score.toFixed(3)),
  face: 1,
  scale: Number(best.scale.toFixed(3)),
  scaleVsNominal: Number((best.scale / nominal).toFixed(3)),
  nativeNcc: Number(native.toFixed(3)),
  boxAverageNcc: Number(boxScore.toFixed(3)),
  matchSize: `${ow}x${oh}`,
  dxMatch: Number(dxMatch.toFixed(2)),
  dyMatch: Number(dyMatch.toFixed(2)),
  outsidePm8: Math.abs(dxMatch) > 8 || Math.abs(dyMatch) > 8,
  cell: `${map.cellW.toFixed(2)}x${map.cellH.toFixed(2)}`,
  factor: Number(f.toFixed(3)),
  resamplingLoss,
  resamplers,
  lanczos: 'not in repo',
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'banana.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
