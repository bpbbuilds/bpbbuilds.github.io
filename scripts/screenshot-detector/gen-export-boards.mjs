/**
 * 135 export-style boards (plus the 15 real snips = 150 labeled subjects).
 * Counts follow the uploaded-build medians. Writes augmented JPEG + YOLO labels.
 *
 *   node scripts/screenshot-detector/gen-export-boards.mjs
 */
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { ROOT } from './sample-layouts.mjs';
import { paintSynthBoard, BOARD_COLS, BOARD_ROWS } from './paint-node.mjs';
import { augmentCanvas } from './augment.mjs';

const BOARD_COUNT = Number(process.argv.find((a, i, arr) => arr[i - 1] === '--count') || 7000);
const SAMPLE_N = Number(process.argv.find((a, i, arr) => arr[i - 1] === '--sample') || 40);
const outRoot = path.join(ROOT, 'scripts/_cache/synth-detector-v7-export');
const classList = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts/_cache/synth-detector-v5/classes.json'), 'utf8'),
);
const classes = classList.classes;
const classById = new Map(classes.map((c) => [c.id, c]));
const shapes = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/item-shapes.json'), 'utf8')).byImage;
const liveArtRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/item-live-art.json'), 'utf8'));
const liveArtById = liveArtRaw.items || liveArtRaw;
const displayRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/sprite-display.json'), 'utf8'));
const byImage = displayRaw.byImage || displayRaw;

const catalogById = new Map(
  classes.map((c) => {
    const spritePath = path.join(ROOT, 'assets/item-sprites', `${c.image}.png`);
    return [c.id, { ...c, spritePath: fs.existsSync(spritePath) ? spritePath : null }];
  }),
);

const bagPool = ['Fanny Pack', 'Leather Bag', 'Potion Belt', 'Stamina Sack', 'Protective Purse', 'Offering Bowl']
  .map((name) => classes.find((c) => c.name === name))
  .filter(Boolean);
const skills = classes.filter((c) => c.type === 'Skill');
const gems = classes.filter((c) => c.type === 'Gem' || String(c.type).includes('Gemstone'));
const items = classes.filter(
  (c) => c.type !== 'Bag' && c.type !== 'Skill' && c.type !== 'Gem' && !String(c.type).includes('Gemstone'),
);

function bandFor(i, n = BOARD_COUNT) {
  if (i < Math.floor(n * 0.25)) return 'early';
  if (i < Math.floor(n * 0.5)) return 'mid';
  return 'late';
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bodyOf(item, face) {
  const matrix = shapes[`${item.image}.png`] || shapes[item.image] || [[1]];
  const body = [];
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) if (matrix[y][x] === 1) body.push({ x, y });
  }
  let pts = (body.length ? body : [{ x: 0, y: 0 }]).map((c) => ({ ...c }));
  const steps = ((face % 4) + 4) % 4;
  for (let s = 0; s < steps; s++) pts = pts.map((c) => ({ x: -c.y, y: c.x }));
  let minX = Infinity;
  let minY = Infinity;
  for (const c of pts) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
  }
  return pts.map((c) => ({ x: c.x - minX, y: c.y - minY }));
}

function tryPlace(item, rnd, blocked, within) {
  for (let n = 0; n < 80; n++) {
    const r = (rnd() * 4) | 0;
    const x = (rnd() * BOARD_COLS) | 0;
    const y = (rnd() * BOARD_ROWS) | 0;
    const cs = bodyOf(item, r).map((c) => ({ x: x + c.x, y: y + c.y }));
    if (cs.some((c) => c.x < 0 || c.y < 0 || c.x >= BOARD_COLS || c.y >= BOARD_ROWS)) continue;
    if (cs.some((c) => blocked.has(`${c.x},${c.y}`))) continue;
    if (within && cs.some((c) => !within.has(`${c.x},${c.y}`))) continue;
    for (const c of cs) blocked.add(`${c.x},${c.y}`);
    return { id: item.id, x, y, r };
  }
  return null;
}

