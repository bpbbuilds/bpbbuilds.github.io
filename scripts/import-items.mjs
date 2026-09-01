/**
 * Import items from backpackbattles.wiki.gg Cargo + local sprite zip.
 *
 * Usage (from repo root):
 *   node scripts/import-items.mjs
 *
 * Env: SUPABASE_DB_URL, SUPABASE_DB_PASSWORD
 * Sprites zip default:
 *   d:\Downloaded Games Libary\Items-20260712T002654Z-2-001.zip
 * Extracted to: assets/item-sprites/
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(__dirname, '_cache', 'items-cargo.json');
const SPRITES_DIR = path.join(ROOT, 'assets', 'item-sprites');
const ZIP_DEFAULT =
  'd:\\Downloaded Games Libary\\Items-20260712T002654Z-2-001.zip';
const ZIP = process.env.ITEMS_SPRITES_ZIP || ZIP_DEFAULT;
const WIKI_API = 'https://backpackbattles.wiki.gg/api.php';

const RARITIES = new Set(['Common', 'Rare', 'Epic', 'Legendary', 'Godly', 'Unique']);

function loadEnv() {
  const env = Object.fromEntries(
    fs
      .readFileSync(path.join(ROOT, '.env'), 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
  return env;
}

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80) || 'item';
}

function mapRarity(raw) {
  const r = String(raw || '').trim();
  if (RARITIES.has(r)) return r;
  if (/vary/i.test(r)) return 'Unique';
  return 'Common';
}

function mapCost(raw) {
  const m = String(raw || '').match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function mapClass(raw) {
  const c = String(raw || '').trim();
  return c || 'Neutral';
}

function mapType(raw) {
  const t = String(raw || '').trim();
  if (!t) return 'Item';
  // Cargo may return comma-separated types; keep primary
  return t.split(',')[0].trim() || 'Item';
}

/** Convert wiki/cargo effect markup → tooltip plain tags. */
function wikiEffectToPlain(raw) {
  let s = String(raw || '');
  s = s.replace(/\r\n/g, '\n');
  // File icons → <Name>
  s = s.replace(
    /\[\[File:([^|\]]+?)(?:\|[^\]]*)?\]\]/gi,
    (_, file) => {
      const base = file.replace(/\.(png|gif|webp|jpg|jpeg)$/i, '');
      const tag = base.replace(/[^a-zA-Z0-9]+/g, '');
      return tag ? `<${tag}>` : '';
    },
  );
  // [[Page|label]] / [[Page]]
  s = s.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2');
  s = s.replace(/\[\[([^\]]+)\]\]/g, '$1');
  // bold wiki
  s = s.replace(/'{3}([^']+)'{3}/g, '$1');
  s = s.replace(/'{2}([^']+)'{2}/g, '$1');
  // strip simple HTML
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/?(?:div|span|font|p|b|i|ul|ol|li)(?:\s[^>]*)?>/gi, '\n');
  s = s.replace(/&nbsp;/g, ' ');
  s = s.replace(/&amp;/g, '&');
  s = s.replace(/&lt;/g, '<');
  s = s.replace(/&gt;/g, '>');
  // list stars
  s = s.replace(/^\*\s*/gm, '');
  // collapse blank lines
  s = s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n\n');
  return s || '—';
}

async function fetchCargoAll() {
  if (fs.existsSync(CACHE)) {
    const cached = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    if (cached?.cargoquery?.length) {
      console.log('using cache', CACHE, cached.cargoquery.length);
      return cached.cargoquery.map((r) => r.title);
    }
  }

  const rows = [];
  let offset = 0;
  for (;;) {
    const url =
      `${WIKI_API}?action=cargoquery&tables=Items` +
      `&fields=${encodeURIComponent('_pageName=page,name,itemtype,rarity,class,cost,effect')}` +
      `&limit=500&offset=${offset}&format=json`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) throw new Error(JSON.stringify(json.error));
    const batch = (json.cargoquery || []).map((r) => r.title);
    rows.push(...batch);
    console.log('fetched', rows.length);
    if (batch.length < 500) break;
    offset += 500;
  }

  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify({ cargoquery: rows.map((t) => ({ title: t })) }, null, 0));
  return rows;
}

