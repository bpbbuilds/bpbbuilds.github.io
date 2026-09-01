/**
 * Compute in-game sprite display size (cells) from Icon.scale × PNG size.
 *
 * Game cellSize = 80 (Item.gd). Item.tscn default Icon.scale is Vector2(2, 2);
 * child scenes inherit that unless they override. Bakes ignore Icon.scale, so
 * the catalog grid must re-apply it for every item.
 *
 * Prefer extract Icon PNG for pixel size. Use the site composite only when it
 * is larger AND the extract Icon does not already fill the collision footprint
 * (Hypercube / Mana Crystal). Fat CDN stills (LightninginaBottle) keep extract
 * sizing so display matches in-game Icon.scale.
 *
 *   node scripts/compute-sprite-display.mjs
 *
 * Writes assets/data/sprite-display.json keyed by image filename.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CELL = 80;
/** Item.tscn Icon default — not 1 */
const DEFAULT_ICON_SCALE = { x: 2, y: 2 };
const ITEMS_DIR_CANDIDATES = [
  path.join(ROOT, 'tools', 'game-extract-full', 'Items'),
  path.join(ROOT, 'tools', 'game-extract', 'Items'),
];
const ITEMS_DIR = ITEMS_DIR_CANDIDATES.find((d) => fs.existsSync(d));
const EXTRACT_ROOT = ITEMS_DIR ? path.dirname(ITEMS_DIR) : null;
const SPRITES_DIR = path.join(ROOT, 'assets', 'item-sprites');
const OUT = path.join(ROOT, 'assets', 'data', 'sprite-display.json');

if (!ITEMS_DIR || !EXTRACT_ROOT) {
  console.error('missing Items extract');
  process.exit(1);
}

function walkTscn(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTscn(full, acc);
    else if (ent.name.endsWith('.tscn')) acc.push(full);
  }
  return acc;
}

function pngSize(abs) {
  const buf = fs.readFileSync(abs);
  if (buf.toString('ascii', 1, 4) !== 'PNG') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function parseExt(text) {
  const map = new Map();
  for (const m of text.matchAll(
    /\[ext_resource[^\]]*path="([^"]+)"[^\]]*id=(\d+)\]/g,
  )) {
    map.set(m[2], m[1]);
  }
  for (const m of text.matchAll(
    /\[ext_resource[^\]]*id=(\d+)[^\]]*path="([^"]+)"\]/g,
  )) {
    map.set(m[1], m[2]);
  }
  return map;
}