function specFor(band, rnd) {
  if (band === 'early') {
    return { bagN: 3 + ((rnd() * 3) | 0), itemN: 6 + ((rnd() * 5) | 0), skillN: 0 };
  }
  if (band === 'mid') {
    return { bagN: 12 + ((rnd() * 5) | 0), itemN: 18 + ((rnd() * 6) | 0), skillN: 1 + ((rnd() * 2) | 0) };
  }
  return { bagN: 18 + ((rnd() * 5) | 0), itemN: 24 + ((rnd() * 5) | 0), skillN: 2 };
}

function makeBoard(seed, band) {
  const rnd = mulberry(seed);
  const spec = specFor(band, rnd);
  const bagBlocked = new Set();
  const placements = [];
  let guard = 0;
  while (placements.length < spec.bagN && guard < 600) {
    guard += 1;
    const bag = bagPool[(rnd() * bagPool.length) | 0];
    const p = tryPlace(bag, rnd, bagBlocked, null);
    if (p) placements.push(p);
  }
  const bagCells = new Set(bagBlocked);
  const itemBlocked = new Set();
  const placeN = (pool, n) => {
    let got = 0;
    let g = 0;
    while (got < n && g < 2500) {
      g += 1;
      const item = pool[(rnd() * pool.length) | 0];
      const p = tryPlace(item, rnd, itemBlocked, bagCells);
      if (!p) continue;
      placements.push(p);
      got += 1;
    }
  };
  placeN(skills, spec.skillN);
  const jewelN = rnd() < 0.12 ? 1 + ((rnd() * 2) | 0) : 0;
  placeN(gems, jewelN);
  placeN(items, spec.itemN);
  return placements;
}

if (process.argv.includes('--json')) {
  const step = Math.max(1, Math.floor(BOARD_COUNT / SAMPLE_N));
  const boards = [];
  for (let k = 0; k < SAMPLE_N; k++) {
    const i = Math.min(BOARD_COUNT - 1, k * step);
    const band = bandFor(i);
    const placements = makeBoard(1000 + i * 17, band).map((p) => ({
      ...p,
      name: classById.get(p.id)?.name || p.id,
    }));
    boards.push({
      id: `gen-${String(i).padStart(4, '0')}`,
      title: `${band} ${i + 1}`,
      scene: band === 'early' ? 'paper' : band === 'mid' ? 'shop' : 'battle',
      note: `Sample ${k + 1}/${SAMPLE_N} of ${BOARD_COUNT} generated boards. Counts follow the uploaded-run medians.`,
      placements,
    });
  }
  const out = path.join(ROOT, 'dev/export-check/generated-boards.json');
  fs.writeFileSync(out, JSON.stringify({ boards }, null, 2));
  console.log(`wrote ${boards.length} sample of ${BOARD_COUNT} -> ${out}`);
  process.exit(0);
}

const extract = path.join(ROOT, 'tools/game-extract-full/Assets');
const bgShop = await loadImage(path.join(extract, 'Shop/Shop.png'));
const bgPaper = await loadImage(path.join(extract, 'Paper1.png'));
const battleLayers = await Promise.all(
  ['Mountains', 'Hill3', 'Hill2', 'Hill1'].map((name) =>
    loadImage(path.join(extract, 'Background', `${name}.png`)),
  ),
);

