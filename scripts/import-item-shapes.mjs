/**
 * Import item grid shapes from backpackbattles.wiki.gg Cargo → items.shape
 *
 * Usage (from repo root):
 *   node scripts/import-item-shapes.mjs
 *
 * Env: SUPABASE_DB_URL, SUPABASE_DB_PASSWORD
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '_cache', 'items-shapes-cargo.json');
const WIKI_API = 'https://backpackbattles.wiki.gg/api.php';

function loadEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(path.join(ROOT, '.env'), 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
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

/**
 * Wiki grid string → numeric matrix.
 * `-` = 0 empty, `1` = body, `2` = star (adjacency), other digits kept.
 * @param {string} raw
 * @returns {number[][] | null}
 */
export function parseWikiGrid(raw) {
  if (!raw || !String(raw).trim()) return null;
  const lines = String(raw)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length);
  if (!lines.length) return null;

  const width = Math.max(...lines.map((l) => l.length));
  const matrix = lines.map((line) => {
    const row = [];
    for (let x = 0; x < width; x += 1) {
      const ch = line[x] ?? '-';
      if (ch === '-' || ch === ' ' || ch === '.') {
        row.push(0);
      } else if (ch >= '0' && ch <= '9') {
        row.push(Number(ch));
      } else {
        row.push(0);
      }
    }
    return row;
  });
  return matrix;
}

async function fetchCargoGrids() {
  if (fs.existsSync(CACHE)) {
    const cached = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    if (cached?.rows?.length) {
      console.log('using cache', CACHE, cached.rows.length);
      return cached.rows;
    }
  }

  const rows = [];
  let offset = 0;
  for (;;) {
    const url =
      `${WIKI_API}?action=cargoquery&tables=Items` +
      `&fields=${encodeURIComponent('_pageName=page,name,grid')}` +
      `&limit=500&offset=${offset}&format=json`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) throw new Error(JSON.stringify(json.error));
    const batch = (json.cargoquery || []).map((r) => r.title);
    rows.push(...batch);
    console.log('fetched grids', rows.length);
    if (batch.length < 500) break;
    offset += 500;
  }

  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify({ rows }, null, 0));
  return rows;
}

async function main() {
  const env = loadEnv();
  const password = env.SUPABASE_DB_PASSWORD;
  if (!password || !env.SUPABASE_DB_URL) {
    console.error('missing SUPABASE_DB_URL or SUPABASE_DB_PASSWORD');
    process.exit(1);
  }

  const cargo = await fetchCargoGrids();
  const parsed = [];
  const missingGrid = [];

  for (const raw of cargo) {
    const name = String(raw.name || raw.page || '').trim();
    const matrix = parseWikiGrid(raw.grid);
    if (!matrix) {
      missingGrid.push(name || raw.page);
      continue;
    }
    parsed.push({
      name,
      page: raw.page,
      slug: slugify(name),
      pageSlug: slugify(raw.page),
      norm: normKey(name),
      pageNorm: normKey(raw.page),
      shape: matrix,
    });
  }

  console.log(`parsed=${parsed.length} missing_grid=${missingGrid.length}`);

  const base = new URL(env.SUPABASE_DB_URL);
  const connectionString =
    `postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(password)}` +
    `@${base.hostname}:${base.port || 5432}${base.pathname}`;

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const { rows: dbItems } = await client.query('select id, name from public.items');
    const byId = new Map(dbItems.map((r) => [r.id, r]));
    const byNorm = new Map();
    for (const r of dbItems) {
      byNorm.set(normKey(r.name), r.id);
      byNorm.set(normKey(r.id), r.id);
    }

    let updated = 0;
    const unmatched = [];

    for (const row of parsed) {
      let id =
        byId.has(row.slug) ? row.slug
        : byId.has(row.pageSlug) ? row.pageSlug
        : byNorm.get(row.norm) || byNorm.get(row.pageNorm) || null;

      if (!id) {
        unmatched.push(row.name);
        continue;
      }

      await client.query('update public.items set shape = $1::jsonb, updated_at = now() where id = $2', [
        JSON.stringify(row.shape),
        id,
      ]);
      updated += 1;
    }

    const { rows: countRows } = await client.query(
      `select
         count(*)::int as total,
         count(shape)::int as with_shape
       from public.items`,
    );

    console.log(`updated=${updated} unmatched=${unmatched.length}`);
    console.log('db:', countRows[0]);

    if (unmatched.length || missingGrid.length) {
      fs.writeFileSync(
        path.join(__dirname, '_cache', 'items-shapes-report.json'),
        JSON.stringify({ unmatched, missingGrid }, null, 2),
      );
      console.log('wrote scripts/_cache/items-shapes-report.json');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
