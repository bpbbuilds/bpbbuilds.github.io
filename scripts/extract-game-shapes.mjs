/**
 * Parse Backpack Battles item .tscn CollisionMap tile_data → shape matrices.
 *
 * Tile ids (Item.tscn tileset):
 *   2 BagSpace  → body (1)  — bags use this for their own footprint
 *   3 Occupied  → body (1)
 *   4–5 Affected / CODEONLY Affected → star (2)
 *   6–7 Affected2 / CODEONLY Affected2 → diamond (3)
 *   8 extension → (4)
 *   10 tertiary → (5)
 *   11 lightning → (6)
 *
 * Inheritance: if a scene has no CollisionMap override, walk parent PackedScene
 * (Gem.tscn → 1×1, Item.tscn → 2×2, etc.).
 *
 * Usage:
 *   node scripts/extract-game-shapes.mjs
 *
 * Writes: scripts/_cache/game-shapes.json
 *         assets/data/socket-offsets.json
 *         assets/data/item-shapes.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSocketOffsetComputer } from './lib/game-socket-offsets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ITEMS_DIR_CANDIDATES = [
  path.join(ROOT, 'tools', 'game-extract-full', 'Items'),
  path.join(ROOT, 'tools', 'game-extract', 'Items'),
];
const ITEMS_DIR = ITEMS_DIR_CANDIDATES.find((d) => fs.existsSync(d));
const OUT = path.join(__dirname, '_cache', 'game-shapes.json');
const OUT_SOCKETS = path.join(ROOT, 'assets', 'data', 'socket-offsets.json');
const OUT_SHAPES = path.join(ROOT, 'assets', 'data', 'item-shapes.json');
/** Game Item.gd cellSize */
const CELL = 80;
if (!ITEMS_DIR) {
  console.error('missing Items extract — run keyed GDRE recover first');
  process.exit(1);
}

const RES_ITEMS = 'res://Items/';

/** @type {Map<string, string>} abs path → file text */
const fileCache = new Map();

function readFile(abs) {
  if (!fileCache.has(abs)) {
    fileCache.set(abs, fs.readFileSync(abs, 'utf8'));
  }
  return fileCache.get(abs);
}

function resToAbs(resPath) {
  if (!resPath.startsWith(RES_ITEMS)) return null;
  const rel = resPath.slice(RES_ITEMS.length).replace(/\//g, path.sep);
  const abs = path.join(ITEMS_DIR, rel);
  return fs.existsSync(abs) ? abs : null;
}

function decodePos(encoded) {
  let x = encoded & 0xffff;
  if (x >= 0x8000) x -= 0x10000;
  let y = (encoded >> 16) & 0xffff;
  if (y >= 0x8000) y -= 0x10000;
  return { x, y };
}

function tileIdToCell(tileId) {
  if (tileId === 2 || tileId === 3) return 1; // BagSpace / Occupied
  if (tileId === 4 || tileId === 5) return 2; // Affected → star
  if (tileId === 6 || tileId === 7) return 3; // Affected2 → diamond
  if (tileId === 8) return 4; // extension
  if (tileId === 10) return 5; // tertiary
  if (tileId === 11) return 6; // lightning
  return 0;
}

function tileDataToMatrix(tileDataInner) {
  const nums = tileDataInner
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s));
  if (nums.length < 3 || nums.length % 3 !== 0) return null;

  const cells = new Map();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < nums.length; i += 3) {
    const pos = decodePos(nums[i]);
    const v = tileIdToCell(nums[i + 1]);
    if (!v) continue;
    cells.set(`${pos.x},${pos.y}`, v);
    if (pos.x < minX) minX = pos.x;
    if (pos.y < minY) minY = pos.y;
    if (pos.x > maxX) maxX = pos.x;
    if (pos.y > maxY) maxY = pos.y;
  }

  if (!cells.size || !Number.isFinite(minX)) return null;

  const matrix = [];
  for (let y = minY; y <= maxY; y += 1) {
    const row = [];
    for (let x = minX; x <= maxX; x += 1) {
      row.push(cells.get(`${x},${y}`) || 0);
    }
    matrix.push(row);
  }
  return matrix;
}

/** First CollisionMap tile_data in a scene (not Icon/TileMap overlays). */
function extractCollisionTileData(text) {
  const m = text.match(
    /\[node name="CollisionMap"[^\]]*\][\s\S]*?tile_data\s*=\s*PoolIntArray\(\s*([^)]*)\s*\)/,
  );
  return m ? m[1] : null;
}

function parseExtResources(text) {
  const map = new Map();
  for (const m of text.matchAll(
    /\[ext_resource path="([^"]+)"[^\]]*id=(\d+)\]/g,
  )) {
    map.set(m[2], m[1]);
  }
  return map;
}

function rootInstanceParent(text) {
  const m = text.match(
    /\[node name="([^"]+)"\s+instance=ExtResource\(\s*(\d+)\s*\)\]/,
  );
  if (!m) return null;
  const ext = parseExtResources(text);
  return { nodeName: m[1], parentRes: ext.get(m[2]) || null };
}

function slugify(name) {
  return (
    String(name || '')
      .toLowerCase()
      .replace(/['']/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80) || 'item'
  );
}

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

const { computeSocketOffsets: computeSocketOffsetsRaw, extractGemLocals } =
  createSocketOffsetComputer({
    cell: CELL,
    defaultIconScale: { x: 2, y: 2 },
    defaultSocketsScale: { x: 0.5, y: 0.5 },
    readFile,
    resToAbs,
    rootInstanceParent,
    decodePos,
  });