function resToAbs(res) {
  if (!res?.startsWith('res://')) return null;
  const abs = path.join(
    EXTRACT_ROOT,
    res.slice('res://'.length).replace(/\//g, path.sep),
  );
  return fs.existsSync(abs) ? abs : null;
}

function iconBlock(text) {
  const m = text.match(
    /\[node name="Icon"[^\]]*\]([\s\S]*?)(?=\n\[node |\n*$)/,
  );
  return m ? m[1] : null;
}

function parseScale(block) {
  if (!block) return null;
  const m = block.match(/scale\s*=\s*Vector2\(\s*([^,]+),\s*([^)]+)\)/);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

const scaleCache = new Map();

/** Resolve Icon.scale walking parent PackedScene instances. */
function resolveIconScale(abs, seen = new Set()) {
  if (!abs || seen.has(abs)) {
    return { ...DEFAULT_ICON_SCALE, from: 'Item.tscn-default' };
  }
  if (scaleCache.has(abs)) return scaleCache.get(abs);
  seen.add(abs);

  const text = fs.readFileSync(abs, 'utf8');
  const own = parseScale(iconBlock(text));
  if (own) {
    const out = { ...own, from: path.basename(abs) };
    scaleCache.set(abs, out);
    return out;
  }

  const root = text.match(
    /\[node name="[^"]+"\s+instance=ExtResource\(\s*(\d+)\s*\)\]/,
  );
  if (root) {
    const parent = resToAbs(parseExt(text).get(root[1]));
    const out = resolveIconScale(parent, seen);
    scaleCache.set(abs, out);
    return out;
  }

  const out = { ...DEFAULT_ICON_SCALE, from: 'fallback' };
  scaleCache.set(abs, out);
  return out;
}

/** Godot 3 TileMap format-1 cell key → [x, y]. */
function decodeTileKey(key) {
  key = key | 0;
  let x = key & 0xffff;
  if (x >= 0x8000) x -= 0x10000;
  let y = (key >> 16) & 0xffff;
  if (y >= 0x8000) y -= 0x10000;
  return [x, y];
}

/** Icon node position in item space (px). */
function iconPosition(text) {
  const icon = iconBlock(text) || '';
  const m = icon.match(
    /position\s*=\s*Vector2\(\s*([^,]+),\s*([^)]+)\)/,
  );
  if (!m) return { x: 0, y: 0 };
  const x = Number(m[1]);
  const y = Number(m[2]);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

/**
 * CollisionMap body AABB (cells) + sprite anchor from Icon.position.
 * Occupied tile id 3 preferred; falls back to all tiles.
 */
function collisionLayout(text) {
  const sprite = iconPosition(text);
  let aabbCx = 0;
  let aabbCy = 0;
  let footW = 0;
  let footH = 0;

  const block = text.match(
    /\[node name="CollisionMap"[^\]]*\]([\s\S]*?)(?=\n\[node |\n*$)/,
  );
  if (block) {
    const body = block[1];
    const posM = body.match(
      /position\s*=\s*Vector2\(\s*([^,]+),\s*([^)]+)\)/,
    );
    const mapX = posM ? Number(posM[1]) : 0;
    const mapY = posM ? Number(posM[2]) : 0;
    const dataM = body.match(
      /tile_data\s*=\s*PoolIntArray\(\s*([^)]*)\)/,
    );
    if (dataM) {
      const nums = dataM[1]
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
      const cells = [];
      const bodyCells = [];
      for (let i = 0; i + 2 < nums.length; i += 3) {
        const xy = decodeTileKey(nums[i]);
        cells.push(xy);
        if (nums[i + 1] === 3) bodyCells.push(xy);
      }
      const use = bodyCells.length ? bodyCells : cells;
      if (use.length) {
        const centers = use.map(([cx, cy]) => ({
          x: mapX + cx * CELL + CELL / 2,
          y: mapY + cy * CELL + CELL / 2,
        }));
        const minX = Math.min(...centers.map((c) => c.x - CELL / 2));
        const maxX = Math.max(...centers.map((c) => c.x + CELL / 2));
        const minY = Math.min(...centers.map((c) => c.y - CELL / 2));
        const maxY = Math.max(...centers.map((c) => c.y + CELL / 2));
        aabbCx = (minX + maxX) / 2;
        aabbCy = (minY + maxY) / 2;
        footW = (maxX - minX) / CELL;
        footH = (maxY - minY) / CELL;
      }
    }
  }

  return {
    footW,
    footH,
    // Positive = sprite center right/down of AABB center
    anchorX: Math.round(((sprite.x - aabbCx) / CELL) * 1000) / 1000,
    anchorY: Math.round(((sprite.y - aabbCy) / CELL) * 1000) / 1000,
  };
}

function collisionAnchor(text) {
  const { anchorX, anchorY } = collisionLayout(text);
  return { x: anchorX, y: anchorY };
}

function resolvePng(full, text, fileStem) {
  // Prefer original game texture (bake adds a few px of canvas padding).
  const block = iconBlock(text) || '';
  const tex = block.match(/texture\s*=\s*ExtResource\(\s*(\d+)\s*\)/);
  if (tex) {
    const res = parseExt(text).get(tex[1]);
    const abs = resToAbs(res);
    if (abs) return abs;
  }

  // Walk parents for texture
  let abs = full;
  const seen = new Set();
  while (abs && !seen.has(abs)) {
    seen.add(abs);
    const t = fs.readFileSync(abs, 'utf8');
    const b = iconBlock(t) || '';
    const m = b.match(/texture\s*=\s*ExtResource\(\s*(\d+)\s*\)/);
    if (m) {
      const p = resToAbs(parseExt(t).get(m[1]));
      if (p) return p;
    }
    const root = t.match(
      /\[node name="[^"]+"\s+instance=ExtResource\(\s*(\d+)\s*\)\]/,
    );
    if (!root) break;
    abs = resToAbs(parseExt(t).get(root[1]));
  }

  const site = path.join(SPRITES_DIR, `${fileStem}.png`);
  return fs.existsSync(site) ? site : null;
}

