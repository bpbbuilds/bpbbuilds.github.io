/**
 * Build catalog WebP thumbs from assets/item-sprites/*.png.
 *
 * Source art is authored far larger than the Itemiary ever paints it (p50
 * texture 166x292 for an item that renders ~51px wide). Itemiary decode cost is
 * what makes catalog scrolling hitch, so the grid gets footprint-sized WebP
 * while spotlight / board / export keep the full PNG.
 *
 * Target size comes from sprite-display.json `w`/`h` (sprite size in cells, the
 * same numbers spriteSizeStyle renders with) x px-per-cell:
 *
 *   1x = 68 px/cell  - standard DPR (catalog cells run ~34-75px)
 *   2x = 136 px/cell - devicePixelRatio > 1.5
 *
 *   node scripts/build-sprite-thumbs.mjs [--force] [--quality=90]
 *
 * Writes assets/item-thumbs/{1x,2x}/{Stem}.webp + assets/data/sprite-thumbs.json.
 * Thumbs are committed; the source PNGs stay gitignored.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SPRITES_DIR = path.join(ROOT, 'assets', 'item-sprites');
const DISPLAY = path.join(ROOT, 'assets', 'data', 'sprite-display.json');
const THUMBS_DIR = path.join(ROOT, 'assets', 'item-thumbs');
const OUT = path.join(ROOT, 'assets', 'data', 'sprite-thumbs.json');

/** px per grid cell for each set - see header. */
const SETS = [
  { dir: '1x', cellPx: 68 },
  { dir: '2x', cellPx: 136 },
];

function parseArgs(argv) {
  const force = argv.includes('--force');
  let quality = 90;
  for (const arg of argv) {
    const m = /^--quality=(\d+)$/.exec(arg);
    if (m) quality = Math.min(100, Math.max(1, Number(m[1])));
  }
  return { force, quality };
}

/**
 * Thumb pixel size for one set. Never upscales: a sprite already smaller than
 * its target keeps source pixels (Godot art is not always oversampled).
 * @param {{ width: number, height: number }} img
 * @param {{ w: number, h: number }} cells
 * @param {number} cellPx
 */
function thumbSize(img, cells, cellPx) {
  const targetW = Math.max(1, Math.ceil(cells.w * cellPx));
  const targetH = Math.max(1, Math.ceil(cells.h * cellPx));
  const k = Math.min(1, img.width / targetW, img.height / targetH);
  return {
    w: Math.max(1, Math.round(targetW * k)),
    h: Math.max(1, Math.round(targetH * k)),
  };
}

/** Thumb is current when it is newer than the source PNG. */
function isFresh(outPath, srcMtimeMs) {
  try {
    return fs.statSync(outPath).mtimeMs >= srcMtimeMs;
  } catch {
    return false;
  }
}

async function main() {
  const { force, quality } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(SPRITES_DIR)) {
    console.error(`missing ${path.relative(ROOT, SPRITES_DIR)}`);
    process.exit(1);
  }
  if (!fs.existsSync(DISPLAY)) {
    console.error(
      `missing ${path.relative(ROOT, DISPLAY)} - run: npm run sprite-display`,
    );
    process.exit(1);
  }

  const byImage = JSON.parse(fs.readFileSync(DISPLAY, 'utf8')).byImage || {};
  for (const set of SETS) {
    fs.mkdirSync(path.join(THUMBS_DIR, set.dir), { recursive: true });
  }

  /** @type {string[]} */
  const images = [];
  let written = 0;
  let skipped = 0;
  let srcBytes = 0;
  let thumbBytes = 0;
  /** @type {string[]} */
  const missingSprite = [];

  for (const image of Object.keys(byImage).sort()) {
    const srcPath = path.join(SPRITES_DIR, image);
    let srcStat;
    try {
      srcStat = fs.statSync(srcPath);
    } catch {
      missingSprite.push(image);
      continue;
    }

    const meta = byImage[image];
    const cells = {
      w: Number(meta?.w) > 0 ? Number(meta.w) : 1,
      h: Number(meta?.h) > 0 ? Number(meta.h) : 1,
    };
    const outName = `${image.replace(/\.png$/i, '')}.webp`;
    const outPaths = SETS.map((set) => path.join(THUMBS_DIR, set.dir, outName));

    if (!force && outPaths.every((p) => isFresh(p, srcStat.mtimeMs))) {
      images.push(image);
      skipped += 1;
      for (const p of outPaths) thumbBytes += fs.statSync(p).size;
      srcBytes += srcStat.size;
      continue;
    }

    const img = await loadImage(srcPath);
    for (let i = 0; i < SETS.length; i += 1) {
      const size = thumbSize(img, cells, SETS[i].cellPx);
      const canvas = createCanvas(size.w, size.h);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size.w, size.h);
      const buf = canvas.toBuffer('image/webp', quality);
      fs.writeFileSync(outPaths[i], buf);
      thumbBytes += buf.length;
    }
    srcBytes += srcStat.size;
    images.push(image);
    written += 1;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'assets/item-sprites + assets/data/sprite-display.json',
    cell1x: SETS[0].cellPx,
    cell2x: SETS[1].cellPx,
    quality,
    count: images.length,
    images,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);

  const mb = (n) => (n / 1e6).toFixed(1);
  console.log(
    `sprite-thumbs: ${images.length} images (${written} written, ${skipped} fresh) -> ${path.relative(ROOT, THUMBS_DIR)}/{1x,2x}`,
  );
  console.log(
    `  ${mb(srcBytes)} MB PNG -> ${mb(thumbBytes)} MB WebP (both sets, q${quality})`,
  );
  console.log(`  manifest -> ${path.relative(ROOT, OUT)}`);
  if (missingSprite.length) {
    console.log(
      `  ${missingSprite.length} display entries have no PNG on disk (kept on PNG at runtime)`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
