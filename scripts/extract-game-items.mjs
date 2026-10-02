/**
 * Parse decrypted ItemData.csv (+ optional shapes/sprites) → game-items.json
 *
 * Prerequisites:
 *   node scripts/decrypt-itemdata.mjs
 *   node scripts/extract-game-shapes.mjs   (optional)
 *   node scripts/extract-game-sprites.mjs  (optional; Icon textures → assets/item-sprites)
 *
 * Usage:
 *   node scripts/extract-game-items.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadPHashTranslation, getMessageAny } from './lib/phash-translation.mjs';
import {
  buildSpriteIndex,
  fileStem,
  loadGameSpriteMap,
  matchSprite,
  resolveGameSpritesJson,
  resolveSpritesDir,
} from './lib/item-sprites.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '_cache');
const ITEM_DATA = path.join(CACHE, 'ItemData.csv');
const SHAPES = path.join(CACHE, 'game-shapes.json');
const SPRITES_JSON = resolveGameSpritesJson(__dirname);
const OUT = path.join(CACHE, 'game-items.json');
const ITEMS_DIR_CANDIDATES = [
  path.join(ROOT, 'tools', 'game-extract-full', 'Items'),
  path.join(ROOT, 'tools', 'game-extract', 'Items'),
];
const ITEMS_DIR = ITEMS_DIR_CANDIDATES.find((d) => fs.existsSync(d));

const TRANSL_CANDIDATES = [
  path.join(CACHE, 'transl_tmp', 'Items', 'Items.en.translation'),
  path.join(CACHE, 'Items.en.translation'),
  path.join(CACHE, 'transl_tmp', 'Full', 'Full.en.translation'),
  path.join(CACHE, 'Full.en.translation'),
  path.join(CACHE, 'transl_tmp', 'ExclusiveItems', 'ExclusiveItems.en.translation'),
  path.join(CACHE, 'ExclusiveItems.en.translation'),
];

const RARITIES = new Set(['Common', 'Rare', 'Epic', 'Legendary', 'Godly', 'Unique']);

/** Minimal RFC4180-ish CSV parser (no deps). */
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
  return rows.slice(1).filter((r) => r.some((x) => String(x).trim())).map((r) => {
    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = r[j] ?? '';
    return obj;
  });
}

/** Item.ActivationAni names (Item.gd). */
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

const ANI_NORM = new Map(ACTIVATION_ANI.map((a) => [a.toLowerCase().replace(/[^a-z]/g, ''), a]));

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

/**
 * ItemBook.gd: bag → Scale, Potion → Potion, else ItemData.animation (default Jump).
 * Pumpkin.gd overrides to Throw.
 * @param {{ type?: string, animation?: string, name?: string }} row
 */
export function resolveActivationAni(row) {
  const type = String(row.type || '').trim();
  const name = String(row.name || '').trim();
  if (/bag/i.test(type)) return 'Scale';
  if (/potion/i.test(type)) return 'Potion';
  if (slugify(name) === 'pumpkin') return 'Throw';
  const raw = String(row.animation || '').trim();
  if (!raw) return 'Jump';
  return ANI_NORM.get(raw.toLowerCase().replace(/[^a-z]/g, '')) || 'Jump';
}

function numOrNull(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "65:crit" → { value: 65, tag: "crit" } ; "90" → { value: 90, tag: null } */
function parseTaggedNumber(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { value: null, tag: null };
  const m = s.match(/^(-?\d+(?:\.\d+)?)\s*(?::\s*(.+))?$/);
  if (!m) return { value: null, tag: null };
  return { value: Number(m[1]), tag: m[2] ? m[2].trim() : null };
}

function parseParams(row) {
  const params = {};
  for (let i = 1; i <= 10; i++) {
    const col = String(row[`p${i}`] ?? '').trim();
    if (!col) continue;
    for (const part of col.split(',')) {
      const bit = part.trim();
      if (!bit) continue;
      if (bit.includes(':')) {
        const [val, name] = bit.split(':');
        const n = Number(val);
        if (name && Number.isFinite(n)) {
          params[name.trim()] = n;
          // Keep column index — DESCR $p3s means CSV p3, not Object.entries #3
          params[`p${i}`] = n;
        }
      } else {
        const n = Number(bit);
        if (Number.isFinite(n)) params[`p${i}`] = n;
      }
    }
  }
  return params;
}

/** `const params = { "luckt": 1, … }` from item .gd (e.g. Laboratory). */
function parseGdConstParams(text) {
  const m = String(text || '').match(/const\s+params\s*=\s*\{([\s\S]*?)\n\}/);
  if (!m) return null;
  const params = {};
  for (const part of m[1].matchAll(/["']([^"']+)["']\s*:\s*(-?\d+(?:\.\d+)?)/g)) {
    params[part[1]] = Number(part[2]);
  }
  return Object.keys(params).length ? params : null;
}

/** Build normKey → script params from item .gd files under Items. */
function loadScriptParams() {
  const map = new Map();
  if (!ITEMS_DIR) return map;

  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (/^(Animations|Materials|Particles|Sprites|Tiles|Masks)$/i.test(ent.name)) {
          continue;
        }
        walk(full);
      } else if (ent.name.endsWith('.gd')) {
        const params = parseGdConstParams(fs.readFileSync(full, 'utf8'));
        if (!params) continue;
        const stem = path.basename(full, '.gd');
        map.set(normKey(stem), params);
      }
    }
  }
  walk(ITEMS_DIR);
  return map;
}

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

