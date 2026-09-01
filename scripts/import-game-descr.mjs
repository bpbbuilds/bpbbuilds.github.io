/**
 * Upsert items.effect from game-descr.json (game DESCR wins when present).
 *
 * Usage:
 *   node scripts/import-game-descr.mjs
 *
 * Env: SUPABASE_DB_URL, SUPABASE_DB_PASSWORD
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { normKey } from './lib/game-descr.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(__dirname, '_cache', 'game-descr.json');

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

async function main() {
  if (!fs.existsSync(DATA)) {
    console.error('missing', DATA, '— run extract-game-descr.mjs');
    process.exit(1);
  }
  const { items } = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const env = loadEnv();
  const base = new URL(env.SUPABASE_DB_URL);
  const client = new pg.Client({
    connectionString:
      `postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}` +
      `@${base.hostname}:${base.port || 5432}${base.pathname}`,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const report = { updated: 0, skippedNoEffect: 0, unmatched: [] };

  try {
    const { rows: dbItems } = await client.query('select id, name, gid, effect from public.items');
    const byId = new Map(dbItems.map((r) => [r.id, r]));
    const byGid = new Map(dbItems.filter((r) => r.gid != null).map((r) => [r.gid, r]));
    const byNorm = new Map(dbItems.map((r) => [normKey(r.name), r]));

    for (const row of items) {
      if (!row.effect) {
        report.skippedNoEffect++;
        continue;
      }
      const db =
        (row.gid != null && byGid.get(row.gid)) ||
        byId.get(row.id) ||
        byNorm.get(normKey(row.name));
      if (!db) {
        report.unmatched.push(row.name);
        continue;
      }
      if (db.effect === row.effect) continue;
      await client.query(
        `update public.items set effect = $1, updated_at = now() where id = $2`,
        [row.effect, db.id],
      );
      report.updated++;
    }

    const { rows: left } = await client.query(
      `select count(*)::int as n from public.items
       where effect is null or effect = '' or effect = '—' or effect = '-'`,
    );
    report.placeholdersRemaining = left[0].n;

    fs.writeFileSync(
      path.join(__dirname, '_cache', 'import-game-descr-report.json'),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
