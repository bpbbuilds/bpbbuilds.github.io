/**
 * Node smoke: vision prior + shared NCC tiling (parity with create solver).
 *
 *   node scripts/screenshot-to-build/solve-smoke.mjs path/to/shot.png
 *
 * Env:
 *   STB_VISION_CACHE  optional JSON { items: [{ name, cellCol, cellRow, rotation }] }
 *   Without cache, uses a synthetic prior that includes Falcon/Darksaber lookalikes
 *   plus egg/dragon-style wrong guesses (unresolved or low-NCC).
 */
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  consumePriorBudget,
  expandConfusionPool,
} from '../../js/shared/screenshot-confusion.js';
import { pxToCell, cropBagRect } from '../../js/shared/screenshot-grid.js';
import {
  NCC_RANK_FLOOR,
  knownScales,
  matchTemplateAtScales,
  maskRegion,
  prepareTemplateGray,
} from '../../js/shared/screenshot-ncc.js';
import { loadEnv, loadCatalog, ROOT, resolveToCatalog, normName } from './catalog.mjs';
import {
  detectGridFromShot,
  scaleGridToImage,
} from './grid-bridge.mjs';
import { imageToGray } from './sprite.mjs';
import { loadShapeIndex } from './shapes.mjs';

const BOARD_COLS = 9;
const BOARD_ROWS = 7;

/**
 * @param {import('@napi-rs/canvas').Image} img
 * @param {number} rotDeg
 * @param {number} scale
 */
function prepareNode(img, rotDeg, scale) {
  return prepareTemplateGray(
    img,
    rotDeg,
    scale,
    (w, h) => createCanvas(w, h),
    (source, ctx, x, y, w, h) => {
      ctx.drawImage(/** @type {any} */ (source), x, y, w, h);
    },
  );
}

/**
 * Body cells for catalog item at (x,y,r) using item-shapes via shape index footprints.
 * Fallback: 1×1.
 * @param {ReturnType<typeof loadShapeIndex>} shapeIndex
 * @param {string} itemId
 * @param {{ x: number, y: number, r: number }} pose
 */
function bodyCells(shapeIndex, itemId, pose) {
  const faces = shapeIndex.byId.get(itemId) || [{ w: 1, h: 1, rot: 0 }];
  const face = faces.find((f) => f.rot === pose.r * 90) || faces[0];
  const w = face?.w || 1;
  const h = face?.h || 1;
  /** @type {{ x: number, y: number }[]} */
  const cells = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      cells.push({ x: pose.x + dx, y: pose.y + dy });
    }
  }
  return cells;
}

/**
 * @param {{ x: number, y: number }[]} cells
 * @param {Set<string>} occupied
 */
function fits(cells, occupied) {
  for (const c of cells) {
    if (c.x < 0 || c.y < 0 || c.x >= BOARD_COLS || c.y >= BOARD_ROWS) return false;
    if (occupied.has(`${c.x},${c.y}`)) return false;
  }
  return true;
}

/**
 * Default prior: realistic names + lookalike mistakes + unresolved hallucinations.
 */
function syntheticPrior() {
  return [
    { name: 'Flame', cellCol: 1, cellRow: 1, rotation: 0 },
    { name: 'Flame', cellCol: 2, cellRow: 1, rotation: 0 },
    { name: 'Flame', cellCol: 3, cellRow: 1, rotation: 0 },
    { name: 'Phoenix', cellCol: 4, cellRow: 2, rotation: 0 },
    { name: 'Lightsaber', cellCol: 0, cellRow: 3, rotation: 0 }, // wrong → Darksaber should win
    { name: 'Hero Sword', cellCol: 5, cellRow: 3, rotation: 90 }, // wrong → Falcon lookalike pool
    { name: 'Mana Orb', cellCol: 6, cellRow: 1, rotation: 0 },
    { name: 'Piggybank', cellCol: 7, cellRow: 0, rotation: 0 },
    { name: 'Gloves of Haste', cellCol: 2, cellRow: 4, rotation: 0 },
    { name: 'Dragon Egg', cellCol: 4, cellRow: 5, rotation: 0 }, // hallucination
    { name: 'Purple Dragon', cellCol: 5, cellRow: 5, rotation: 0 }, // hallucination
  ];
}

