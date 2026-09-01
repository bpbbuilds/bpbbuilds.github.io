/**
 * Catalog cleanup: game ItemData is source of truth.
 *
 * - Apply display names from Name_NAME translations
 * - Remap image filenames to files that exist in assets/item-sprites
 * - Delete wiki-only ghost rows that are aliases of game items
 *   (e.g. "Impractically Large Greatsword" → game "Greatsword")
 *
 * Prerequisites:
 *   node scripts/extract-game-sprites.mjs  (preferred)
 *   node scripts/extract-game-items.mjs
 *   assets/item-sprites/ populated (game copy and/or wiki zip fallback)
 *
 * Usage:
 *   node scripts/cleanup-catalog-from-game.mjs
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
const DATA = path.join(__dirname, '_cache', 'game-items.json');
const SPRITES = path.join(ROOT, 'assets', 'item-sprites');

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

async function tableExists(client, name) {
  const { rows } = await client.query(
    `select 1 from information_schema.tables
     where table_schema = 'public' and table_name = $1`,
    [name],
  );
  return rows.length > 0;
}

async function main() {
  if (!fs.existsSync(DATA)) {
    console.error('missing', DATA, '— run extract-game-items.mjs');
    process.exit(1);
  }
  const { items: gameItems } = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const env = loadEnv();
  const base = new URL(env.SUPABASE_DB_URL);
  const client = new pg.Client({
    connectionString:
      `postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}` +
      `@${base.hostname}:${base.port || 5432}${base.pathname}`,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const report = {
    updatedNames: 0,
    updatedImages: 0,
    deletedAliases: [],
    remainingWikiOnly: [],
    samples: {},
  };

  const hasCombos = await tableExists(client, 'combinations');
  const hasComboIng = await tableExists(client, 'combination_ingredients');
  const hasPlacements = await tableExists(client, 'build_placements');

  try {
    const { rows: dbItems } = await client.query(
      'select id, gid, name, image from public.items',
    );
    const byGid = new Map(
      dbItems.filter((r) => r.gid != null).map((r) => [r.gid, r]),
    );
    const byId = new Map(dbItems.map((r) => [r.id, r]));
    const byNormName = new Map(dbItems.map((r) => [normKey(r.name), r]));

    /** display/internal → game row id */
    const aliasToGameId = new Map();

    for (const item of gameItems) {
      const db =
        (item.gid != null && byGid.get(item.gid)) ||
        byId.get(item.id) ||
        byNormName.get(normKey(item.internalName || item.name));
      if (!db) continue;

      const display = item.displayName || item.name;
      const internal = item.internalName || item.name;
      aliasToGameId.set(normKey(display), db.id);
      aliasToGameId.set(normKey(internal), db.id);

      const nextName = display;
      const nextImage = item.image || db.image;

      if (db.name !== nextName || db.image !== nextImage) {
        await client.query(
          `update public.items
           set name = $1, image = $2, updated_at = now()
           where id = $3`,
          [nextName, nextImage, db.id],
        );
        if (db.name !== nextName) report.updatedNames++;
        if (db.image !== nextImage) report.updatedImages++;
        db.name = nextName;
        db.image = nextImage;
      }
    }

    const { rows: wikiOnly } = await client.query(
      `select id, name, image from public.items where gid is null`,
    );

    for (const wiki of wikiOnly) {
      const gameId = aliasToGameId.get(normKey(wiki.name));
      if (!gameId || gameId === wiki.id) {
        report.remainingWikiOnly.push(wiki.name);
        continue;
      }

      if (wiki.image) {
        const { rows: g } = await client.query(
          `select image from public.items where id = $1`,
          [gameId],
        );
        const cur = g[0]?.image;
        const gameFileOk = cur && fs.existsSync(path.join(SPRITES, cur));
        const wikiFileOk = fs.existsSync(path.join(SPRITES, wiki.image));
        if ((!gameFileOk || !cur) && wikiFileOk) {
          await client.query(
            `update public.items set image = $1, updated_at = now() where id = $2`,
            [wiki.image, gameId],
          );
          report.updatedImages++;
        }
      }

      if (hasComboIng) {
        // Avoid unique (combination_id, item_id) clashes: drop wiki rows that
        // would duplicate an existing game ingredient, else remap.
        await client.query(
          `delete from public.combination_ingredients w
           using public.combination_ingredients g
           where w.item_id = $2
             and g.item_id = $1
             and w.combination_id = g.combination_id`,
          [gameId, wiki.id],
        );
        await client.query(
          `update public.combination_ingredients set item_id = $1 where item_id = $2`,
          [gameId, wiki.id],
        );
      }
      if (hasCombos) {
        await client.query(
          `update public.combinations set result_item_id = $1 where result_item_id = $2`,
          [gameId, wiki.id],
        );
      }
      if (hasPlacements) {
        await client.query(
          `update public.build_placements set item_id = $1 where item_id = $2`,
          [gameId, wiki.id],
        );
      }

      await client.query(`delete from public.items where id = $1`, [wiki.id]);
      report.deletedAliases.push({
        deleted: wiki.name,
        deletedId: wiki.id,
        keptId: gameId,
      });
    }

    for (const label of [
      'Impractically Large Greatsword',
      'Very Long Spear',
      'Blood Harvester',
      'Greatsword',
      'Long Spear',
      'Vampiric Scythe',
    ]) {
      const { rows } = await client.query(
        `select id, gid, name, image, damage_min, damage_max, cooldown
         from public.items where name = $1`,
        [label],
      );
      if (rows.length) report.samples[label] = rows[0];
    }

    const { rows: counts } = await client.query(
      `select
         (select count(*)::int from public.items) as items,
         (select count(*)::int from public.items where gid is null) as wiki_only,
         (select count(*)::int from public.items
            where image is null or image = '') as no_image`,
    );
    report.counts = counts[0];
    report.deletedCount = report.deletedAliases.length;

    fs.writeFileSync(
      path.join(__dirname, '_cache', 'cleanup-catalog-report.json'),
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
