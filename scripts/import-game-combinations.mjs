/**
 * Import craft recipes into combinations + combination_ingredients.
 *
 * Prerequisites:
 *   node scripts/extract-game-recipes.mjs
 *   items already seeded in Supabase
 *
 * Usage:
 *   node scripts/import-game-combinations.mjs
 *
 * Env: SUPABASE_DB_URL, SUPABASE_DB_PASSWORD
 *
 * Strategy: wipe catalog recipe tables then reinsert (catalog-only data).
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { normKey } from './lib/game-descr.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(__dirname, '_cache', 'game-recipes.json');
const ITEMS_JSON = path.join(__dirname, '_cache', 'game-items.json');
const SQL = path.join(ROOT, 'docs/db/sql/004_combinations.sql');

/** Item.Type names used as recipe ingredients (e.g. Fire*>Burning Coal). */
const TYPE_INGREDIENTS = new Set([
  'Bag',
  'Consumable',
  'Food',
  'Pet',
  'Weapon',
  'Shield',
  'Armor',
  'Gloves',
  'Shoes',
  'Helmet',
  'Accessory',
  'Potion',
  'Card',
  'Gem',
  'Scroll',
  'Book',
  'Skill',
  'ChessPiece',
  'Spell',
  'Melee',
  'Ranged',
  'Effect',
  'Holy',
  'Magic',
  'Vampiric',
  'Dark',
  'Nature',
  'Fire',
  'Ice',
  'Musical',
]);

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
    console.error('missing', DATA, '— run extract-game-recipes.mjs');
    process.exit(1);
  }
  const { recipes } = JSON.parse(fs.readFileSync(DATA, 'utf8'));
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
    inserted: 0,
    skipped: 0,
    unresolvedResults: [],
    unresolvedIngredients: [],
  };

  try {
    if (fs.existsSync(SQL)) {
      await client.query(fs.readFileSync(SQL, 'utf8'));
    }

    const { rows: dbItems } = await client.query(
      'select id, name, gid from public.items',
    );
    const byId = new Map(dbItems.map((r) => [r.id, r]));
    const byGid = new Map(
      dbItems.filter((r) => r.gid != null).map((r) => [r.gid, r]),
    );
    const byNorm = new Map(dbItems.map((r) => [normKey(r.name), r]));

    // Recipes use game internal names (Pot); DB often has display names (Boiling Pot).
    /** @type {Map<string, { id: string, gid: number|null, name: string, displayName?: string }>} */
    const giByNorm = new Map();
    if (fs.existsSync(ITEMS_JSON)) {
      const { items: giItems } = JSON.parse(fs.readFileSync(ITEMS_JSON, 'utf8'));
      for (const it of giItems || []) {
        for (const label of [it.name, it.displayName, it.internalName]) {
          if (!label) continue;
          const k = normKey(label);
          if (!giByNorm.has(k)) giByNorm.set(k, it);
        }
      }
    }

    function resolveName(name) {
      if (!name) return null;
      const direct = byNorm.get(normKey(name));
      if (direct) return direct;
      const gi = giByNorm.get(normKey(name));
      if (!gi) return null;
      return (
        byId.get(gi.id) ||
        (gi.gid != null ? byGid.get(gi.gid) : null) ||
        byNorm.get(normKey(gi.displayName || gi.name)) ||
        null
      );
    }

    await client.query('begin');
    await client.query('delete from public.combination_ingredients');
    await client.query('delete from public.combinations');

    for (const recipe of recipes) {
      if (recipe.skipped || !recipe.resultName || !recipe.ingredientNames?.length) {
        report.skipped++;
        continue;
      }

      const result = resolveName(recipe.resultName);
      if (!result) {
        report.unresolvedResults.push(recipe.resultName);
        report.skipped++;
        continue;
      }

      // Result exists ⇒ crafted for Item Library filters. Missing ingredients must not
      // drop the whole recipe (catalog may omit unreleased bases; game still crafts).
      const ingredients = [];
      for (const ingName of recipe.ingredientNames) {
        if (TYPE_INGREDIENTS.has(ingName)) {
          report.typeIngredients = report.typeIngredients || [];
          report.typeIngredients.push({
            result: recipe.resultName,
            ingredient: ingName,
            raw: recipe.raw,
          });
          continue;
        }
        const ing = resolveName(ingName);
        if (!ing) {
          report.unresolvedIngredients.push({
            result: recipe.resultName,
            ingredient: ingName,
            raw: recipe.raw,
          });
          continue;
        }
        ingredients.push(ing);
      }

      // Keep duplicates as quantity (game Recipe.allIngredients lists Axe twice for Double Axe).
      /** @type {Map<string, { id: string, quantity: number, sort_order: number }>} */
      const byId = new Map();
      for (const ing of ingredients) {
        const hit = byId.get(ing.id);
        if (hit) {
          hit.quantity += 1;
          continue;
        }
        byId.set(ing.id, {
          id: ing.id,
          quantity: 1,
          sort_order: byId.size,
        });
      }
      const unique = [...byId.values()];

      const { rows: comboRows } = await client.query(
        `insert into public.combinations (result_item_id, notes)
         values ($1, $2)
         returning id`,
        [result.id, recipe.raw || null],
      );
      const comboId = comboRows[0].id;
      for (const ing of unique) {
        await client.query(
          `insert into public.combination_ingredients
             (combination_id, item_id, quantity, sort_order)
           values ($1, $2, $3, $4)`,
          [comboId, ing.id, ing.quantity, ing.sort_order],
        );
      }
      report.inserted++;
    }

    await client.query('commit');

    const { rows: counts } = await client.query(
      `select
         (select count(*)::int from public.combinations) as combinations,
         (select count(*)::int from public.combination_ingredients) as ingredients`,
    );
    report.tableCounts = counts[0];

    // Spot-check War Scythe
    const { rows: war } = await client.query(
      `select result.name as result_name, ing.name as ingredient_name, ci.sort_order
       from public.combinations c
       join public.items result on result.id = c.result_item_id
       join public.combination_ingredients ci on ci.combination_id = c.id
       join public.items ing on ing.id = ci.item_id
       where result.name = 'War Scythe'
       order by c.id, ci.sort_order`,
    );
    report.warScythe = war;

    fs.writeFileSync(
      path.join(__dirname, '_cache', 'import-game-combinations-report.json'),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
