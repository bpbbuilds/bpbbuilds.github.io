/**
 * Generate bag-only YOLO synth (build layouts / dense / occluded / sparse).
 *
 *   node scripts/screenshot-detector/gen-synth-bags.mjs --count 8000 --out scripts/_cache/synth-detector-bags-v2
 *
 * Labels bags only. Occluded / build boards still draw item distractors.
 */
import fs from 'fs';
import path from 'path';
import { buildBagClassList, writeBagClassesArtifacts, buildClassList } from './classes.mjs';
import {
  loadEnv,
  loadCatalogWithTypes,
  loadBuildLayouts,
  ROOT,
} from './sample-layouts.mjs';
import { paintSynthBoard } from './paint-node.mjs';
import { augmentCanvas } from './augment.mjs';
import {
  denseBagBoard,
  occludedBagBoard,
  sparseBagBoard,
  randomBoard,
} from './random-board.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const count = Math.max(10, Number(arg('--count', '500')) | 0);
const outRoot = path.resolve(
  arg('--out', path.join(ROOT, 'scripts/_cache/synth-detector-bags-v2')),
);
const valFrac = 0.1;

const env = loadEnv();
console.error('Loading catalog + builds…');
const catalog = await loadCatalogWithTypes(env);
const layouts = await loadBuildLayouts(env);
const catalogById = new Map(catalog.map((c) => [c.id, c]));
const bagClassList = buildBagClassList(catalog);
const allClassList = buildClassList(catalog);
if (!bagClassList.classes.length) {
  console.error('No Bag classes in catalog');
  process.exit(1);
}
writeBagClassesArtifacts(bagClassList, outRoot);
const classById = bagClassList.byId;

const liveArtPath = path.join(ROOT, 'assets/data/item-live-art.json');
const liveArtRaw = JSON.parse(fs.readFileSync(liveArtPath, 'utf8'));
const liveArtById = liveArtRaw.items || liveArtRaw;

const displayPath = path.join(ROOT, 'assets/data/sprite-display.json');
const displayRaw = JSON.parse(fs.readFileSync(displayPath, 'utf8'));
const byImage = displayRaw.byImage || displayRaw;

const imagesTrain = path.join(outRoot, 'images/train');
const imagesVal = path.join(outRoot, 'images/val');
const labelsTrain = path.join(outRoot, 'labels/train');
const labelsVal = path.join(outRoot, 'labels/val');
for (const d of [imagesTrain, imagesVal, labelsTrain, labelsVal]) {
  fs.mkdirSync(d, { recursive: true });
}

/**
 * @param {{ id: string, x: number, y: number, r: number }[]} placements
 */
function filterKnown(placements) {
  return placements.filter((p) => catalogById.has(p.id));
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
 * Curriculum: ~50% build/realistic, ~30% occluded, ~20% dense.
 * @param {number} seed
 */
function pickPlacements(seed) {
  const roll = (seed * 9973) % 1;
  if (roll < 0.5) {
    if (layouts.length && Math.random() < 0.85) {
      const layout = layouts[(Math.random() * layouts.length) | 0];
      return filterKnown(layout.placements.map((p) => ({ ...p })));
    }
    return filterKnown(randomBoard(catalogById, allClassList.classes, seed));
  }
  if (roll < 0.8) {
    return occludedBagBoard(
      catalogById,
      bagClassList.classes,
      allClassList.classes,
      seed,
    );
  }
  if (Math.random() < 0.5) {
    return denseBagBoard(catalogById, bagClassList.classes, seed);
  }
  return sparseBagBoard(
    catalogById,
    bagClassList.classes,
    allClassList.classes,
    seed,
  );
}

let written = 0;
let trainN = 0;
let valN = 0;
let cleanN = 0;
let buildLikeN = 0;
/** @type {number[]} */
const uniqueBagCounts = [];

for (let i = 0; i < count; i++) {
  const seed = Math.random() + i * 1e-6;
  let placements = pickPlacements(seed);
  if (!placements.length) {
    placements = denseBagBoard(catalogById, bagClassList.classes, seed + 0.1);
  }
  if (!placements.length) continue;

  const bagIds = new Set(
    placements.filter((p) => catalogById.get(p.id)?.type === 'Bag').map((p) => p.id),
  );
  if (!bagIds.size) continue;
  uniqueBagCounts.push(bagIds.size);
  if (bagIds.size <= 8) buildLikeN += 1;

  const clean = Math.random() < 0.12;
  if (clean) cleanN += 1;
  const cellPx = clean ? 48 + ((Math.random() * 16) | 0) : 40 + ((Math.random() * 24) | 0);
  const leatherRgb = clean
    ? /** @type {[number, number, number]} */ ([88, 54, 36])
    : undefined;

  const painted = await paintSynthBoard({
    placements,
    catalogById,
    cellPx,
    liveArtById,
    byImage,
    leatherRgb,
  });

  const bagBoxes = painted.boxes.filter((b) => classById.has(b.classId));
  const aug = await augmentCanvas(
    painted.canvas,
    { boxes: bagBoxes },
    Math.random(),
  );
  const lines = yoloLines(aug.boxes, aug.canvas.width, aug.canvas.height);
  if (!lines.length) continue;

  const isVal = Math.random() < valFrac;
  const stem = `bag_${String(i).padStart(6, '0')}`;
  const imgDir = isVal ? imagesVal : imagesTrain;
  const lblDir = isVal ? labelsVal : labelsTrain;
  fs.writeFileSync(
    path.join(imgDir, `${stem}.jpg`),
    aug.canvas.toBuffer('image/jpeg', { quality: clean ? 0.95 : 0.9 }),
  );
  fs.writeFileSync(
    path.join(lblDir, `${stem}.txt`),
    lines.join('\n') + '\n',
  );
  written += 1;
  if (isVal) valN += 1;
  else trainN += 1;
  if (written % 100 === 0) console.error(`wrote ${written}/${count}`);
}

const avgUnique =
  uniqueBagCounts.length
    ? uniqueBagCounts.reduce((a, b) => a + b, 0) / uniqueBagCounts.length
    : 0;

const yaml = `path: ${outRoot.replace(/\\/g, '/')}
train: images/train
val: images/val
nc: ${bagClassList.classes.length}
names:
${bagClassList.classes.map((c) => `  ${c.index}: ${JSON.stringify(c.name)}`).join('\n')}
`;
fs.writeFileSync(path.join(outRoot, 'data.yaml'), yaml);

const summary = {
  out: outRoot,
  count: written,
  train: trainN,
  val: valN,
  classes: bagClassList.classes.length,
  cleanStills: cleanN,
  buildLikeApprox: buildLikeN,
  layoutsAvailable: layouts.length,
  avgUniqueBagsPerImage: Number(avgUnique.toFixed(2)),
};
fs.writeFileSync(path.join(outRoot, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.error(
  `bag classes → assets/data/detector-bag-classes.json (${bagClassList.classes.length})`,
);
