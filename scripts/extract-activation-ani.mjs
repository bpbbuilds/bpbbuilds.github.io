/**
 * ItemData.animation + ItemBook bag/potion + Pumpkin → assets/data/sim-activation-ani.json
 * Also stamps activationAni onto scripts/_cache/game-items.json when present.
 *
 *   node scripts/extract-activation-ani.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ITEM_DATA = path.join(__dirname, '_cache', 'ItemData.csv');
const GAME_ITEMS = path.join(__dirname, '_cache', 'game-items.json');
const OUT = path.join(ROOT, 'assets', 'data', 'sim-activation-ani.json');

const ACTIVATION_ANI = [
  'Scale',
  'Jump',
  'SquishyJump',
  'VerySquishyJump',
  'Slash',
  'Stab',
  'Bonk',
  'ReverseBonk',
  'Chop',
  'Squish',
  'Block',
  'Wave',
  'Potion',
  'Sweep',
  'Spin',
  'Throw',
  'Shoot',
  'Struggle',
  'ReverseStab',
  'Hiss',
  'Tackle',
  'DoubleSlash',
  'Flash',
];
const ANI_NORM = new Map(
  ACTIVATION_ANI.map((a) => [a.toLowerCase().replace(/[^a-z]/g, ''), a]),
);

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

function resolveActivationAni(row) {
  const type = String(row.type || '').trim();
  const name = String(row.name || '').trim();
  if (/bag/i.test(type)) return 'Scale';
  if (/potion/i.test(type)) return 'Potion';
  if (slugify(name) === 'pumpkin') return 'Throw';
  const raw = String(row.animation || '').trim();
  if (!raw) return 'Jump';
  return ANI_NORM.get(raw.toLowerCase().replace(/[^a-z]/g, '')) || 'Jump';
}

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
  if (!rows.length) return [];
  const header = rows[0];
  return rows
    .slice(1)
    .filter((r) => r.some((x) => String(x).trim()))
    .map((r) => {
      const obj = {};
      for (let j = 0; j < header.length; j++) obj[header[j]] = r[j] ?? '';
      return obj;
    });
}

function main() {
  if (!fs.existsSync(ITEM_DATA)) {
    console.error('missing', ITEM_DATA);
    process.exit(1);
  }
  const rows = parseCsv(fs.readFileSync(ITEM_DATA, 'utf8'));
  /** @type {Record<string, string>} */
  const items = {};
  const counts = {};
  for (const row of rows) {
    const id = slugify(row.name);
    if (!id || id === 'item') continue;
    const ani = resolveActivationAni(row);
    items[id] = ani;
    counts[ani] = (counts[ani] || 0) + 1;
  }
  const extractedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    `${JSON.stringify({ source: 'ItemData.csv', extractedAt, items }, null, 2)}\n`,
  );

  if (fs.existsSync(GAME_ITEMS)) {
    const cache = JSON.parse(fs.readFileSync(GAME_ITEMS, 'utf8'));
    if (Array.isArray(cache.items)) {
      for (const it of cache.items) {
        if (it?.id && items[it.id]) it.activationAni = items[it.id];
      }
      cache.extractedAt = cache.extractedAt || extractedAt;
      fs.writeFileSync(GAME_ITEMS, JSON.stringify(cache, null, 2));
    }
  }

  console.log(JSON.stringify({ wrote: OUT, count: Object.keys(items).length, counts }, null, 2));
}

main();
