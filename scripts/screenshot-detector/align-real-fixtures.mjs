/**
 * Find the 9×7 board on each fixtures/real-NNN.png and write truth.grid.
 *
 *   node scripts/screenshot-detector/align-real-fixtures.mjs
 */
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { detectBagGrid } from '../../js/shared/screenshot-grid.js';
import { ROOT } from './sample-layouts.mjs';

const fixturesDir = path.join(ROOT, 'fixtures');
const debugDir = path.join(ROOT, 'scripts/_cache/fixture-grids');
fs.mkdirSync(debugDir, { recursive: true });

/**
 * @param {import('@napi-rs/canvas').Image} img
 */
function toGray(img) {
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return { w: width, h: height, gray };
}

/**
 * Full-image lattice (this script does not crop first).
 * @param {import('../../js/shared/screenshot-grid.js').BagGrid} grid
 * @param {number} imgW
 * @param {number} imgH
 */
function fullImageMetrics(grid, imgW, imgH) {
  const gridOk = Boolean(grid?.ok && grid.cellW > 0);
  return {
    ok: gridOk,
    cellW: gridOk ? grid.cellW : imgW / 9,
    cellH: gridOk ? grid.cellH || grid.cellW : imgH / 7,
    originX: gridOk ? grid.originX : 0,
    originY: gridOk ? grid.originY : 0,
    score: Number(grid?.score) || 0,
  };
}

const names = fs
  .readdirSync(fixturesDir)
  .filter((n) => /^real-\d{3}\.png$/.test(n))
  .map((n) => n.replace(/\.png$/, ''))
  .sort();

/** @type {object[]} */
const summary = [];
for (const stem of names) {
  const pngPath = path.join(fixturesDir, `${stem}.png`);
  const truthPath = path.join(fixturesDir, `${stem}.truth.json`);
  const img = await loadImage(pngPath);
  const grid = detectBagGrid(toGray(img));
  const metrics = fullImageMetrics(grid, img.width, img.height);
  if (!metrics.ok) {
    metrics.cellW = img.width / 9;
    metrics.cellH = img.height / 7;
    metrics.originX = 0;
    metrics.originY = 0;
  }
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.strokeStyle = metrics.ok ? 'rgba(234,201,20,0.95)' : 'rgba(200,80,40,0.95)';
  ctx.lineWidth = 2;
  for (let y = 0; y <= 7; y += 1) {
    const py = metrics.originY + y * metrics.cellH;
    ctx.beginPath();
    ctx.moveTo(metrics.originX, py);
    ctx.lineTo(metrics.originX + 9 * metrics.cellW, py);
    ctx.stroke();
  }
  for (let x = 0; x <= 9; x += 1) {
    const px = metrics.originX + x * metrics.cellW;
    ctx.beginPath();
    ctx.moveTo(px, metrics.originY);
    ctx.lineTo(px, metrics.originY + 7 * metrics.cellH);
    ctx.stroke();
  }
  fs.writeFileSync(path.join(debugDir, `${stem}.png`), canvas.toBuffer('image/png'));

  if (fs.existsSync(truthPath)) {
    const text = fs.readFileSync(truthPath, 'utf8').trim();
    if (text) {
      const truth = JSON.parse(text);
      truth.grid = {
        ok: metrics.ok,
        originX: Number(metrics.originX.toFixed(2)),
        originY: Number(metrics.originY.toFixed(2)),
        cellW: Number(metrics.cellW.toFixed(2)),
        cellH: Number(metrics.cellH.toFixed(2)),
        imgW: img.width,
        imgH: img.height,
        score: Number(metrics.score.toFixed(3)),
      };
      fs.writeFileSync(truthPath, `${JSON.stringify(truth, null, 2)}\n`);
    }
  }
  summary.push({ stem, ok: metrics.ok, ...metrics, w: img.width, h: img.height });
  console.error(
    `${stem} ${metrics.ok ? 'grid' : 'full-bleed'} cell=${metrics.cellW.toFixed(1)}x${metrics.cellH.toFixed(1)} origin=${metrics.originX.toFixed(0)},${metrics.originY.toFixed(0)}`,
  );
}
fs.writeFileSync(path.join(debugDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ count: summary.length, gridOk: summary.filter((s) => s.ok).length }, null, 2));
