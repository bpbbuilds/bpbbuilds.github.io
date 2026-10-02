/**
 * Paint-compare smoke: NCC board → color score; bad swap/remove must worsen.
 *
 *   node scripts/screenshot-to-build/paint-smoke.mjs path/to/shot.png
 */
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  bagMedianRgb,
  scorePaintVsShot,
} from '../../js/shared/screenshot-paint-score.js';
import { lookalikesForName } from '../../js/shared/screenshot-confusion.js';
import { cropBagRect } from '../../js/shared/screenshot-grid.js';
import { loadEnv, loadCatalog, ROOT, resolveToCatalog, normName } from './catalog.mjs';
import { detectGridFromShot, scaleGridToImage } from './grid-bridge.mjs';

const BOARD_COLS = 9;
const BOARD_ROWS = 7;

/**
 * Minimal Node paint: sprites only (no DOM paintBoardCanvas).
 * @param {{ id: string, x: number, y: number, r: number }[]} placements
 * @param {Map<string, object>} byId
 * @param {number} cellPx
 * @param {number} outW
 * @param {number} outH
 */
async function paintNode(placements, byId, cellPx, outW, outH) {
  const boardW = Math.round(BOARD_COLS * cellPx);
  const boardH = Math.round(BOARD_ROWS * cellPx);
  const canvas = createCanvas(boardW, boardH);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, boardW, boardH);

  for (const p of placements) {
    const item = byId.get(p.id);
    if (!item?.spritePath || !fs.existsSync(item.spritePath)) continue;
    const img = await loadImage(item.spritePath);
    const face = ((Number(p.r) || 0) % 4 + 4) % 4;
    const dispW = 1;
    const dw = dispW * cellPx * (img.width / Math.max(img.width, img.height));
    const dh = (dw * img.height) / img.width;
    const cx = (Number(p.x) + 0.5) * cellPx;
    const cy = (Number(p.y) + 0.5) * cellPx;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((face * Math.PI) / 2);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  const aligned = createCanvas(outW, outH);
  const actx = aligned.getContext('2d');
  actx.clearRect(0, 0, outW, outH);
  actx.drawImage(canvas, 0, 0, outW, outH);
  const { data, width, height } = actx.getImageData(0, 0, outW, outH);
  return { data, width, height };
}

/**
 * Unit-ish: identical paint/shot → low covered; wrong color blob → high covered.
 */
function metricSelfTest() {
  const w = 32;
  const h = 32;
  const shot = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  const paint = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  // leather brown
  for (let i = 0; i < w * h; i++) {
    shot.data[i * 4] = 90;
    shot.data[i * 4 + 1] = 60;
    shot.data[i * 4 + 2] = 40;
    shot.data[i * 4 + 3] = 255;
  }
  // red blob in shot + matching paint
  for (let y = 8; y < 16; y++) {
    for (let x = 8; x < 16; x++) {
      const i = (y * w + x) * 4;
      shot.data[i] = 200;
      shot.data[i + 1] = 40;
      shot.data[i + 2] = 40;
      paint.data[i] = 200;
      paint.data[i + 1] = 40;
      paint.data[i + 2] = 40;
      paint.data[i + 3] = 255;
    }
  }
  const good = scorePaintVsShot(shot, paint);
  // blue paint over red shot
  const paintBad = {
    width: w,
    height: h,
    data: new Uint8ClampedArray(paint.data),
  };
  for (let y = 8; y < 16; y++) {
    for (let x = 8; x < 16; x++) {
      const i = (y * w + x) * 4;
      paintBad.data[i] = 40;
      paintBad.data[i + 1] = 40;
      paintBad.data[i + 2] = 200;
    }
  }
  const bad = scorePaintVsShot(shot, paintBad);
  // remove paint → unexplained
  const paintEmpty = {
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
  };
  const missing = scorePaintVsShot(shot, paintEmpty);
  return {
    goodTotal: good.total,
    badColorTotal: bad.total,
    missingTotal: missing.total,
    colorRejects: bad.total > good.total,
    missingRejects: missing.total > good.total,
  };
}

const shotPath = process.argv[2];
if (!shotPath) {
  console.error('Usage: node scripts/screenshot-to-build/paint-smoke.mjs <shot.png>');
  process.exit(1);
}

const metric = metricSelfTest();
console.error(
  `metric: colorRejects=${metric.colorRejects} missingRejects=${metric.missingRejects}`,
  `good=${metric.goodTotal.toFixed(1)} bad=${metric.badColorTotal.toFixed(1)} miss=${metric.missingTotal.toFixed(1)}`,
);

