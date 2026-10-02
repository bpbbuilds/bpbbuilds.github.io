/**
 * Label eval fixture PNGs with bag YOLO boxes from truth.bags + heavy augment copies.
 *
 *   node scripts/screenshot-detector/label-fixture-bags.mjs \
 *     --out scripts/_cache/synth-detector-bags-real --copies 80
 */
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { buildBagClassList, writeBagClassesArtifacts } from './classes.mjs';
import { loadEnv, loadCatalogWithTypes, ROOT } from './sample-layouts.mjs';
import { loadShapeIndex } from '../screenshot-to-build/shapes.mjs';
import { placementAabb } from './paint-node.mjs';
import { augmentCanvas } from './augment.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const copies = Math.max(1, Number(arg('--copies', '80')) | 0);
const outRoot = path.resolve(
  arg('--out', path.join(ROOT, 'scripts/_cache/synth-detector-bags-real')),
);
const fixturesDir = path.join(ROOT, 'scripts/screenshot-eval/fixtures');
const BOARD_COLS = 9;
const BOARD_ROWS = 7;

const env = loadEnv();
const catalog = await loadCatalogWithTypes(env);
const catalogById = new Map(catalog.map((c) => [c.id, c]));
const bagClassList = buildBagClassList(catalog);
writeBagClassesArtifacts(bagClassList, outRoot);
const classById = bagClassList.byId;
const nameToId = new Map(
  bagClassList.classes.map((c) => [String(c.name).toLowerCase(), c.id]),
);
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
    let cx = b.cx / imgW;
    let cy = b.cy / imgH;
    let bw = b.bw / imgW;
    let bh = b.bh / imgH;
    cx = Math.max(0, Math.min(1, cx));
    cy = Math.max(0, Math.min(1, cy));
    bw = Math.max(1e-3, Math.min(1, bw));
    bh = Math.max(1e-3, Math.min(1, bh));
    if (cx - bw / 2 < 0) cx = bw / 2;
    if (cy - bh / 2 < 0) cy = bh / 2;
    if (cx + bw / 2 > 1) cx = 1 - bw / 2;
    if (cy + bh / 2 > 1) cy = 1 - bh / 2;
    lines.push(
      `${cls.index} ${cx.toFixed(6)} ${cy.toFixed(6)} ${bw.toFixed(6)} ${bh.toFixed(6)}`,
    );
  }
  return lines;
}

/**
 * Map truth bags onto fixture image assuming nearly full-bleed 9×7 board (crop-like).
 * @param {import('@napi-rs/canvas').Image} img
 * @param {{ name: string, x: number, y: number, r?: number }[]} bags
 */
function boxesFromTruth(img, bags) {
  const cellW = img.width / BOARD_COLS;
  const cellH = img.height / BOARD_ROWS;
  /** @type {{ classId: string, cx: number, cy: number, bw: number, bh: number }[]} */
  const boxes = [];
  for (const t of bags) {
    const id = nameToId.get(String(t.name || '').toLowerCase());
    if (!id || !classById.has(id)) {
      console.error(`skip unknown bag name: ${t.name}`);
      continue;
    }
    const aabb = placementAabb(shapeIndex, id, {
      x: Number(t.x) || 0,
      y: Number(t.y) || 0,
      r: Number(t.r) || 0,
    });
    const bw = aabb.w * cellW;
    const bh = aabb.h * cellH;
    boxes.push({
      classId: id,
      cx: (aabb.x + aabb.w / 2) * cellW,
      cy: (aabb.y + aabb.h / 2) * cellH,
      bw,
      bh,
    });
  }
  return boxes;
}

const fixtureNames = ['pine-protector', 'pine-egg-remix'];
let written = 0;
let trainN = 0;
let valN = 0;

for (const name of fixtureNames) {
  const pngPath = path.join(fixturesDir, `${name}.png`);
  const truthPath = path.join(fixturesDir, `${name}.truth.json`);
  if (!fs.existsSync(pngPath) || !fs.existsSync(truthPath)) {
    console.error(`skip missing ${name}`);
    continue;
  }
  const truth = JSON.parse(fs.readFileSync(truthPath, 'utf8'));
  const bags = Array.isArray(truth.bags) ? truth.bags : [];
  if (!bags.length) {
    console.error(`skip ${name} (no bags[])`);
    continue;
  }
  const img = await loadImage(pngPath);
  const baseBoxes = boxesFromTruth(img, bags);
  if (!baseBoxes.length) continue;

  for (let i = 0; i < copies; i++) {
    const canvas = createCanvas(img.width, img.height);
    canvas.getContext('2d').drawImage(img, 0, 0);
    const aug = await augmentCanvas(
      canvas,
      { boxes: baseBoxes.map((b) => ({ ...b })) },
      Math.random() + i * 1e-4,
    );
    const lines = yoloLines(aug.boxes, aug.canvas.width, aug.canvas.height);
    if (!lines.length) continue;
    const isVal = i < Math.max(2, Math.floor(copies * 0.1));
    const stem = `${name}_${String(i).padStart(4, '0')}`;
    const imgDir = isVal ? imagesVal : imagesTrain;
    const lblDir = isVal ? labelsVal : labelsTrain;
    fs.writeFileSync(
      path.join(imgDir, `${stem}.jpg`),
      aug.canvas.toBuffer('image/jpeg', { quality: 0.92 }),
    );
    fs.writeFileSync(path.join(lblDir, `${stem}.txt`), lines.join('\n') + '\n');
    written += 1;
    if (isVal) valN += 1;
    else trainN += 1;
  }
  console.error(`fixture ${name}: ${copies} copies`);
}

const yaml = `path: ${outRoot.replace(/\\/g, '/')}
train: images/train
val: images/val
nc: ${bagClassList.classes.length}
names:
${bagClassList.classes.map((c) => `  ${c.index}: ${JSON.stringify(c.name)}`).join('\n')}
`;
fs.writeFileSync(path.join(outRoot, 'data.yaml'), yaml);
const summary = { out: outRoot, count: written, train: trainN, val: valN, copies, fixtures: fixtureNames };
fs.writeFileSync(path.join(outRoot, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
