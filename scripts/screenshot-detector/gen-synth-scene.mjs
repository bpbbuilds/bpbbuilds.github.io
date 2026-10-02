/**
 * Scene synth for the item detector: boards composited on real game backgrounds
 * (shop room, paper, black build-page export) with large cells and tight/loose crops.
 * Class order must match the live item model (assets/data/detector-classes.json).
 *
 *   node scripts/screenshot-detector/gen-synth-scene.mjs --count 2500 --shard 0 --out scripts/_cache/synth-detector-v3
 */
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { extendLiveClassList, writeClassesArtifacts } from './classes.mjs';
import { loadEnv, loadCatalogWithTypes, loadBuildLayouts, ROOT } from './sample-layouts.mjs';
import { BOARD_COLS, BOARD_ROWS, paintSynthBoard, placementAabb } from './paint-node.mjs';
import { augmentCanvas } from './augment.mjs';
import { randomBoard, occludedBagBoard } from './random-board.mjs';
import { loadShapeIndex } from '../screenshot-to-build/shapes.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const count = Math.max(1, Number(arg('--count', '200')) | 0);
const shard = Math.max(0, Number(arg('--shard', '0')) | 0);
const outRoot = path.resolve(arg('--out', path.join(ROOT, 'scripts/_cache/synth-detector-v3')));
const valFrac = 0.08;
const MAX_SIDE = 1024;

const STARTER_NAMES = [
  'Wooden Sword', 'Wooden Buckler', 'Piggybank', 'Shortbow', 'Broom', 'Stone', 'Banana',
  'Garlic', 'Walnuts', 'Pan', 'Leather Armor', 'Torch', 'Carrot', 'Healing Herbs',
  'Health Potion', 'Mana Potion', 'Stamina Potion', 'Whetstone', 'Lump of Coal',
  'Pocket Sand', 'Dagger', 'Hero Sword', 'Spear', 'Axe', 'Goobert', 'Blueberries',
  'Leather Boots', 'Leather Helm', 'Bow and Arrow', 'Flute', 'Clover', 'Amulet of Steel',
];
const STARTER_BAG_NAMES = ['Leather Bag', 'Leather Bag', 'Leather Bag', 'Fanny Pack', 'Stamina Sack', 'Protective Purse'];

const env = loadEnv();
const catalog = await loadCatalogWithTypes(env);
const layouts = await loadBuildLayouts(env);
const catalogById = new Map(catalog.map((c) => [c.id, c]));
const shapeIndex = loadShapeIndex(catalog);
const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/detector-classes.json'), 'utf8'));
const classList = extendLiveClassList(catalog, live);
writeClassesArtifacts(classList, outRoot, { assetsPath: null });
if (shard === 0) {
  console.error(
    `classes ${classList.classes.length} (live ${live.classes.length} + ${classList.classes.length - live.classes.length} new)`,
  );
}
const classById = classList.byId;

const liveArtRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/item-live-art.json'), 'utf8'));
const liveArtById = liveArtRaw.items || liveArtRaw;
const displayRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/sprite-display.json'), 'utf8'));
const byImage = displayRaw.byImage || displayRaw;

const byName = new Map(catalog.map((c) => [String(c.name), c]));
const starterItems = STARTER_NAMES.map((n) => byName.get(n)).filter((c) => c && classById.has(c.id));
const starterBags = STARTER_BAG_NAMES.map((n) => byName.get(n)).filter((c) => c && classById.has(c.id));
const itemClasses = classList.classes.filter((c) => c.type !== 'Bag');
const skillClasses = classList.classes.filter((c) => c.type === 'Skill');
const jewelClasses = classList.classes.filter((c) => c.type === 'Gem' || c.type.includes('Gemstone'));
const bagClasses = classList.classes.filter((c) => c.type === 'Bag');
if (shard === 0 || shard === 99) {
  const missing = STARTER_NAMES.filter((n) => !starterItems.some((c) => c.name === n));
  console.error(`starter items ${starterItems.length}/${STARTER_NAMES.length}; bags ${starterBags.length}; missing: ${missing.join(', ')}`);
}