// Reuse solve-smoke via spawning would be heavy — import placement by running NCC lightly:
// Call solve-smoke as child and parse JSON, OR duplicate thin place list from last smoke.
// Prefer: run solve-smoke and read stdout JSON.
const { spawnSync } = await import('child_process');
const sm = spawnSync(
  process.execPath,
  [path.join(ROOT, 'scripts/screenshot-to-build/solve-smoke.mjs'), shotPath],
  { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
);
const out = (sm.stdout || '').replace(/^\uFEFF/, '');
const jsonStart = out.indexOf('{');
if (jsonStart < 0) {
  console.error(sm.stderr || sm.stdout);
  console.error('solve-smoke produced no JSON');
  process.exit(1);
}
const solved = JSON.parse(out.slice(jsonStart));
const placed = solved.placed || [];
console.error(
  `ncc placed: ${placed.map((p) => p.name).join(', ')}`,
);

const env = loadEnv();
const catalog = await loadCatalog(env);
const byId = new Map(catalog.map((c) => [c.id, c]));
const byNorm = new Map(catalog.map((c) => [normName(c.name), c]));

const { grid, gray, imgW, imgH } = await detectGridFromShot(shotPath, 900);
const full = scaleGridToImage(grid, gray.w, gray.h, imgW, imgH);
const rect = cropBagRect(full);
const shot = await loadImage(shotPath);
const crop = createCanvas(rect.w, rect.h);
crop.getContext('2d').drawImage(shot, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
const shotId = crop.getContext('2d').getImageData(0, 0, rect.w, rect.h);
const leather = bagMedianRgb(shotId);
const cellPx = full.ok ? full.cellW : rect.w / 9;

const paint0 = await paintNode(placed, byId, cellPx, rect.w, rect.h);
const scoreBefore = scorePaintVsShot(shotId, paint0, { leather });

// Bad lookalike swap if possible (first item with a peer)
let scoreSwap = null;
let swapName = null;
const boardSwap = placed.map((p) => ({ ...p }));
for (let i = 0; i < boardSwap.length; i++) {
  const peers = lookalikesForName(boardSwap[i].name).filter((n) => n !== boardSwap[i].name);
  if (!peers.length) continue;
  const alt =
    resolveToCatalog(peers[0], catalog, byNorm) ||
    catalog.find((c) => c.name === peers[0]);
  if (!alt) continue;
  boardSwap[i] = { ...boardSwap[i], id: alt.id, name: alt.name };
  swapName = `${placed[i].name}→${alt.name}`;
  const paintS = await paintNode(boardSwap, byId, cellPx, rect.w, rect.h);
  scoreSwap = scorePaintVsShot(shotId, paintS, { leather });
  break;
}

// Remove a Flame if present (count error)
let scoreRemove = null;
const flameIdx = placed.findIndex((p) => /flame/i.test(p.name) && !/frozen/i.test(p.name));
if (flameIdx >= 0) {
  const boardRm = placed.filter((_, i) => i !== flameIdx);
  const paintR = await paintNode(boardRm, byId, cellPx, rect.w, rect.h);
  scoreRemove = scorePaintVsShot(shotId, paintR, { leather });
}

const names = placed.map((p) => p.name);
const hasDark = names.some((n) => /darksaber/i.test(n));
const hasFalcon = names.some((n) => /falcon/i.test(n));

const result = {
  metric,
  scoreBefore: {
    total: Number(scoreBefore.total.toFixed(2)),
    covered: Number(scoreBefore.covered.toFixed(2)),
    unexplained: Number(scoreBefore.unexplained.toFixed(2)),
  },
  swap: scoreSwap
    ? {
        which: swapName,
        total: Number(scoreSwap.total.toFixed(2)),
        rejects: scoreSwap.total >= scoreBefore.total - 0.01,
      }
    : null,
  removeFlame: scoreRemove
    ? {
        total: Number(scoreRemove.total.toFixed(2)),
        rejects: scoreRemove.total >= scoreBefore.total - 0.01,
      }
    : null,
  placed: names,
  Darksaber: hasDark,
  Falcon: hasFalcon,
};

console.log(JSON.stringify(result, null, 2));
console.error(
  [
    `scoreBefore=${result.scoreBefore.total}`,
    result.swap
      ? `swap ${result.swap.which} total=${result.swap.total} reject=${result.swap.rejects}`
      : 'swap=n/a',
    result.removeFlame
      ? `rmFlame total=${result.removeFlame.total} reject=${result.removeFlame.rejects}`
      : 'rmFlame=n/a',
    hasDark ? 'Darksaber=yes' : 'Darksaber=no',
    hasFalcon ? 'Falcon=yes' : 'Falcon=no',
  ].join(' | '),
);
