/**
 * Upsert combat/catalog fields from game-items.json into Supabase `items`.
 *
 * Does NOT overwrite `effect` (wiki text stays until game DESCR import lands).
 * Matches rows by gid, then name, then slug id.
 *
 * Prerequisites:
 *   node scripts/decrypt-itemdata.mjs
 *   node scripts/extract-game-shapes.mjs   # optional shapes/sockets
 *   node scripts/extract-game-items.mjs
 *
 * Usage:
 *   node scripts/import-game-items.mjs
 *
 * Env: SUPABASE_DB_URL, SUPABASE_DB_PASSWORD
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(__dirname, '_cache', 'game-items.json');
const SQL = path.join(ROOT, 'docs/db/sql/003_items_combat.sql');

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
  if (!fs.existsSync(DATA)) {
    console.error('missing', DATA, '— run extract-game-items.mjs first');
    process.exit(1);
  }
  const { items } = JSON.parse(fs.readFileSync(DATA, 'utf8'));
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

  const report = {
    updated: 0,
    inserted: 0,
    unmatched: [],
    skippedUnreleased: 0,
  };

  try {
    if (fs.existsSync(SQL)) {
      await client.query(fs.readFileSync(SQL, 'utf8'));
      console.log('applied', path.relative(ROOT, SQL));
    }

    const { rows: dbItems } = await client.query(
      'select id, name, gid from public.items',
    );
    const byId = new Map(dbItems.map((r) => [r.id, r]));
    const byGid = new Map(dbItems.filter((r) => r.gid != null).map((r) => [r.gid, r.id]));
    const byNorm = new Map();
    for (const r of dbItems) {
      byNorm.set(normKey(r.name), r.id);
      byNorm.set(normKey(r.id), r.id);
    }

    for (const item of items) {
      if (item.releaseState === 'unreleased') {
        report.skippedUnreleased++;
        continue;
      }

      let id =
        (item.gid != null && byGid.get(item.gid)) ||
        (byId.has(item.id) ? item.id : null) ||
        byNorm.get(normKey(item.name)) ||
        (item.displayName ? byNorm.get(normKey(item.displayName)) : null) ||
        null;

      const fields = {
        gid: item.gid,
        // UI title = translated Name_NAME when present; id stays internal slug
        name: item.displayName || item.name,
        rarity: item.rarity,
        type: item.type,
        class: item.class,
        extra_types: item.extraTypes ?? [],
        cost: item.cost ?? 0,
        accuracy: item.accuracy,
        cooldown: item.cooldown,
        stamina_cost: item.staminaCost,
        damage_min: item.damageMin,
        damage_max: item.damageMax,
        block: item.block,
        chance: item.chance,
        chance_tag: item.chanceTag,
        chance2: item.chance2,
        chance2_tag: item.chance2Tag,
        params: JSON.stringify(item.params ?? {}),
        recipes_raw: item.recipesRaw,
        material: item.material,
        tags: item.tags ?? [],
        game_version: item.gameVersion,
        release_state: item.releaseState,
        sockets: item.sockets ?? null,
        shape: item.shape ? JSON.stringify(item.shape) : null,
        image: item.image,
      };

      if (id) {
        await client.query(
          `update public.items set
             gid = coalesce($1, gid),
             name = $2,
             rarity = $3::item_rarity,
             type = $4,
             class = $5,
             extra_types = $6,
             cost = $7,
             accuracy = $8,
             cooldown = $9,
             stamina_cost = $10,
             damage_min = $11,
             damage_max = $12,
             block = $13,
             chance = $14,
             chance_tag = $15,
             chance2 = $16,
             chance2_tag = $17,
             params = $18::jsonb,
             recipes_raw = $19,
             material = $20,
             tags = $21,
             game_version = $22,
             release_state = $23,
             sockets = coalesce($24, sockets),
             shape = coalesce($25::jsonb, shape),
             image = coalesce($26, image),
             updated_at = now()
           where id = $27`,
          [
            fields.gid,
            fields.name,
            fields.rarity,
            fields.type,
            fields.class,
            fields.extra_types,
            fields.cost,
            fields.accuracy,
            fields.cooldown,
            fields.stamina_cost,
            fields.damage_min,
            fields.damage_max,
            fields.block,
            fields.chance,
            fields.chance_tag,
            fields.chance2,
            fields.chance2_tag,
            fields.params,
            fields.recipes_raw,
            fields.material,
            fields.tags,
            fields.game_version,
            fields.release_state,
            fields.sockets,
            fields.shape,
            fields.image,
            id,
          ],
        );
        report.updated++;
      } else {
        // Insert new catalog row; effect placeholder until DESCR import
        id = item.id;
        let suffix = 2;
        while (byId.has(id)) {
          id = `${item.id}_${suffix++}`;
        }
        await client.query(
          `insert into public.items (
             id, gid, name, rarity, type, class, extra_types, cost, effect, image,
             shape, sockets, accuracy, cooldown, stamina_cost, damage_min, damage_max,
             block, chance, chance_tag, chance2, chance2_tag, params, recipes_raw,
             material, tags, game_version, release_state
           ) values (
             $1,$2,$3,$4::item_rarity,$5,$6,$7,$8,$9,$10,
             $11::jsonb,$12,$13,$14,$15,$16,$17,
             $18,$19,$20,$21,$22,$23::jsonb,$24,
             $25,$26,$27,$28
           )`,
          [
            id,
            fields.gid,
            fields.name,
            fields.rarity,
            fields.type,
            fields.class,
            fields.extra_types,
            fields.cost,
            '—',
            fields.image,
            fields.shape,
            fields.sockets,
            fields.accuracy,
            fields.cooldown,
            fields.stamina_cost,
            fields.damage_min,
            fields.damage_max,
            fields.block,
            fields.chance,
            fields.chance_tag,
            fields.chance2,
            fields.chance2_tag,
            fields.params,
            fields.recipes_raw,
            fields.material,
            fields.tags,
            fields.game_version,
            fields.release_state,
          ],
        );
        byId.set(id, { id, name: item.name, gid: item.gid });
        if (item.gid != null) byGid.set(item.gid, id);
        byNorm.set(normKey(item.name), id);
        report.inserted++;
      }
    }

    fs.writeFileSync(
      path.join(__dirname, '_cache', 'import-game-items-report.json'),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
