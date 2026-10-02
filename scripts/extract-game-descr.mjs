/**
 * Build name → DESCR template map from PHash translations (+ CSV fallback),
 * resolve against game-items.json → scripts/_cache/game-descr.json
 *
 * Prerequisites (one-time / when game extract updates):
 *   GDRE --bin-to-txt on Sheets/CSV/{Items,Full,ExclusiveItems}.en.translation
 *   into scripts/_cache/transl_tmp/<Name>/<Name>.en.translation
 *   (extract-game-descr will also try those paths if present)
 *
 * Usage:
 *   node scripts/extract-game-descr.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  gameTemplateToPlain,
  gemDescrKey,
  magicRingLibraryEffect,
  normKey,
} from './lib/game-descr.mjs';
import { mentionedStacksFromTemplate } from './lib/mentioned-stacks.mjs';
import { loadPHashTranslation, getMessageAny } from './lib/phash-translation.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '_cache');
const OUT = path.join(CACHE, 'game-descr.json');
const STACKS_OUT = path.join(ROOT, 'assets/data/item-mentioned-stacks.json');
const ITEMS_JSON = path.join(CACHE, 'game-items.json');

const EXCLUSIVE_CSV = path.join(
  ROOT,
  'tools/game-extract-full/Sheets/CSV/ExclusiveItems.csv',
);
const ASSETS_ITEMS = path.join(
  ROOT,
  'tools/game-extract-full/.assets/Sheets/CSV/Items.csv',
);
const ASSETS_FULL = path.join(
  ROOT,
  'tools/game-extract-full/.assets/Sheets/CSV/Full.csv',
);

const TRANSL_CANDIDATES = [
  path.join(CACHE, 'transl_tmp', 'Items', 'Items.en.translation'),
  path.join(CACHE, 'Items.en.translation'),
  path.join(CACHE, 'transl_tmp', 'Full', 'Full.en.translation'),
  path.join(CACHE, 'Full.en.translation'),
  path.join(CACHE, 'transl_tmp', 'ExclusiveItems', 'ExclusiveItems.en.translation'),
  path.join(CACHE, 'ExclusiveItems.en.translation'),
];

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
  const header = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((x) => String(x).trim()))
    .map((r) => {
      const obj = {};
      for (let j = 0; j < header.length; j++) obj[header[j]] = r[j] ?? '';
      return obj;
    });
}

/** Collect key → en from a localization CSV (fallback when PHash misses) */
function loadKeyedEn(filePath, into) {
  if (!fs.existsSync(filePath)) return 0;
  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  let n = 0;
  for (const row of rows) {
    const key = String(row.key || '').trim();
    const en = String(row.en || '').trim();
    if (!key || !en) continue;
    if (key.endsWith('_DESCR') || key.endsWith('_NAME') || key.endsWith('_FLAVOR')) {
      into.set(key, en);
      n++;
    }
  }
  return n;
}

function loadPhashTables() {
  const tables = [];
  const seen = new Set();
  for (const p of TRANSL_CANDIDATES) {
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) continue;
    const abs = path.resolve(p);
    if (seen.has(abs)) continue;
    seen.add(abs);
    try {
      tables.push({
        path: abs,
        table: loadPHashTranslation(fs.readFileSync(abs, 'utf8')),
      });
    } catch (e) {
      console.warn('skip bad translation', abs, e.message);
    }
  }
  return tables;
}

function main() {
  const phashTables = loadPhashTables();
  const csvKeys = new Map();
  loadKeyedEn(EXCLUSIVE_CSV, csvKeys);
  loadKeyedEn(ASSETS_FULL, csvKeys);
  loadKeyedEn(ASSETS_ITEMS, csvKeys);

  if (!fs.existsSync(ITEMS_JSON)) {
    console.error('missing', ITEMS_JSON, '— run extract-game-items.mjs first');
    process.exit(1);
  }
  const { items } = JSON.parse(fs.readFileSync(ITEMS_JSON, 'utf8'));

  const outItems = [];
  let hitPhash = 0;
  let hitCsv = 0;
  let hitGem = 0;
  let miss = 0;

  for (const item of items) {
    let descrKey = item.name;
    const gem = gemDescrKey(item.name);
    if (gem) {
      descrKey = gem;
      hitGem++;
    }

    const lookupKey = `${descrKey}_DESCR`;
    let template = null;
    let source = null;

    const fromPhash = getMessageAny(
      phashTables.map((t) => t.table),
      lookupKey,
    );
    if (fromPhash) {
      template = fromPhash;
      source = gem ? 'phash-gem' : 'phash';
      hitPhash++;
    } else if (csvKeys.has(lookupKey)) {
      template = csvKeys.get(lookupKey);
      source = gem ? 'csv-gem' : 'csv';
      hitCsv++;
    } else {
      // normKey fuzzy on CSV keys only
      for (const [k, v] of csvKeys) {
        if (!k.endsWith('_DESCR')) continue;
        if (normKey(k.slice(0, -6)) === normKey(descrKey)) {
          template = v;
          source = 'csv-fuzzy';
          hitCsv++;
          break;
        }
      }
    }

    if (!template) {
      if (item.id === 'magic_ring' || item.id === 'superior_ring') {
        const ring = magicRingLibraryEffect(
          item,
          phashTables.map((t) => t.table),
          getMessageAny,
        );
        if (ring?.effect) {
          outItems.push({
            id: item.id,
            gid: item.gid,
            name: item.name,
            descrKey,
            template: ring.template,
            effect: ring.effect,
            source: 'phash-ring',
          });
          hitPhash++;
          continue;
        }
      }
      miss++;
      outItems.push({
        id: item.id,
        gid: item.gid,
        name: item.name,
        descrKey,
        template: null,
        effect: null,
        source: null,
      });
      continue;
    }

    const effect = gameTemplateToPlain(template, item);
    outItems.push({
      id: item.id,
      gid: item.gid,
      name: item.name,
      descrKey,
      template,
      effect,
      source,
    });
  }

  const payload = {
    extractedAt: new Date().toISOString(),
    phashTables: phashTables.map((t) => t.path),
    csvKeys: [...csvKeys.keys()].filter((k) => k.endsWith('_DESCR')).length,
    withEffect: outItems.filter((x) => x.effect).length,
    missing: miss,
    hitPhash,
    hitCsv,
    hitGem,
    items: outItems,
  };
  /** Game ItemBook.detectMentionedStacks — DESCR `$cold` etc., not wiki prose */
  const byId = {};
  for (const row of outItems) {
    const stacks = mentionedStacksFromTemplate(row.template);
    if (stacks.length) byId[row.id] = stacks;
  }
  fs.mkdirSync(path.dirname(STACKS_OUT), { recursive: true });
  fs.writeFileSync(
    STACKS_OUT,
    JSON.stringify(
      {
        source: 'ItemBook.detectMentionedStacks via DESCR templates',
        extractedAt: payload.extractedAt,
        byId,
      },
      null,
      2,
    ),
  );

  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(
    JSON.stringify(
      {
        wrote: OUT,
        stacks: STACKS_OUT,
        withEffect: payload.withEffect,
        missing: payload.missing,
        hitPhash: payload.hitPhash,
        hitCsv: payload.hitCsv,
        coldCount: Object.values(byId).filter((s) => s.includes('Cold')).length,
        deathScythe: outItems.find((i) => i.name === 'Death Scythe'),
        warScythe: outItems.find((i) => i.name === 'War Scythe'),
        ratChef: outItems.find((i) => i.name === 'Rat Chef'),
      },
      null,
      2,
    ),
  );
}

main();
