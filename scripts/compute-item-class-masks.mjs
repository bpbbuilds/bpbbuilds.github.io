/**
 * Compute per-item StuffedClasses bitmasks (game ItemDescriptor.calcClassAvailability)
 * → assets/data/item-class-masks.json
 *
 * Applies ItemData class_override (same as ItemBook / compute-library-layout.mjs).
 *
 *   node scripts/compute-item-class-masks.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildLibraryDescriptors, CLASS } from './lib/item-library-sim.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const itemsPath = path.join(__dirname, '_cache/game-items.json');
const recipesPath = path.join(__dirname, '_cache/game-recipes.json');
const itemDataPath = path.join(__dirname, '_cache/ItemData.csv');
const outPath = path.join(root, 'assets/data/item-class-masks.json');

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else if (ch !== '\r') cell += ch;
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
  if (!fs.existsSync(itemDataPath)) {
    console.warn('missing', itemDataPath, '— class_override skipped');
    return map;
  }
  for (const row of parseCsv(fs.readFileSync(itemDataPath, 'utf8'))) {
    const ov = String(row.class_override || '').trim();
    if (!ov) continue;
    map.set(String(row.name || '').trim(), ov);
  }
  return map;
}

const itemsData = loadJson(itemsPath);
const recipesData = fs.existsSync(recipesPath) ? loadJson(recipesPath) : [];
const recipes = Array.isArray(recipesData)
  ? recipesData
  : recipesData.recipes || [];
const overrides = loadClassOverrides();

const byName = buildLibraryDescriptors(itemsData.items || [], recipes, overrides);

/** @type {Record<string, number>} */
const byId = {};
for (const d of byName.values()) {
  if (d.id) byId[d.id] = d.classes;
}

const out = {
  source:
    'ItemDescriptor.calcClassAvailability + ItemData.class_override via item-library-sim',
  classBits: { ...CLASS },
  byId,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');

function countClass(bit) {
  let n = 0;
  for (const bits of Object.values(byId)) {
    if (bits !== CLASS.Neutral && bits !== CLASS.None && (bits & bit) > 0) n++;
  }
  return n;
}

console.log(
  `Wrote ${outPath} (${Object.keys(byId).length} ids, overrides=${overrides.size}, Ranger=${countClass(CLASS.Ranger)}, Pyromancer=${countClass(CLASS.Pyromancer)})`,
);