function drawBackground(ctx, w, h, rnd) {
  const roll = rnd();
  const src = roll < 0.34 ? bgPaper : roll < 0.67 ? bgShop : null;
  if (src) {
    const zoom = 1 + rnd() * 1.2;
    const sw = Math.min(src.width, src.width / zoom);
    const sh = Math.min(src.height, (sw * h) / w);
    ctx.drawImage(
      src,
      rnd() * Math.max(0, src.width - sw),
      rnd() * Math.max(0, src.height - sh),
      sw,
      sh,
      0,
      0,
      w,
      h,
    );
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#7ec0e8');
  g.addColorStop(1, '#6f8f45');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  battleLayers.forEach((img, i) => {
    const dw = w * (1.15 + i * 0.08);
    const dh = dw * (img.height / img.width);
    ctx.drawImage(img, (w - dw) / 2, h * (0.2 + i * 0.14), dw, Math.max(dh, h * 0.5));
  });
}

function yoloLines(boxes, imgW, imgH) {
  const lines = [];
  for (const b of boxes) {
    const cls = classById.get(b.classId);
    if (!cls) continue;
    const bw = Math.max(1e-3, Math.min(1, b.bw / imgW));
    const bh = Math.max(1e-3, Math.min(1, b.bh / imgH));
    const cx = Math.max(bw / 2, Math.min(1 - bw / 2, b.cx / imgW));
    const cy = Math.max(bh / 2, Math.min(1 - bh / 2, b.cy / imgH));
    lines.push(`${cls.index} ${cx.toFixed(6)} ${cy.toFixed(6)} ${bw.toFixed(6)} ${bh.toFixed(6)}`);
  }
  return lines;
}

const imgDir = path.join(outRoot, 'images/train');
const lblDir = path.join(outRoot, 'labels/train');
fs.mkdirSync(imgDir, { recursive: true });
fs.mkdirSync(lblDir, { recursive: true });

const COPIES = 8;
let written = 0;
let skipped = 0;
const t0 = Date.now();
for (let i = 0; i < BOARD_COUNT; i++) {
  const done = [];
  for (let copy = 0; copy < COPIES; copy++) {
    const stem = `exp7k_${String(i).padStart(4, '0')}_${copy}`;
    if (fs.existsSync(path.join(imgDir, `${stem}.jpg`)) && fs.existsSync(path.join(lblDir, `${stem}.txt`))) {
      done.push(copy);
    }
  }
  if (done.length === COPIES) {
    skipped += COPIES;
    if ((i + 1) % 250 === 0) console.error(`boards ${i + 1}/${BOARD_COUNT} skip ${skipped} images ${written}`);
    continue;
  }
  const band = bandFor(i);
  const placements = makeBoard(1000 + i * 17, band);
  const cellPx = 48 + ((i * 13) % 70);
  const painted = await paintSynthBoard({
    placements,
    catalogById,
    cellPx,
    liveArtById,
    byImage,
    transparentBg: true,
  });
  if (!painted.boxes.length) continue;
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
  const cw = Math.max(8, x1 - x0);
  const ch = Math.max(8, y1 - y0);
  for (let copy = 0; copy < COPIES; copy++) {
    const rnd = mulberry(5000 + i * 20 + copy);
    const ml = cw * (0.08 + rnd() * 0.45);
    const mr = cw * (0.08 + rnd() * 0.45);
    const mt = ch * (0.08 + rnd() * 0.4);
    const mb = ch * (0.08 + rnd() * 0.4);
    let W = Math.round(cw + ml + mr);
    let H = Math.round(ch + mt + mb);
    const k = Math.min(1, 1024 / Math.max(W, H));
    W = Math.max(64, Math.round(W * k));
    H = Math.max(64, Math.round(H * k));
    const scene = createCanvas(W, H);
    const ctx = scene.getContext('2d');
    drawBackground(ctx, W, H, rnd);
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
    const stem = `exp7k_${String(i).padStart(4, '0')}_${copy}`;
    if (done.includes(copy)) continue;
    fs.writeFileSync(path.join(imgDir, `${stem}.jpg`), aug.canvas.toBuffer('image/jpeg', { quality: 0.9 }));
    fs.writeFileSync(path.join(lblDir, `${stem}.txt`), `${lines.join('\n')}\n`);
    written += 1;
  }
  if ((i + 1) % 250 === 0) console.error(`boards ${i + 1}/${BOARD_COUNT} images ${written}`);
}

const summary = {
  boards: BOARD_COUNT,
  plusRealSnips: 15,
  images: written,
  skipped,
  copies: COPIES,
  prefix: 'exp7k_',
  seconds: Math.round((Date.now() - t0) / 1000),
};
fs.writeFileSync(path.join(outRoot, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