const extract = path.join(ROOT, 'tools/game-extract-full/Assets');
const bgShop = await loadImage(path.join(extract, 'Shop/Shop.png'));
const bgPaper = await loadImage(path.join(extract, 'Paper1.png'));
const battleLayers = await Promise.all(
  ['Mountains', 'Hill3', 'Hill2', 'Hill1'].map((n) => loadImage(path.join(extract, 'Background', `${n}.png`))),
);
const battleShare = Number(arg('--battle', '0'));
/** Sky top/bottom + tint for day / dusk / night battle scenes. */
const SKIES = [
  [[120, 170, 210], [210, 225, 230], null],
  [[230, 150, 110], [250, 210, 160], 'rgba(160,70,40,0.18)'],
  [[60, 40, 90], [120, 80, 120], 'rgba(70,40,110,0.35)'],
  [[40, 45, 80], [90, 90, 130], 'rgba(30,30,80,0.35)'],
];

for (const split of ['train', 'val']) {
  fs.mkdirSync(path.join(outRoot, 'images', split), { recursive: true });
  fs.mkdirSync(path.join(outRoot, 'labels', split), { recursive: true });
}

const rnd = Math.random;
const pick = (arr) => arr[(rnd() * arr.length) | 0];

/**
 * @param {string} id
 * @param {number} r
 * @param {Set<string>} occupied
 * @param {Set<string> | null} within  cells an item must sit on (bag cells)
 */
function place(id, r, occupied, within) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = (rnd() * BOARD_COLS) | 0;
    const y = (rnd() * BOARD_ROWS) | 0;
    const box = placementAabb(shapeIndex, id, { x, y, r });
    if (box.x + box.w > BOARD_COLS || box.y + box.h > BOARD_ROWS) continue;
    const cells = [];
    let ok = true;
    for (let dy = 0; dy < box.h && ok; dy++) {
      for (let dx = 0; dx < box.w; dx++) {
        const k = `${box.x + dx},${box.y + dy}`;
        if (occupied.has(k) || (within && !within.has(k))) {
          ok = false;
          break;
        }
        cells.push(k);
      }
    }
    if (!ok) continue;
    for (const k of cells) occupied.add(k);
    return { id, x: box.x, y: box.y, r };
  }
  return null;
}

/** Compact starter-style board: a few common bags, mostly starter items. */
function starterBoard() {
  const occupied = new Set();
  const placements = [];
  const nBags = 1 + ((rnd() * 4) | 0);
  const leather = byName.get('Leather Bag');
  if (leather && rnd() < 0.5) {
    // Tight grid of leather bags like an early-round board.
    const cols = nBags >= 2 ? 2 : 1;
    const ox = (rnd() * (BOARD_COLS - cols * 2 + 1)) | 0;
    const oy = (rnd() * (BOARD_ROWS - Math.ceil(nBags / cols) * 2 + 1)) | 0;
    for (let i = 0; i < nBags; i++) {
      const x = ox + (i % cols) * 2;
      const y = oy + Math.floor(i / cols) * 2;
      if (y + 2 > BOARD_ROWS) break;
      placements.push({ id: leather.id, x, y, r: 0 });
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) occupied.add(`${x + dx},${y + dy}`);
    }
  } else {
    for (let i = 0; i < nBags; i++) {
      const p = place(pick(starterBags).id, (rnd() * 4) | 0, occupied, null);
      if (p) placements.push(p);
    }
  }
  const bagCells = new Set(occupied);
  const itemOccupied = new Set();
  const nItems = 1 + ((rnd() * 7) | 0);
  for (let i = 0; i < nItems; i++) {
    const src = rnd() < 0.7 ? pick(starterItems) : catalogById.get(pick(itemClasses).id);
    if (!src) continue;
    const p = place(src.id, (rnd() * 4) | 0, itemOccupied, bagCells);
    if (p) placements.push(p);
  }
  return placements;
}

function sampleBoard() {
  const roll = rnd();
  const known = (list) => list.filter((p) => classById.has(p.id) && catalogById.has(p.id));
  /** @type {{ id: string, x: number, y: number, r: number }[]} */
  let placements;
  if (roll < 0.35) placements = starterBoard();
  else if (roll < 0.7 && layouts.length) placements = known(pick(layouts).placements.map((p) => ({ ...p })));
  else if (roll < 0.85) placements = known(randomBoard(catalogById, classList.classes, rnd()));
  else placements = known(occludedBagBoard(catalogById, bagClasses, itemClasses, rnd()));
  return sprinkleSkillsAndJewels(placements);
}

