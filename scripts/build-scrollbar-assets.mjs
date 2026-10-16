#!/usr/bin/env node

/** Build horizontal derivatives from the vertical game scrollbar textures. */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets/icons/scrollbar');

async function rotateQuarterTurn(inputName, outputName) {
  const source = await loadImage(path.join(dir, inputName));
  const canvas = createCanvas(source.height, source.width);
  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(source, 0, 0);
  await fs.writeFile(path.join(dir, outputName), canvas.toBuffer('image/png'));
}

await rotateQuarterTurn('track.png', 'track-horizontal.png');
await rotateQuarterTurn('thumb.png', 'thumb-horizontal.png');
console.log('Built horizontal scrollbar derivatives.');
