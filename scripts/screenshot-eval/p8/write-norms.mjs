/**
 * Write normalized match crops for the embedding pass. Fast; no retrieval.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { outDir } from './shared.mjs';
import { METHODS, applyPrep } from './normalize.mjs';

const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));

function save(rgb, w, h, file) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let p = 0, i = 0; p < w * h; p++, i += 3) {
    const o = p * 4;
    img.data[o] = rgb[i];
    img.data[o + 1] = rgb[i + 1];
    img.data[o + 2] = rgb[i + 2];
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
}

let n = 0;
for (const fix of manifest.fixtures) {
  for (const inst of fix.instances || []) {
    if (!inst.match) continue;
    const img = await loadImage(path.join(outDir, inst.match));
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
    for (const method of METHODS) {
      if (!method.prep) continue;
      const out = applyPrep(method.prep, rgb, img.width, img.height);
      save(out, img.width, img.height, path.join(outDir, 'norm', method.id, fix.fixture, `${inst.i}.png`));
    }
    n++;
  }
}
console.log('normalized crops', n);