/**
 * @param {string} shotPath
 * @param {{ name: string, cellCol?: number, cellRow?: number, rotation?: number }[]} rawVision
 * @param {Awaited<ReturnType<typeof loadCatalog>>} catalog
 */
async function solveSmoke(shotPath, rawVision, catalog) {
  const byNorm = new Map(catalog.map((c) => [normName(c.name), c]));
  const byName = new Map(catalog.map((c) => [c.name, c]));

  /** @type {Map<string, number>} */
  const budget = new Map();
  /** @type {Map<string, { x: number, y: number, r: number }[]>} */
  const hints = new Map();
  const priorNames = [];

  for (const v of rawVision) {
    const resolved = resolveToCatalog(v.name, catalog, byNorm) || byName.get(v.name);
    priorNames.push(v.name);
    if (!resolved) continue;
    budget.set(resolved.id, (budget.get(resolved.id) || 0) + 1);
    if (!hints.has(resolved.id)) hints.set(resolved.id, []);
    hints.get(resolved.id).push({
      x: Math.round(Number(v.cellCol) || 0),
      y: Math.round(Number(v.cellRow) || 0),
      r: (((Math.round((Number(v.rotation) || 0) / 90) % 4) + 4) % 4),
    });
  }

  const visionCount = [...budget.values()].reduce((a, b) => a + b, 0);
  const poolNames = expandConfusionPool(priorNames, 40);
  /** @type {typeof catalog} */
  const pool = [];
  for (const name of poolNames) {
    const item = byName.get(name) || resolveToCatalog(name, catalog, byNorm);
    if (!item) continue;
    if (!pool.some((x) => x.id === item.id)) pool.push(item);
  }
  for (const id of budget.keys()) {
    const item = catalog.find((c) => c.id === id);
    if (item && !pool.some((x) => x.id === item.id)) pool.push(item);
  }

  const { grid, gray, imgW, imgH } = await detectGridFromShot(shotPath, 900);
  const full = scaleGridToImage(grid, gray.w, gray.h, imgW, imgH);
  const rect = cropBagRect(full);
  const shot = await loadImage(shotPath);
  const cropCanvas = createCanvas(Math.max(16, rect.w), Math.max(16, rect.h));
  const cctx = cropCanvas.getContext('2d');
  cctx.drawImage(shot, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  const hay = imageToGray(cropCanvas, 0);

  const displayPath = path.join(ROOT, 'assets/data/sprite-display.json');
  const byImage = JSON.parse(fs.readFileSync(displayPath, 'utf8'));
  const dispMap = byImage.byImage || byImage;
  const cellW = full.ok ? full.cellW : rect.w / 9;
  const localGrid = { ...full, originX: 0, originY: 0 };
  const shapeIndex = loadShapeIndex(catalog);

  /** @type {any[]} */
  const poses = [];
  const itemsById = new Map(catalog.map((c) => [c.id, c]));

  for (const item of pool) {
    const file = item.spritePath || item.thumbPath;
    if (!file || !fs.existsSync(file)) continue;
    const img = await loadImage(file);
    const stem = `${item.image}.png`;
    const disp = dispMap[stem];
    const dispW = Number(disp?.w) || 1;
    const nativeW = item.spritePath
      ? Number(disp?.texW) || img.width
      : img.width;
    const scales = knownScales(cellW, dispW, nativeW);
    const hit = matchTemplateAtScales(hay, img, {
      scales,
      rotations: [0, 90, 180, 270],
      stride: 2,
      prepare: prepareNode,
    });
    if (hit.score < NCC_RANK_FLOOR) continue;
    const cell = pxToCell(localGrid, hit.x + hit.tw / 2, hit.y + hit.th / 2);
    let col = Math.max(0, Math.min(BOARD_COLS - 1, cell.col));
    let row = Math.max(0, Math.min(BOARD_ROWS - 1, cell.row));
    const rFace = Math.round(hit.rot / 90) % 4;
    let score = hit.score;
    for (const h of hints.get(item.id) || []) {
      if (Math.abs(h.x - col) <= 1 && Math.abs(h.y - row) <= 1) {
        score += 0.05;
        break;
      }
    }
    poses.push({
      id: item.id,
      name: item.name,
      x: col,
      y: row,
      r: rFace,
      score,
      hitX: hit.x,
      hitY: hit.y,
      tw: hit.tw,
      th: hit.th,
    });
  }
  poses.sort((a, b) => b.score - a.score);

  const remaining = new Map(budget);
  let slotsLeft = visionCount;
  const occupied = new Set();
  /** @type {any[]} */
  const placed = [];
  const work = {
    w: hay.w,
    h: hay.h,
    gray: new Float32Array(hay.gray),
    alpha: new Uint8Array(hay.alpha),
  };

  for (const pose of poses) {
    if (slotsLeft <= 0) break;
    const peek = new Map(remaining);
    if (!consumePriorBudget(peek, pose.id, pose.name, itemsById)) continue;

    const cells = bodyCells(shapeIndex, pose.id, pose);
    if (!fits(cells, occupied)) continue;
    for (const c of cells) occupied.add(`${c.x},${c.y}`);

    consumePriorBudget(remaining, pose.id, pose.name, itemsById);
    placed.push(pose);
    slotsLeft -= 1;
    maskRegion(work, pose.hitX, pose.hitY, pose.tw || 40, pose.th || 40);
  }

  return {
    gridOk: grid.ok,
    cellW: Number(cellW.toFixed(2)),
    visionCount,
    unresolvedPrior: priorNames.filter((n) => !resolveToCatalog(n, catalog, byNorm) && !byName.has(n)),
    poolSize: pool.length,
    topPoses: poses.slice(0, 12).map((p) => ({
      name: p.name,
      score: Number(p.score.toFixed(3)),
      x: p.x,
      y: p.y,
      r: p.r,
    })),
    placed: placed.map((p) => ({
      name: p.name,
      id: p.id,
      score: Number(p.score.toFixed(3)),
      x: p.x,
      y: p.y,
      r: p.r,
    })),
    rejected: Math.max(0, visionCount - placed.length),
  };
}

const shotPath = process.argv[2];
if (!shotPath) {
  console.error('Usage: node scripts/screenshot-to-build/solve-smoke.mjs <shot.png>');
  process.exit(1);
}

const env = loadEnv();
const catalog = await loadCatalog(env);

let rawVision;
const cachePath = process.env.STB_VISION_CACHE;
if (cachePath && fs.existsSync(cachePath)) {
  const j = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  rawVision = Array.isArray(j.items) ? j.items : Array.isArray(j) ? j : [];
  console.error(`vision cache: ${rawVision.length} items from ${cachePath}`);
} else {
  rawVision = syntheticPrior();
  console.error(`synthetic prior: ${rawVision.length} items (set STB_VISION_CACHE for real Edge JSON)`);
}

const result = await solveSmoke(shotPath, rawVision, catalog);
const names = result.placed.map((p) => p.name);
const hasDark = names.some((n) => /darksaber/i.test(n));
const hasFalcon = names.some((n) => /falcon/i.test(n));
const hasEgg = names.some((n) => /egg|dragon/i.test(n));

console.log(JSON.stringify(result, null, 2));
console.error(
  [
    `placed ${result.placed.length}/${result.visionCount}`,
    hasDark ? 'Darksaber=yes' : 'Darksaber=no',
    hasFalcon ? 'Falcon=yes' : 'Falcon=no',
    hasEgg ? 'egg/dragon=BAD' : 'egg/dragon=absent',
    `unresolved=${result.unresolvedPrior.join(',') || 'none'}`,
  ].join(' | '),
);