/** @param {string} itemAbs @param {string} shapeSourceRel */
function computeSocketOffsets(itemAbs, shapeSourceRel) {
  return computeSocketOffsetsRaw(itemAbs, shapeSourceRel, ITEMS_DIR);
}

/**
 * Resolve shape for a .tscn, walking parent scenes when CollisionMap is inherited.
 * @param {string} absPath
 * @param {Set<string>} [seen]
 */
function resolveShape(absPath, seen = new Set()) {
  if (!absPath || seen.has(absPath)) return null;
  seen.add(absPath);
  const text = readFile(absPath);

  const own = extractCollisionTileData(text);
  if (own) {
    const shape = tileDataToMatrix(own);
    if (shape) {
      return {
        shape,
        source: path.relative(ITEMS_DIR, absPath).replace(/\\/g, '/'),
        inherited: seen.size > 1,
      };
    }
  }

  const root = rootInstanceParent(text);
  if (root?.parentRes) {
    const parentAbs = resToAbs(root.parentRes);
    if (parentAbs) return resolveShape(parentAbs, seen);
  }
  return null;
}

function main() {
  const files = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        // Still skip art/support dirs — but INCLUDE Gems (shapes inherit Gem.tscn)
        if (
          /^(Animations|Materials|Particles|Sprites|Tiles|Masks)$/i.test(
            ent.name,
          )
        ) {
          continue;
        }
        walk(full);
      } else if (ent.name.endsWith('.tscn')) {
        files.push(full);
      }
    }
  }
  walk(ITEMS_DIR);

  // Base/template scenes — not catalog items (except we may inherit from them)
  const skipFiles = new Set([
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
    'catalystbond.tscn',
    'craftingbond.tscn',
    'craftingpreviewbond.tscn',
    'electricalcharge.tscn',
  ]);

  const rows = [];
  const missing = [];
  const seenNorm = new Set();
  let inheritedCount = 0;

  for (const full of files) {
    const base = path.basename(full);
    if (skipFiles.has(base.toLowerCase())) continue;

    const text = readFile(full);
    const root = rootInstanceParent(text);
    const fileStem = path.basename(full, '.tscn');
    const nodeName = root?.nodeName || fileStem;

    const resolved = resolveShape(full);
    if (!resolved) {
      missing.push(path.relative(ITEMS_DIR, full).replace(/\\/g, '/'));
      continue;
    }
    if (resolved.inherited) inheritedCount++;

    const name = nodeName;
    const id = slugify(name);
    const fileId = slugify(
      fileStem.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'),
    );
    const keys = [normKey(name), normKey(fileStem), normKey(id), normKey(fileId)];
    const socketOffsets = computeSocketOffsets(full, resolved.source);
    const sockets = socketOffsets.length || extractGemLocals(text).length || null;

    const row = {
      file: base,
      name,
      fileStem,
      id,
      fileId: fileId !== id ? fileId : undefined,
      normKeys: [...new Set(keys.filter(Boolean))],
      sockets,
      socketOffsets,
      shape: resolved.shape,
      inherited: !!resolved.inherited,
      shapeSource: resolved.source,
      rel: path.relative(ITEMS_DIR, full).replace(/\\/g, '/'),
    };

    // Dedupe by primary id when possible; keep both keys for matching
    const primary = row.normKeys[0];
    if (seenNorm.has(primary) && seenNorm.has(normKey(fileStem))) {
      row.id = `${row.id}__${path.basename(path.dirname(full)).toLowerCase()}`;
    }
    for (const k of row.normKeys) seenNorm.add(k);
    rows.push(row);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        source: 'game-tscn',
        count: rows.length,
        inheritedCount,
        missingCollision: missing.length,
        items: rows,
      },
      null,
      2,
    ),
  );

  /** @type {Record<string, { x: number, y: number }[]>} */
  const byImage = {};
  /** @type {Record<string, { x: number, y: number }[]>} */
  const byId = {};
  let withSockets = 0;
  for (const row of rows) {
    if (!row.socketOffsets?.length) continue;
    withSockets += 1;
    byImage[`${row.fileStem}.png`] = row.socketOffsets;
    byId[row.id] = row.socketOffsets;
    if (row.fileId) byId[row.fileId] = row.socketOffsets;
  }
  fs.mkdirSync(path.dirname(OUT_SOCKETS), { recursive: true });
  fs.writeFileSync(
    OUT_SOCKETS,
    JSON.stringify(
      {
        extractedAt: new Date().toISOString(),
        cellSize: CELL,
        count: withSockets,
        byImage,
        byId,
      },
      null,
      2,
    ),
  );

  /** @type {Record<string, number[][]>} */
  const shapesByImage = {};
  /** @type {Record<string, number[][]>} */
  const shapesById = {};
  for (const row of rows) {
    if (!row.shape) continue;
    shapesByImage[`${row.fileStem}.png`] = row.shape;
    shapesById[row.id] = row.shape;
    if (row.fileId) shapesById[row.fileId] = row.shape;
  }
  fs.writeFileSync(
    OUT_SHAPES,
    JSON.stringify(
      {
        extractedAt: new Date().toISOString(),
        count: rows.length,
        byImage: shapesByImage,
        byId: shapesById,
      },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        wrote: OUT,
        socketOffsets: OUT_SOCKETS,
        itemShapes: OUT_SHAPES,
        shapes: rows.length,
        withSockets,
        inheritedCount,
        stillMissingTscn: missing.length,
      },
      null,
      2,
    ),
  );
}

main();
