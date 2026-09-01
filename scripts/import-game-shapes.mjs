/**
 * Apply shapes (and socket counts) extracted from game .tscn → Supabase items.
 *
 * Prerequisites:
 *   1. GDRE recover → tools/game-extract/
 *   2. node scripts/extract-game-shapes.mjs
 *
 * Usage:
 *   node scripts/import-game-shapes.mjs
 *
 * Env: SUPABASE_DB_URL, SUPABASE_DB_PASSWORD
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHAPES = path.join(__dirname, '_cache', 'game-shapes.json');

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

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

async function main() {
  if (!fs.existsSync(SHAPES)) {
    console.error('missing', SHAPES, '— run: node scripts/extract-game-shapes.mjs');
    process.exit(1);
  }
  const { items } = JSON.parse(fs.readFileSync(SHAPES, 'utf8'));
  const env = loadEnv();
  if (!env.SUPABASE_DB_URL || !env.SUPABASE_DB_PASSWORD) {
    console.error('missing SUPABASE_DB_URL or SUPABASE_DB_PASSWORD');
    process.exit(1);
  }

  const base = new URL(env.SUPABASE_DB_URL);
  const connectionString =
    `postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}` +
    `@${base.hostname}:${base.port || 5432}${base.pathname}`;

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    // optional sockets column (game gem sockets)
    await client.query(`
      alter table public.items
        add column if not exists sockets integer check (sockets is null or sockets >= 0)
    `);

    const { rows: dbItems } = await client.query('select id, name from public.items');
    const byId = new Map(dbItems.map((r) => [r.id, r]));
    const byNorm = new Map();
    for (const r of dbItems) {
      byNorm.set(normKey(r.name), r.id);
      byNorm.set(normKey(r.id), r.id);
    }

    let updated = 0;
    const unmatched = [];

    for (const row of items) {
      let id = byId.has(row.id) ? row.id : byNorm.get(normKey(row.name)) || null;
      // strip Exclusive suffix ids
      if (!id && row.id.includes('__')) {
        id = byId.has(row.id.split('__')[0]) ? row.id.split('__')[0] : byNorm.get(normKey(row.name));
      }
      if (!id) {
        unmatched.push(row.name);
        continue;
      }
      await client.query(
        `update public.items
         set shape = $1::jsonb,
             sockets = $2,
             updated_at = now()
         where id = $3`,
        [
          JSON.stringify(row.shape),
          row.socketOffsets?.length ?? row.sockets ?? null,
          id,
        ],
      );
      updated += 1;
    }

    const { rows: stats } = await client.query(`
      select count(*)::int as total,
             count(shape)::int as with_shape,
             count(sockets)::int as with_sockets
      from public.items
    `);

    console.log(`updated=${updated} unmatched=${unmatched.length}`);
    console.log('db', stats[0]);
    if (unmatched.length) {
      fs.writeFileSync(
        path.join(__dirname, '_cache', 'game-shapes-unmatched.json'),
        JSON.stringify(unmatched, null, 2),
      );
      console.log('wrote scripts/_cache/game-shapes-unmatched.json', unmatched.length);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
