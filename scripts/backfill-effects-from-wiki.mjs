/**
 * Backfill items.effect from wiki Cargo cache for rows still using placeholder "—".
 *
 * Usage:
 *   node scripts/backfill-effects-from-wiki.mjs
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CARGO = path.join(__dirname, '_cache', 'items-cargo.json');

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

function wikiEffectToPlain(raw) {
  let s = String(raw || '');
  s = s.replace(/\r\n/g, '\n');
  s = s.replace(/\[\[File:([^|\]]+?)(?:\|[^\]]*)?\]\]/gi, (_, file) => {
    const base = file.replace(/\.(png|gif|webp|jpg|jpeg)$/i, '');
    const tag = base.replace(/[^a-zA-Z0-9]+/g, '');
    return tag ? `<${tag}>` : '';
  });
  s = s.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2');
  s = s.replace(/\[\[([^\]]+)\]\]/g, '$1');
  s = s.replace(/'{3}([^']+)'{3}/g, '$1');
  s = s.replace(/'{2}([^']+)'{2}/g, '$1');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/?(?:div|span|font|p|b|i|ul|ol|li)(?:\s[^>]*)?>/gi, '\n');
  s = s.replace(/&nbsp;/g, ' ');
  s = s.replace(/&amp;/g, '&');
  s = s.replace(/&lt;/g, '<');
  s = s.replace(/&gt;/g, '>');
  s = s.replace(/^\*\s*/gm, '');
  s = s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n\n');
  return s || '';
}

async function main() {
  if (!fs.existsSync(CARGO)) {
    console.error('missing', CARGO, '— run import-items.mjs once to refresh cargo');
    process.exit(1);
  }
  const cargo = JSON.parse(fs.readFileSync(CARGO, 'utf8'));
  const titles = cargo.cargoquery || cargo;
  const byNorm = new Map();
  for (const entry of titles) {
    const t = entry.title || entry;
    const name = t.name || t.page;
    const effect = wikiEffectToPlain(t.effect);
    if (name && effect) byNorm.set(normKey(name), effect);
  }

  const env = loadEnv();
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
    const { rows } = await client.query(
      `select id, name, effect from public.items
       where effect is null or effect = '' or effect = '—' or effect = '-'`,
    );
    let updated = 0;
    const still = [];
    for (const row of rows) {
      const effect = byNorm.get(normKey(row.name));
      if (!effect) {
        still.push(row.name);
        continue;
      }
      await client.query(
        `update public.items set effect = $1, updated_at = now() where id = $2`,
        [effect, row.id],
      );
      updated++;
    }
    console.log(JSON.stringify({ placeholders: rows.length, updated, stillMissing: still.length, still }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
