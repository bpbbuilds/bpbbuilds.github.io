/**
 * Read-only catalog audit: every game item (scripts/_cache/game-items.json,
 * extracted from the game's ItemData) vs the live `items` table.
 *
 * Reports rows missing / extra and every field that drifted from the game.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

async function dbRows() {
  const env = loadEnv();
  const base = new URL(env.SUPABASE_DB_URL);
  const client = new pg.Client({
    connectionString:
      `postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}` +
      `@${base.hostname}:${base.port || 5432}${base.pathname}`,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const cols = await client.query(
      `select column_name, data_type from information_schema.columns
        where table_schema = 'public' and table_name = 'items' order by ordinal_position`,
    );
    const { rows } = await client.query('select * from public.items');
    return { cols: cols.rows, rows };
  } finally {
    await client.end();
  }
}

const norm = (v) => (v == null ? null : String(v).trim());
const numOrNull = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function main() {
  const file = loadJson('scripts/_cache/game-items.json');
  const game = file.items || file;
  return game;
}

const game = main();
const { cols, rows } = await dbRows();
const colNames = cols.map((c) => c.column_name);

const gameById = new Map(game.map((i) => [i.id, i]));
const dbById = new Map(rows.map((r) => [r.id, r]));

const missing = game.filter((i) => !dbById.has(i.id)).map((i) => ({
  id: i.id,
  gid: i.gid,
  name: i.name,
  rarity: i.rarity,
  shop: i.shop,
  shopChance: i.shopChance,
  releaseState: i.releaseState,
  gameVersion: i.gameVersion,
}));
const extra = rows.filter((r) => !gameById.has(r.id)).map((r) => ({ id: r.id, gid: r.gid, name: r.name }));

function jsonCanon(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return v;
    }
  }
  if (Array.isArray(v)) return JSON.stringify(v.map((x) => String(x)).sort());
  if (typeof v === 'object') {
    const keys = Object.keys(v).sort();
    const out = {};
    for (const k of keys) {
      const n = Number(v[k]);
      out[k] = Number.isFinite(n) && String(v[k]).trim() !== '' ? n : v[k];
    }
    return JSON.stringify(out);
  }
  return String(v);
}

function arrCanon(v) {
  if (v == null) return '[]';
  const arr = Array.isArray(v) ? v : String(v).split(',').map((s) => s.trim()).filter(Boolean);
  return JSON.stringify(arr.map((x) => String(x)).sort());
}

/** game field → db column, with a comparator */
const FIELDS = [
  ['displayName', 'name', (g) => norm(g.displayName || g.name)],
  ['gid', 'gid', (g) => numOrNull(g.gid)],
  ['rarity', 'rarity', (g) => norm(g.rarity)],
  ['type', 'type', (g) => norm(g.type)],
  ['class', 'class', (g) => norm(g.class)],
  ['cost', 'cost', (g) => numOrNull(g.cost)],
  ['staminaCost', 'stamina_cost', (g) => numOrNull(g.staminaCost)],
  ['damageMin', 'damage_min', (g) => numOrNull(g.damageMin)],
  ['damageMax', 'damage_max', (g) => numOrNull(g.damageMax)],
  ['cooldown', 'cooldown', (g) => numOrNull(g.cooldown)],
  ['accuracy', 'accuracy', (g) => numOrNull(g.accuracy)],
  ['block', 'block', (g) => numOrNull(g.block)],
  ['image', 'image', (g) => norm(g.image)],
  ['material', 'material', (g) => norm(g.material)],
  ['params', 'params', (g) => jsonCanon(g.params || {}), (got) => jsonCanon(got)],
  ['extraTypes', 'extra_types', (g) => arrCanon(g.extraTypes), (got) => arrCanon(got)],
  ['tags', 'tags', (g) => arrCanon(g.tags), (got) => arrCanon(got)],
];

const drift = [];
for (const g of game) {
  const r = dbById.get(g.id);
  if (!r) continue;
  const bad = [];
  for (const [gKey, col, pick, gotPick] of FIELDS) {
    if (!colNames.includes(col)) continue;
    const want = pick(g);
    let got = r[col];
    if (gotPick) {
      got = gotPick(got);
    } else {
      if (typeof got === 'string') got = got.trim();
      if (typeof want === 'number' && got != null) got = numOrNull(got);
    }
    const same =
      want == null || want === ''
        ? got == null || got === ''
        : String(want).toLowerCase() === String(got ?? '').toLowerCase();
    if (!same) bad.push({ field: gKey, col, game: want, db: got ?? null });
  }
  if (bad.length) drift.push({ id: g.id, name: g.name, bad });
}

const emptyEffect = rows
  .filter((r) => !norm(r.effect))
  .map((r) => ({ id: r.id, gid: r.gid, name: r.name }));

const report = {
  generatedAt: new Date().toISOString(),
  columns: colNames,
  totals: {
    game: game.length,
    db: rows.length,
    missingInDb: missing.length,
    extraInDb: extra.length,
    fieldDrift: drift.length,
    emptyEffect: emptyEffect.length,
  },
  missingInDb: missing,
  extraInDb: extra,
  emptyEffect,
  fieldDrift: drift,
};

const out = path.join(ROOT, 'scripts/_cache/catalog-vs-game-report.json');
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.totals, null, 1));
console.log('columns:', colNames.join(', '));
console.log('missing in DB:', JSON.stringify(missing, null, 1));
console.log('extra in DB:', JSON.stringify(extra, null, 1));
console.log('empty effect:', JSON.stringify(emptyEffect, null, 1));
console.log('field drift sample:', JSON.stringify(drift.slice(0, 12), null, 1));
console.log(`wrote ${path.relative(ROOT, out)}`);
