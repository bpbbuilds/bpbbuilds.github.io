/**
 * Generate synthetic YOLO training data for the screenshot detector.
 *
 *   node scripts/screenshot-detector/gen-synth.mjs --count 500 --out scripts/_cache/synth-detector
 */
import fs from 'fs';
import path from 'path';
import { buildClassList, writeClassesArtifacts } from './classes.mjs';
import {
  loadEnv,
  loadCatalogWithTypes,
  loadBuildLayouts,
  ROOT,
} from './sample-layouts.mjs';
import { paintSynthBoard } from './paint-node.mjs';
import { augmentCanvas } from './augment.mjs';
import { randomBoard, sparseBoard } from './random-board.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const count = Math.max(10, Number(arg('--count', '200')) | 0);
const outRoot = path.resolve(arg('--out', path.join(ROOT, 'scripts/_cache/synth-detector')));
const valFrac = 0.1;

const env = loadEnv();
console.error('Loading catalog + builds…');
const catalog = await loadCatalogWithTypes(env);
const layouts = await loadBuildLayouts(env);
const catalogById = new Map(catalog.map((c) => [c.id, c]));
const classList = buildClassList(catalog);
writeClassesArtifacts(classList, outRoot);
const classById = classList.byId;

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
  return placements.filter((p) => classById.has(p.id) && catalogById.has(p.id));
}

/**
 * YOLO label lines from pixel boxes.
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
    // Clamp so box stays in-frame
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

let written = 0;
let trainN = 0;
let valN = 0;

for (let i = 0; i < count; i++) {
  const roll = Math.random();
  /** @type {{ id: string, x: number, y: number, r: number }[]} */
  let placements;
  if (roll < 0.7 && layouts.length) {
    const layout = layouts[(Math.random() * layouts.length) | 0];
    placements = filterKnown(layout.placements.map((p) => ({ ...p })));
    if (roll > 0.5 && classList.classes.length) {
      // rare boost: already in 20% bucket below — here just use build
    }
  } else if (roll < 0.9) {
    if (layouts.length && Math.random() < 0.5) {
      placements = filterKnown(
        layouts[(Math.random() * layouts.length) | 0].placements.map((p) => ({
          ...p,
        })),
      );
    } else {
      placements = filterKnown(
        randomBoard(catalogById, classList.classes, Math.random()),
      );
    }
    // Inject 1–2 random rare-ish items if space (simplified: append random board extras merged)
    const extra = filterKnown(
      randomBoard(catalogById, classList.classes, Math.random() + i).slice(0, 2),
    );
    // Only keep extras that don't duplicate ids at same cell — skip collision for synth simplicity
    placements = [...placements, ...extra.filter((e) => !placements.some((p) => p.id === e.id && p.x === e.x && p.y === e.y))];
  } else {
    placements = filterKnown(
      sparseBoard(catalogById, classList.classes, Math.random()),
    );
  }

  if (!placements.length) {
    placements = filterKnown(
      randomBoard(catalogById, classList.classes, Math.random()),
    );
  }
  if (!placements.length) continue;

  const cellPx = 40 + ((Math.random() * 24) | 0);
  const painted = await paintSynthBoard({
    placements,
    catalogById,
    cellPx,
    liveArtById,
    byImage,
  });

  const aug = await augmentCanvas(painted.canvas, { boxes: painted.boxes }, Math.random());
  const lines = yoloLines(aug.boxes, aug.canvas.width, aug.canvas.height);
  if (!lines.length && placements.length > 2) continue;

  const isVal = Math.random() < valFrac;
  const stem = `synth_${String(i).padStart(6, '0')}`;
  const imgDir = isVal ? imagesVal : imagesTrain;
  const lblDir = isVal ? labelsVal : labelsTrain;
  const imgPath = path.join(imgDir, `${stem}.jpg`);
  const lblPath = path.join(lblDir, `${stem}.txt`);
  fs.writeFileSync(imgPath, aug.canvas.toBuffer('image/jpeg', { quality: 0.92 }));
  fs.writeFileSync(lblPath, lines.join('\n') + (lines.length ? '\n' : ''));
  written += 1;
  if (isVal) valN += 1;
  else trainN += 1;
  if (written % 50 === 0) console.error(`wrote ${written}/${count}`);
}

const yaml = `path: ${outRoot.replace(/\\/g, '/')}
train: images/train
val: images/val
nc: ${classList.classes.length}
names:
${classList.classes.map((c) => `  ${c.index}: ${JSON.stringify(c.name)}`).join('\n')}
`;
fs.writeFileSync(path.join(outRoot, 'data.yaml'), yaml);

const summary = {
  out: outRoot,
  count: written,
  train: trainN,
  val: valN,
  classes: classList.classes.length,
  buildLayouts: layouts.length,
};
fs.writeFileSync(path.join(outRoot, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.error(`classes → assets/data/detector-classes.json (${classList.classes.length})`);