function main() {
  const skip = new Set([
    'item.tscn',
    'bag.tscn',
    'weapon.tscn',
    'potion.tscn',
    'food.tscn',
    'card.tscn',
    'shield.tscn',
    'gem.tscn',
    'gemsocket.tscn',
    'socketsnode.tscn',
    'shadow.tscn',
  ]);

  const files = walkTscn(ITEMS_DIR);
  /** @type {Record<string, object>} */
  const byImage = {};

  for (const full of files) {
    const base = path.basename(full).toLowerCase();
    if (skip.has(base)) continue;

    const text = fs.readFileSync(full, 'utf8');
    // Must be an Item instance (or subclass) with an Icon somewhere in the chain
    if (!/instance=ExtResource/.test(text) && !iconBlock(text)) continue;

    const fileStem = path.basename(full, '.tscn');
    const image = `${fileStem}.png`;
    const scale = resolveIconScale(full);
    const sitePng = path.join(SPRITES_DIR, image);
    const extractPng = resolvePng(full, text, fileStem);
    if (!extractPng && !fs.existsSync(sitePng)) continue;

    const extractSize = extractPng ? pngSize(extractPng) : null;
    const siteSize = fs.existsSync(sitePng) ? pngSize(sitePng) : null;
    // Site bake/CDN stills can be much larger than the Icon texture
    // (Hypercube cubes, Mana Crystal rings, LightninginaBottle glow pad).
    // Size from the composite only when the extract Icon is clearly too small
    // for the collision footprint — otherwise extract scale matches the game
    // (Lightning Potion was ~3.1 cells tall from the fat CDN still vs ~1.8).
    const siteLarger =
      !!extractSize &&
      !!siteSize &&
      (siteSize.w > extractSize.w + 12 || siteSize.h > extractSize.h + 12);
    const layout = collisionLayout(text);
    const extractCellsW = extractSize
      ? (extractSize.w * scale.x) / CELL
      : 0;
    const extractCellsH = extractSize
      ? (extractSize.h * scale.y) / CELL
      : 0;
    const extractFillsFoot =
      layout.footW > 0 &&
      layout.footH > 0 &&
      extractCellsW >= layout.footW * 0.7 &&
      extractCellsH >= layout.footH * 0.7;
    const layered = siteLarger && !extractFillsFoot;
    const size = layered ? siteSize : extractSize || siteSize;
    if (!size) continue;

    const hasBagTiles = /name="TileMap"[^\n]*parent="Icon"/.test(text);
    const w = (size.w * scale.x) / CELL;
    const h = (size.h * scale.y) / CELL;
    const anchor = { x: layout.anchorX, y: layout.anchorY };

    byImage[image] = {
      iconScale: [scale.x, scale.y],
      scaleFrom: scale.from,
      texW: size.w,
      texH: size.h,
      w: Math.round(w * 1000) / 1000,
      h: Math.round(h * 1000) / 1000,
      bag: hasBagTiles,
      layered,
      texSource: layered ? 'site-composite' : extractSize ? 'extract' : 'site',
      anchorX: anchor.x,
      anchorY: anchor.y,
      fileStem,
    };
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const payload = {
    extractedAt: new Date().toISOString(),
    cellSize: CELL,
    defaultIconScale: [DEFAULT_ICON_SCALE.x, DEFAULT_ICON_SCALE.y],
    count: Object.keys(byImage).length,
    byImage,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(
    `sprite-display: ${payload.count} entries → ${path.relative(ROOT, OUT)}`,
  );
  for (const key of [
    'BoxofProsperity.png',
    'FannyPack.png',
    'Hypercube.png',
    'ManaCrystal.png',
    'ChippedRuby.png',
  ]) {
    console.log(key, byImage[key] || 'MISSING');
  }
}

main();