/**
 * Public and starter boards often omit skills/jewels — add a few so those classes get boxes.
 * @param {{ id: string, x: number, y: number, r: number }[]} placements
 */
function sprinkleSkillsAndJewels(placements) {
  const occupied = new Set();
  /** @type {Set<string>} */
  const bagCells = new Set();
  for (const p of placements) {
    const box = placementAabb(shapeIndex, p.id, p);
    const isBag = catalogById.get(p.id)?.type === 'Bag';
    for (let dy = 0; dy < box.h; dy++) {
      for (let dx = 0; dx < box.w; dx++) {
        const k = `${box.x + dx},${box.y + dy}`;
        occupied.add(k);
        if (isBag) bagCells.add(k);
      }
    }
  }
  const used = new Set(placements.map((p) => p.id));
  const addPool = (pool, maxN) => {
    const want = (rnd() * (maxN + 1)) | 0;
    let got = 0;
    const order = [...pool].sort(() => rnd() - 0.5);
    for (const item of order) {
      if (got >= want) break;
      if (used.has(item.id)) continue;
      const p = place(item.id, (rnd() * 4) | 0, occupied, bagCells.size ? bagCells : null);
      if (p) {
        placements.push(p);
        used.add(item.id);
        got += 1;
      }
    }
  };
  addPool(skillClasses, 2);
  addPool(jewelClasses, 3);
  return placements;
}

/**
 * @param {import('@napi-rs/canvas').SKRSContext2D} ctx
 * @param {number} w
 * @param {number} h
 */
