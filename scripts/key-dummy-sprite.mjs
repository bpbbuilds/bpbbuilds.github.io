/**
 * The training-dummy art was exported on a black matte (opaque, plus a faint
 * dark halo), so the sim field painted a black rectangle behind the doll.
 * Key the matte out from the border inward: the fill only travels through
 * near-black pixels, so the doll's own dark outline and eyes stay opaque.
 *
 *   node scripts/key-dummy-sprite.mjs [in.png] [out.png]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const SRC = process.argv[2] || 'assets/sim/dummy/dummy.png';
const OUT = process.argv[3] || SRC;

/** Matte + halo: the fill spreads through these. */
const BG_MAX = 24;
/** Antialias ramp: reached from the matte, kept partly opaque. */
const EDGE_MAX = 56;

const img = await loadImage(fs.readFileSync(SRC));
const canvas = createCanvas(img.width, img.height);
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0);

const { width, height } = canvas;
const frame = ctx.getImageData(0, 0, width, height);
const px = frame.data;
const luma = new Uint8ClampedArray(width * height);
for (let i = 0, p = 0; i < px.length; i += 4, p += 1) {
  luma[p] = Math.round(0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]);
}

const BG = 1;
const EDGE = 2;
const state = new Uint8Array(width * height);
const stack = [];

/** @param {number} p */
function seed(p) {
  if (state[p] || luma[p] > BG_MAX) return;
  state[p] = BG;
  stack.push(p);
}

for (let x = 0; x < width; x += 1) {
  seed(x);
  seed((height - 1) * width + x);
}
for (let y = 0; y < height; y += 1) {
  seed(y * width);
  seed(y * width + width - 1);
}

while (stack.length) {
  const p = stack.pop();
  const x = p % width;
  const y = (p - x) / width;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = ny * width + nx;
      if (state[n]) continue;
      const l = luma[n];
      if (l <= BG_MAX) {
        state[n] = BG;
        stack.push(n);
      } else if (l <= EDGE_MAX) {
        // Edge of the silhouette: ramp alpha instead of a hard cut.
        state[n] = EDGE;
      }
    }
  }
}

let cleared = 0;
let ramped = 0;
for (let p = 0; p < state.length; p += 1) {
  const i = p * 4;
  if (state[p] === BG) {
    px[i + 3] = 0;
    cleared += 1;
  } else if (state[p] === EDGE) {
    px[i + 3] = Math.round((255 * (luma[p] - BG_MAX)) / (EDGE_MAX - BG_MAX));
    ramped += 1;
  }
}

ctx.putImageData(frame, 0, 0);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, canvas.toBuffer('image/png'));

const total = width * height;
console.log(
  JSON.stringify(
    {
      src: SRC,
      out: OUT,
      size: [width, height],
      clearedPct: Math.round((cleared / total) * 1000) / 10,
      ramped,
      keptPct: Math.round(((total - cleared) / total) * 1000) / 10,
    },
    null,
    2,
  ),
);
