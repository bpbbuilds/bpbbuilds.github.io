/**
 * Turn fixtures/real-NNN train boards into YOLO images (augmented copies).
 *
 *   node scripts/screenshot-detector/label-fixture-items.mjs \
 *     --out scripts/_cache/synth-detector-v5-real --copies 70
 */
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { extendLiveClassList, writeClassesArtifacts } from './classes.mjs';
import { loadEnv, loadCatalogWithTypes, ROOT } from './sample-layouts.mjs';
import { loadShapeIndex } from '../screenshot-to-build/shapes.mjs';
import { placementAabb } from './paint-node.mjs';
import { augmentCanvas } from './augment.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const copies = Math.max(1, Number(arg('--copies', '70')) | 0);
const outRoot = path.resolve(arg('--out', path.join(ROOT, 'scripts/_cache/synth-detector-v5-real')));
const fixturesDir = path.join(ROOT, 'fixtures');

const env = loadEnv();
const catalog = await loadCatalogWithTypes(env);
const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/detector-classes.json'), 'utf8'));
const classList = extendLiveClassList(catalog, live);
writeClassesArtifacts(classList, outRoot, { assetsPath: null });
const classById = classList.byId;
const nameToId = new Map(classList.classes.map((c) => [String(c.name).toLowerCase(), c.id]));
const shapeIndex = loadShapeIndex(catalog);

const imagesTrain = path.join(outRoot, 'images/train');
const imagesVal = path.join(outRoot, 'images/val');
const labelsTrain = path.join(outRoot, 'labels/train');
const labelsVal = path.join(outRoot, 'labels/val');
for (const d of [imagesTrain, imagesVal, labelsTrain, labelsVal]) {
  fs.mkdirSync(d, { recursive: true });
}

/**
 * @param {{ classId: string, cx: number, cy: number, bw: number, bh: number }[]} boxes
 * @param {number} imgW
 * @param {number} imgH
 */
function yoloLines(boxes, imgW, imgH) {
  /** @type {string[]} */
  const lines = [];
  for (const b of boxes) {
    const cls = classById.get(b.classId);
    if (!cls) continue;
    let bw = Math.max(1e-3, Math.min(1, b.bw / imgW));
    let bh = Math.max(1e-3, Math.min(1, b.bh / imgH));
    let cx = Math.max(bw / 2, Math.min(1 - bw / 2, b.cx / imgW));
    let cy = Math.max(bh / 2, Math.min(1 - bh / 2, b.cy / imgH));
    lines.push(`${cls.index} ${cx.toFixed(6)} ${cy.toFixed(6)} ${bw.toFixed(6)} ${bh.toFixed(6)}`);
  }
  return lines;
}

/**
 * @param {import('@napi-rs/canvas').Image} img
 * @param {any} truth
 */
function boxesFromTruth(img, truth) {
  const g = truth.grid || {};
  const cellW = Number(g.cellW) || img.width / 9;
  const cellH = Number(g.cellH) || img.height / 7;
  const originX = Number(g.originX) || 0;
  const originY = Number(g.originY) || 0;
  const rows = [
    ...(Array.isArray(truth.bags) ? truth.bags : []),
    ...(Array.isArray(truth.items) ? truth.items : []),
    ...(Array.isArray(truth.skills) ? truth.skills : []),
    ...(Array.isArray(truth.jewels) ? truth.jewels : []),
  ];
  /** @type {{ classId: string, cx: number, cy: number, bw: number, bh: number }[]} */
  const boxes = [];
  /** @type {string[]} */
  const skipped = [];
  for (const t of rows) {
    const id = nameToId.get(String(t.name || '').toLowerCase());
    if (!id || !classById.has(id)) {
      if (t.name) skipped.push(String(t.name));
      continue;
    }
    const aabb = placementAabb(shapeIndex, id, {
      x: Number(t.x) || 0,
      y: Number(t.y) || 0,
      r: t.r == null ? 0 : Number(t.r) || 0,
    });
    boxes.push({
      classId: id,
      cx: originX + (aabb.x + aabb.w / 2) * cellW,
      cy: originY + (aabb.y + aabb.h / 2) * cellH,
      bw: aabb.w * cellW,
      bh: aabb.h * cellH,
    });
  }
  return { boxes, skipped };
}

const stems = fs
  .readdirSync(fixturesDir)
  .filter((n) => /^real-\d{3}\.truth\.json$/.test(n))
  .map((n) => n.replace(/\.truth\.json$/, ''))
  .sort();

let written = 0;
let trainN = 0;
let valN = 0;
/** @type {string[]} */
const used = [];
/** @type {string[]} */
const skippedNames = [];

for (const stem of stems) {
  const pngPath = path.join(fixturesDir, `${stem}.png`);
  const truthPath = path.join(fixturesDir, `${stem}.truth.json`);
  if (!fs.existsSync(pngPath)) continue;
  const truth = JSON.parse(fs.readFileSync(truthPath, 'utf8'));
  if (truth.split !== 'train') continue;
  const img = await loadImage(pngPath);
  const { boxes, skipped } = boxesFromTruth(img, truth);
  skippedNames.push(...skipped);
  if (!boxes.length) {
    console.error(`skip ${stem} (no class boxes)`);
    continue;
  }
  used.push(stem);
  for (let i = 0; i < copies; i += 1) {
    const canvas = createCanvas(img.width, img.height);
    canvas.getContext('2d').drawImage(img, 0, 0);
    const aug = await augmentCanvas(
      canvas,
      { boxes: boxes.map((b) => ({ ...b })) },
      Math.random() + i * 1e-4,
    );
    const lines = yoloLines(aug.boxes, aug.canvas.width, aug.canvas.height);
    if (!lines.length) continue;
    const isVal = i < Math.max(2, Math.floor(copies * 0.1));
    const destStem = `${stem}_${String(i).padStart(4, '0')}`;
    const imgDir = isVal ? imagesVal : imagesTrain;
    const lblDir = isVal ? labelsVal : labelsTrain;
    fs.writeFileSync(
      path.join(imgDir, `${destStem}.jpg`),
      aug.canvas.toBuffer('image/jpeg', { quality: 0.92 }),
    );
    fs.writeFileSync(path.join(lblDir, `${destStem}.txt`), `${lines.join('\n')}\n`);
    written += 1;
    if (isVal) valN += 1;
    else trainN += 1;
  }
  console.error(`${stem}: ${copies} copies, ${boxes.length} boxes`);
}

const yaml = `path: ${outRoot.replace(/\\/g, '/')}
train: images/train
val: images/val
nc: ${classList.classes.length}
names:
${classList.classes.map((c) => `  ${c.index}: ${JSON.stringify(c.name)}`).join('\n')}
`;
fs.writeFileSync(path.join(outRoot, 'data.yaml'), yaml);
const uniqueSkip = [...new Set(skippedNames)];
const summary = { out: outRoot, count: written, train: trainN, val: valN, copies, fixtures: used, skipped: uniqueSkip };
fs.writeFileSync(path.join(outRoot, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