function mapClass(shop) {
  const s = String(shop ?? '').trim();
  if (!s || s === 'no' || s === 'unique' || s === 'special') return 'Neutral';
  if (s.includes('>')) return s.split('>')[0].trim() || 'Neutral';
  // Skills: "Reaper 1,10" or "Ranger,Reaper 1"
  if (/\d/.test(s) && s.includes(' ')) {
    const left = s.split(/\s+/)[0];
    return left.split(',')[0].trim() || 'Neutral';
  }
  if (s.includes(',')) return s.split(',')[0].trim() || 'Neutral';
  return s;
}

function mapReleaseState(demo) {
  const d = String(demo ?? '').trim().toLowerCase();
  if (d === 'no') return 'full';
  if (d === 'nooo') return 'unreleased';
  return 'demo';
}

function mapExtraTypes(raw, mainType) {
  const extras = String(raw ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  // Keep melee/ranged as type string (matches BPB Builds); extras stay extras
  void mainType;
  return extras;
}

function loadDisplayNameTables() {
  const tables = [];
  const seen = new Set();
  for (const p of TRANSL_CANDIDATES) {
    if (!fs.existsSync(p) || !fs.statSync(p).isFile()) continue;
    const abs = path.resolve(p);
    if (seen.has(abs)) continue;
    seen.add(abs);
    try {
      tables.push(loadPHashTranslation(fs.readFileSync(abs, 'utf8')));
    } catch {
      /* skip */
    }
  }
  return tables;
}

function parseItem(row) {
  const internalName = String(row.name || '').trim();
  if (!internalName) return null;
  const chance = parseTaggedNumber(row.chance);
  const chance2 = parseTaggedNumber(row.chance2);
  // Game float("35:trade") → 35; tag is spreadsheet annotation only
  const shopChance = parseTaggedNumber(row.shopChance);
  const cds = String(row.cd ?? '')
    .replace(/\s+/g, '')
    .split(',')
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const type = String(row.type || 'Item').trim() || 'Item';
  const rarityRaw = String(row.rarity || 'Common').trim();
  const rarity = RARITIES.has(rarityRaw) ? rarityRaw : 'Common';

  return {
    id: slugify(internalName),
    gid: numOrNull(row.id),
    /** ItemData identifier — keys recipes, DESCR, shapes */
    name: internalName,
    internalName,
    /** Filled in main() from Name_NAME translations */
    displayName: internalName,
    rarity,
    type,
    class: mapClass(row.shop),
    shop: String(row.shop ?? '').trim(),
    extraTypes: mapExtraTypes(row.extraTypes, type),
    cost: numOrNull(row.price) ?? 0,
    staminaCost: numOrNull(row.staminaCost),
    damageMin: numOrNull(row.minDam),
    damageMax: numOrNull(row.maxDam),
    cooldown: cds.length ? cds[0] : null,
    extraCooldowns: cds.slice(1),
    accuracy: numOrNull(row.accuracy),
    chance: chance.value,
    chanceTag: chance.tag,
    chance2: chance2.value,
    chance2Tag: chance2.tag,
    shopChance: shopChance.value,
    block: numOrNull(row.block),
    params: parseParams(row),
    recipesRaw: String(row.recipes ?? '').trim() || null,
    material: String(row.material ?? '').trim() || null,
    tags: String(row.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    gameVersion: String(row.version ?? '').trim() || null,
    releaseState: mapReleaseState(row.demo),
    requires: String(row.requires ?? '').trim() || null,
    gateItem: String(row.gateItem ?? '').trim() || null,
    image: `${internalName.replace(/\s+/g, '')}.png`,
    activationAni: resolveActivationAni(row),
  };
}

function main() {
  if (!fs.existsSync(ITEM_DATA)) {
    console.error('missing', ITEM_DATA, '— run: node scripts/decrypt-itemdata.mjs');
    process.exit(1);
  }
  const rows = parseCsv(fs.readFileSync(ITEM_DATA, 'utf8'));

  const nameTables = loadDisplayNameTables();
  const gameSpriteMap = loadGameSpriteMap(SPRITES_JSON);
  const spriteIndex = buildSpriteIndex(resolveSpritesDir(ROOT));
  const scriptParams = loadScriptParams();

  const items = [];
  const byGid = new Map();
  let displayHits = 0;
  let spriteHits = 0;
  let scriptParamHits = 0;
  for (const row of rows) {
    const item = parseItem(row);
    if (!item) continue;

    const translated = getMessageAny(nameTables, `${item.internalName}_NAME`);
    if (translated && !translated.endsWith('_NAME') && !translated.endsWith('NAME')) {
      item.displayName = translated;
      displayHits++;
    }

    const gdParams =
      scriptParams.get(normKey(item.internalName)) ||
      scriptParams.get(normKey(item.name)) ||
      scriptParams.get(normKey(fileStem(item.internalName)));
    if (gdParams) {
      item.params = { ...gdParams, ...item.params };
      scriptParamHits++;
    }

    const sprite = matchSprite(item, gameSpriteMap, spriteIndex);
    if (sprite) {
      item.image = sprite;
      spriteHits++;
    }

    if (item.gid != null) {
      if (byGid.has(item.gid)) {
        console.warn('duplicate gid', item.gid, item.name, 'vs', byGid.get(item.gid));
      }
      byGid.set(item.gid, item.name);
    }
    items.push(item);
  }

  // Attach shapes (match by slug, name, or tscn file stem via normKeys)
  let shapeHits = 0;
  if (fs.existsSync(SHAPES)) {
    const { items: shapes } = JSON.parse(fs.readFileSync(SHAPES, 'utf8'));
    const byNorm = new Map();
    for (const s of shapes) {
      const keys = s.normKeys?.length
        ? s.normKeys
        : [s.name, s.fileStem, s.id, s.fileId].filter(Boolean).map((k) =>
            String(k)
              .toLowerCase()
              .replace(/&/g, 'and')
              .replace(/[^a-z0-9]+/g, ''),
          );
      for (const k of keys) {
        if (k && !byNorm.has(k)) byNorm.set(k, s);
      }
    }
    const nk = (s) =>
      String(s || '')
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '');
    for (const item of items) {
      const sh =
        byNorm.get(nk(item.id)) ||
        byNorm.get(nk(item.internalName)) ||
        byNorm.get(nk(item.displayName)) ||
        byNorm.get(nk(item.name));
      if (sh) {
        item.shape = sh.shape;
        item.sockets = sh.sockets ?? null;
        shapeHits++;
      }
    }
  }

  const out = {
    source: 'ItemData_e.csv',
    extractedAt: new Date().toISOString(),
    count: items.length,
    shapeHits,
    displayNameHits: displayHits,
    spriteHits,
    scriptParamHits,
    gameSpritesMapped: gameSpriteMap.size,
    spritesIndexed: spriteIndex.size,
    items,
  };
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  const aniOut = path.join(ROOT, 'assets', 'data', 'sim-activation-ani.json');
  const aniMap = {};
  for (const item of items) aniMap[item.id] = item.activationAni || 'Jump';
  fs.mkdirSync(path.dirname(aniOut), { recursive: true });
  fs.writeFileSync(
    aniOut,
    `${JSON.stringify({ source: 'ItemData.csv', extractedAt: out.extractedAt, items: aniMap }, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      {
        wrote: OUT,
        items: items.length,
        shapeHits,
        displayNameHits: displayHits,
        spriteHits,
        scriptParamHits,
        gameSpritesMapped: gameSpriteMap.size,
        sample: {
          fedora: items.find((i) => i.internalName === 'Fedora'),
          lootbox: items.find((i) => i.internalName === 'Lootbox'),
          laboratory: items.find((i) => i.internalName === 'Laboratory'),
          leather: items.find((i) => i.internalName === 'Leather Armor'),
        },
      },
      null,
      2,
    ),
  );
}

main();