function extractSprites() {
  fs.mkdirSync(SPRITES_DIR, { recursive: true });
  const existing = fs.readdirSync(SPRITES_DIR).filter((f) => /\.png$/i.test(f));
  if (existing.length >= 500) {
    console.log('sprites already extracted:', existing.length);
    return existing;
  }
  if (!fs.existsSync(ZIP)) {
    throw new Error(`sprite zip not found: ${ZIP}`);
  }
  console.log('extracting', ZIP);
  // .NET ZipFile is more reliable than Expand-Archive for this archive
  const ps = `
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    \$zipPath = '${ZIP.replace(/'/g, "''")}'
    \$dest = '${SPRITES_DIR.replace(/'/g, "''")}'
    New-Item -ItemType Directory -Force -Path \$dest | Out-Null
    \$z = [IO.Compression.ZipFile]::OpenRead(\$zipPath)
    \$n = 0
    foreach (\$e in \$z.Entries) {
      if (\$e.FullName -notmatch '\\.png\$') { continue }
      \$name = [IO.Path]::GetFileName(\$e.FullName)
      if (-not \$name) { continue }
      \$out = Join-Path \$dest \$name
      \$fs = [IO.File]::Create(\$out)
      \$es = \$e.Open()
      \$es.CopyTo(\$fs)
      \$fs.Close(); \$es.Close()
      \$n++
    }
    \$z.Dispose()
    Write-Output \$n
  `;
  const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], {
    encoding: 'utf8',
  });
  console.log('extract reported', String(out).trim());
  const files = fs.readdirSync(SPRITES_DIR).filter((f) => /\.png$/i.test(f));
  console.log('sprites ready:', files.length);
  return files;
}

function buildSpriteIndex(files) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const f of files) {
    const base = f.replace(/\.png$/i, '');
    map.set(normKey(base), f);
    // also without trailing variant suffixes for soft match later
  }
  return map;
}

function matchSprite(name, page, spriteIndex) {
  const candidates = [name, page, name?.replace(/'/g, ''), page?.replace(/'/g, '')];
  for (const c of candidates) {
    const hit = spriteIndex.get(normKey(c));
    if (hit) return hit;
  }
  // soft: startswith / includes
  const key = normKey(name);
  if (!key) return null;
  for (const [k, file] of spriteIndex) {
    if (k === key || k.startsWith(key) || key.startsWith(k)) return file;
  }
  return null;
}

function toRow(raw, spriteIndex, usedIds) {
  const name = String(raw.name || raw.page || 'Unknown').trim();
  let id = slugify(name);
  if (usedIds.has(id)) {
    let n = 2;
    while (usedIds.has(`${id}_${n}`)) n += 1;
    id = `${id}_${n}`;
  }
  usedIds.add(id);

  const image = matchSprite(name, raw.page, spriteIndex);

  return {
    id,
    name,
    rarity: mapRarity(raw.rarity),
    type: mapType(raw.itemtype),
    class: mapClass(raw.class),
    cost: mapCost(raw.cost),
    effect: wikiEffectToPlain(raw.effect),
    image: image || null,
  };
}

async function main() {
  const env = loadEnv();
  const password = env.SUPABASE_DB_PASSWORD;
  if (!password || !env.SUPABASE_DB_URL) {
    console.error('missing SUPABASE_DB_URL or SUPABASE_DB_PASSWORD');
    process.exit(1);
  }

  const cargo = await fetchCargoAll();
  const files = extractSprites();
  const spriteIndex = buildSpriteIndex(files);

  const usedIds = new Set();
  const rows = cargo.map((r) => toRow(r, spriteIndex, usedIds));
  const withImg = rows.filter((r) => r.image).length;
  const missing = rows.filter((r) => !r.image);
  console.log(`rows=${rows.length} with_sprite=${withImg} missing_sprite=${missing.length}`);
  if (missing.length) {
    fs.writeFileSync(
      path.join(__dirname, '_cache', 'items-missing-sprites.json'),
      JSON.stringify(
        missing.map((m) => m.name),
        null,
        2,
      ),
    );
    console.log('wrote scripts/_cache/items-missing-sprites.json');
  }

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
    await client.query(fs.readFileSync(path.join(ROOT, 'docs/db/sql/002_items.sql'), 'utf8'));
    // upsert in batches
    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = [];
      const params = [];
      let p = 1;
      for (const r of batch) {
        values.push(
          `($${p++}, $${p++}, $${p++}::item_rarity, $${p++}, $${p++}, '{}'::text[], $${p++}, $${p++}, $${p++}, now(), now())`,
        );
        params.push(r.id, r.name, r.rarity, r.type, r.class, r.cost, r.effect, r.image);
      }
      await client.query(
        `insert into public.items
          (id, name, rarity, type, class, extra_types, cost, effect, image, created_at, updated_at)
         values ${values.join(',')}
         on conflict (id) do update set
           name = excluded.name,
           rarity = excluded.rarity,
           type = excluded.type,
           class = excluded.class,
           cost = excluded.cost,
           effect = excluded.effect,
           image = excluded.image,
           updated_at = now()`,
        params,
      );
      console.log(`upserted ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
    }

    const { rows: countRows } = await client.query('select count(*)::int as n from public.items');
    console.log('db items count:', countRows[0].n);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
