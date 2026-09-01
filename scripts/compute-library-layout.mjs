/**
 * Precompute Item Library order + placements (game 1:1).
 *
 * Prerequisites:
 *   node scripts/extract-game-items.mjs
 *   node scripts/extract-game-recipes.mjs
 *
 * Usage:
 *   node scripts/compute-library-layout.mjs
 *
 * Writes:
 *   scripts/_cache/library-layout.json
 *   assets/data/library-layout.json  (served on GitHub Pages)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildLibraryDescriptors,
  sortLibraryDescriptors,
  librarySortScore,
} from './lib/item-library-sim.mjs';
import { packItems } from '../js/shared/backpack-grid/pack.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '_cache');
const ITEMS = path.join(CACHE, 'game-items.json');
const RECIPES = path.join(CACHE, 'game-recipes.json');
const ITEM_DATA = path.join(CACHE, 'ItemData.csv');
const OUT_CACHE = path.join(CACHE, 'library-layout.json');
const OUT_ASSETS = path.join(ROOT, 'assets', 'data', 'library-layout.json');

const COLS = 20;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, '');
  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    if (c === '\n' || (c === '\r' && s[i + 1] === '\n')) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += c === '\r' ? 2 : 1;
      continue;
    }
    if (c === '\r') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
      continue;
    }
    cell += c;
    i += 1;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = r[j] ?? '';
    return obj;
  });
}

function loadClassOverrides() {
  const map = new Map();
  if (!fs.existsSync(ITEM_DATA)) return map;
  for (const row of parseCsv(fs.readFileSync(ITEM_DATA, 'utf8'))) {
    const ov = String(row.class_override || '').trim();
    if (!ov) continue;
    map.set(String(row.name || '').trim(), ov);
  }
  return map;
}

function main() {
  if (!fs.existsSync(ITEMS)) {
    console.error('missing', ITEMS, '— run extract-game-items.mjs');
    process.exit(1);
  }
  if (!fs.existsSync(RECIPES)) {
    console.error('missing', RECIPES, '— run extract-game-recipes.mjs');
    process.exit(1);
  }

  const { items } = JSON.parse(fs.readFileSync(ITEMS, 'utf8'));
  const { recipes } = JSON.parse(fs.readFileSync(RECIPES, 'utf8'));
  const overrides = loadClassOverrides();

  const byName = buildLibraryDescriptors(items, recipes, overrides);
  const ordered = sortLibraryDescriptors(byName);

  const packInput = ordered.map((d) => ({
    id: d.id,
    name: d.displayName,
    type: d.type,
    shape: d.shape ?? [[1]],
  }));

  const { placements, cols, rows } = packItems(packInput, COLS, {
    compact: true,
  });

  const placeById = new Map(placements.map((p) => [p.id, p]));
  const itemCount = byName.size;
  const order = ordered.map((d, i) => {
    const p = placeById.get(d.id);
    return {
      id: d.id,
      gid: d.gid,
      name: d.displayName,
      index: i,
      x: p?.x ?? 0,
      y: p?.y ?? 0,
      score: librarySortScore(d, itemCount),
      classes: d.classes,
      crafted: d.crafted,
      gated: d.gated,
    };
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'ItemLibrary sim (Grouping.None, Compact, 20 cols)',
    cols,
    rows,
    count: order.length,
    excluded: items.length - order.length,
    order,
    placements: order.map(({ id, x, y }) => ({ id, x, y })),
  };

  fs.mkdirSync(path.dirname(OUT_CACHE), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_ASSETS), { recursive: true });
  fs.writeFileSync(OUT_CACHE, JSON.stringify(payload, null, 2));
  fs.writeFileSync(OUT_ASSETS, JSON.stringify(payload, null, 2));

  console.log(
    `library layout: ${order.length} items, ${cols}×${rows} → ${path.relative(ROOT, OUT_ASSETS)}`,
  );
  console.log(
    'first 12:',
    order
      .slice(0, 12)
      .map((o) => o.name)
      .join(', '),
  );
  console.log('excluded (class None / unreleased):', payload.excluded);
}

main();