function drawBackground(ctx, w, h) {
  if (rnd() < battleShare) {
    const [top, bottom, tint] = pick(SKIES);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, `rgb(${top.join(',')})`);
    g.addColorStop(1, `rgb(${bottom.join(',')})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // Parallax layers: wide strips anchored low, random horizontal pan.
    const span = w * (1.2 + rnd() * 1.5);
    const hue = [(rnd() * 120) | 0, (rnd() * 90) | 0, (60 + rnd() * 100) | 0];
    battleLayers.forEach((img, i) => {
      const lh = (span * img.height) / img.width;
      const y = h * (0.25 + i * 0.12 + rnd() * 0.1);
      // Game tints these greyscale layers in a shader; fake it with a source-atop wash.
      const layer = createCanvas(w, h);
      const lc = layer.getContext('2d');
      lc.drawImage(img, -rnd() * (span - w), y, span, Math.max(lh, h - y));
      lc.globalCompositeOperation = 'source-atop';
      const dark = 1 - i * 0.18;
      lc.fillStyle = `rgba(${(hue[0] * dark) | 0},${(hue[1] * dark) | 0},${(hue[2] * dark) | 0},${0.35 + rnd() * 0.35})`;
      lc.fillRect(0, 0, w, h);
      ctx.drawImage(layer, 0, 0);
    });
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, w, h);
    }
    return;
  }
  const roll = rnd();
  if (roll < 0.55 || roll >= 0.85) {
    const img = roll < 0.55 ? bgShop : bgPaper;
    // Cover the canvas with a random region of the background at a random zoom.
    const zoom = 1 + rnd() * 1.5;
    const sw = Math.min(img.width, img.width / zoom);
    const sh = Math.min(img.height, (sw * h) / w);
    const sx = rnd() * Math.max(0, img.width - sw);
    const sy = rnd() * Math.max(0, img.height - sh);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    return;
  }
  const dark = rnd() < 0.6 ? [0, 0, 0] : [40 + rnd() * 40, 26 + rnd() * 20, 16 + rnd() * 12];
  ctx.fillStyle = `rgb(${dark.map((v) => v | 0).join(',')})`;
  ctx.fillRect(0, 0, w, h);
}

function yoloLines(boxes, imgW, imgH) {
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

let written = 0;
const t0 = Date.now();
for (let i = 0; i < count; i++) {
  const placements = sampleBoard();
  if (!placements.length) continue;
  // Classic full-board-on-leather style keeps what v1 already learned.
  const plain = rnd() < 0.25;
  const cellPx = plain ? 40 + ((rnd() * 24) | 0) : 40 + ((rnd() * 90) | 0);
  const painted = await paintSynthBoard({
    placements,
    catalogById,
    cellPx,
    liveArtById,
    byImage,
    transparentBg: !plain,
  });
  if (!painted.boxes.length) continue;
  if (plain) {
    const aug = await augmentCanvas(painted.canvas, { boxes: painted.boxes }, rnd());
    const lines = yoloLines(aug.boxes, aug.canvas.width, aug.canvas.height);
    if (!lines.length) continue;
    const split = rnd() < valFrac ? 'val' : 'train';
    const stem = `plain_s${shard}_${String(i).padStart(6, '0')}`;
    fs.writeFileSync(
      path.join(outRoot, 'images', split, `${stem}.jpg`),
      aug.canvas.toBuffer('image/jpeg', { quality: 0.9 }),
    );
    fs.writeFileSync(path.join(outRoot, 'labels', split, `${stem}.txt`), `${lines.join('\n')}\n`);
    written += 1;
    continue;
  }

  // Content bounds from label boxes, then crop tight-to-loose around them.
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of painted.boxes) {
    x0 = Math.min(x0, b.cx - b.bw / 2);
    y0 = Math.min(y0, b.cy - b.bh / 2);
    x1 = Math.max(x1, b.cx + b.bw / 2);
    y1 = Math.max(y1, b.cy + b.bh / 2);
  }
  const cw = x1 - x0;
  const ch = y1 - y0;
  const loose = rnd() < 0.25;
  const ml = cw * (loose ? 0.4 + rnd() * 1.2 : 0.03 + rnd() * 0.35);
  const mr = cw * (loose ? 0.4 + rnd() * 1.2 : 0.03 + rnd() * 0.35);
  const mt = ch * (loose ? 0.3 + rnd() * 0.8 : 0.03 + rnd() * 0.35);
  const mb = ch * (loose ? 0.3 + rnd() * 0.8 : 0.03 + rnd() * 0.35);
  let W = Math.round(cw + ml + mr);
  let H = Math.round(ch + mt + mb);
  const k = Math.min(1, MAX_SIDE / Math.max(W, H));
  W = Math.max(64, Math.round(W * k));
  H = Math.max(64, Math.round(H * k));

  const scene = createCanvas(W, H);
  const ctx = scene.getContext('2d');
  drawBackground(ctx, W, H);
  const ox = (ml - x0) * k;
  const oy = (mt - y0) * k;
  ctx.drawImage(painted.canvas, ox, oy, painted.canvas.width * k, painted.canvas.height * k);
  const boxes = painted.boxes.map((b) => ({
    ...b,
    cx: b.cx * k + ox,
    cy: b.cy * k + oy,
    bw: b.bw * k,
    bh: b.bh * k,
  }));

  const aug = await augmentCanvas(scene, { boxes }, rnd());
  const lines = yoloLines(aug.boxes, aug.canvas.width, aug.canvas.height);
  if (!lines.length) continue;

  const split = rnd() < valFrac ? 'val' : 'train';
  const stem = `scene_s${shard}_${String(i).padStart(6, '0')}`;
  fs.writeFileSync(
    path.join(outRoot, 'images', split, `${stem}.jpg`),
    aug.canvas.toBuffer('image/jpeg', { quality: 0.9 }),
  );
  fs.writeFileSync(path.join(outRoot, 'labels', split, `${stem}.txt`), `${lines.join('\n')}\n`);
  written += 1;
  if (written % 100 === 0) {
    const rate = written / ((Date.now() - t0) / 1000);
    console.error(`shard ${shard}: ${written}/${count} (${rate.toFixed(1)}/s)`);
  }
}
if (shard === 0) {
  const yaml = `path: ${outRoot.replace(/\\/g, '/')}
train: images/train
val: images/val
nc: ${classList.classes.length}
names:
${classList.classes.map((c) => `  ${c.index}: ${JSON.stringify(c.name)}`).join('\n')}
`;
  fs.writeFileSync(path.join(outRoot, 'data.yaml'), yaml);
}
console.log(JSON.stringify({ shard, written, seconds: Math.round((Date.now() - t0) / 1000), classes: classList.classes.length }));
