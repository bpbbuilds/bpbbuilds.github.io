/**
 * Apply docs/db/sql/005_build_placements.sql + seed demo grids for featured builds.
 * Run: node scripts/_apply-build-placements.mjs
 */
import fs from 'fs';
import pg from 'pg';

const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const base = new URL(env.SUPABASE_DB_URL);
const password = env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error('missing SUPABASE_DB_PASSWORD');
  process.exit(1);
}

const connectionString =
  `postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(password)}` +
  `@${base.hostname}:${base.port || 5432}${base.pathname}`;

const sql = fs.readFileSync('docs/db/sql/005_build_placements.sql', 'utf8');

/**
 * Demo boards on the game’s 9×7 inventory.
 * Unique item ids only (grid pool is keyed by item id for now).
 */
const DEMO_LAYOUTS = {
  /* Dense showcase board — gooberts, dragons, multi-bag (inspired by endgame OP boards). */
  'infinite-combo-machine': [
    { item_id: 'berserker_bag', x: 0, y: 0, priority: null },
    { item_id: 'holdall', x: 3, y: 0, priority: null },
    { item_id: 'leather_bag', x: 6, y: 0, priority: null },
    { item_id: 'scholar_bag', x: 0, y: 3, priority: null },
    { item_id: 'box_of_prosperity', x: 6, y: 4, priority: null },
    { item_id: 'puzzlebag_t', x: 3, y: 4, priority: null },

    { item_id: 'goobert', x: 0, y: 0, priority: 'needed' },
    { item_id: 'blood_goobert', x: 2, y: 0, priority: 'needed' },
    { item_id: 'chili_goobert', x: 4, y: 0, priority: 'needed' },
    { item_id: 'ice_dragon', x: 6, y: 0, priority: 'needed' },
    { item_id: 'steel_goobert', x: 0, y: 3, priority: 'nice' },
    { item_id: 'power_puppy', x: 3, y: 2, priority: 'nice' },
    { item_id: 'obsidian_dragon', x: 6, y: 3, priority: 'nice' },
    { item_id: 'shelly', x: 3, y: 5, priority: 'optional' },

    { item_id: 'flame', x: 5, y: 3, priority: 'needed' },
    { item_id: 'piggy_of_riches', x: 3, y: 4, priority: 'nice' },
    { item_id: 'heart_container', x: 0, y: 5, priority: 'nice' },
    { item_id: 'oil_lamp', x: 2, y: 5, priority: 'optional' },
    { item_id: 'rope', x: 5, y: 5, priority: 'optional' },
    { item_id: 'lucky_clover', x: 8, y: 5, priority: 'optional' },
    { item_id: 'whetstone', x: 8, y: 3, priority: 'optional' },
    { item_id: 'wooden_sword', x: 7, y: 5, priority: 'needed' },
    { item_id: 'flame_badge', x: 5, y: 4, priority: 'optional' },
    { item_id: 'draconic_orb', x: 2, y: 3, priority: 'nice' },
  ],
  'poison-garden-ranger': [
    { item_id: 'ranger_bag', x: 2, y: 1, priority: null },
    { item_id: 'leather_bag', x: 5, y: 1, priority: null },
    { item_id: 'vineweave_basket', x: 0, y: 3, priority: null },
    { item_id: 'poison_goobert', x: 2, y: 1, priority: 'needed' },
    { item_id: 'poison_frog', x: 5, y: 1, priority: 'needed' },
    { item_id: 'snake', x: 0, y: 3, priority: 'nice' },
    { item_id: 'poison_ivy', x: 4, y: 4, priority: 'nice' },
    { item_id: 'healing_herbs', x: 7, y: 2, priority: 'optional' },
    { item_id: 'leaf_badge', x: 7, y: 3, priority: 'optional' },
  ],
  'pyro-furnace': [
    { item_id: 'fire_pit', x: 2, y: 1, priority: null },
    { item_id: 'leather_bag', x: 6, y: 1, priority: null },
    { item_id: 'chili_goobert', x: 2, y: 1, priority: 'needed' },
    { item_id: 'flame', x: 5, y: 2, priority: 'needed' },
    { item_id: 'frozen_flame', x: 6, y: 1, priority: 'nice' },
    { item_id: 'burning_banner', x: 0, y: 4, priority: 'nice' },
    { item_id: 'oil_lamp', x: 5, y: 4, priority: 'optional' },
    { item_id: 'flame_badge', x: 7, y: 4, priority: 'optional' },
  ],
  'reaper-harvest': [
    { item_id: 'storage_coffin', x: 2, y: 1, priority: null },
    { item_id: 'holdall', x: 5, y: 1, priority: null },
    { item_id: 'blood_goobert', x: 2, y: 1, priority: 'needed' },
    { item_id: 'ghost', x: 5, y: 1, priority: 'needed' },
    { item_id: 'heart_of_darkness', x: 5, y: 3, priority: 'nice' },
    { item_id: 'skull_badge', x: 0, y: 2, priority: 'optional' },
    { item_id: 'blood_amulet', x: 0, y: 3, priority: 'optional' },
  ],
  /* Dense bloodline board — 10 needed / 5 wants / 10 good-to-have. */
  'berserk-bloodline': [
    { item_id: 'berserker_bag', x: 0, y: 0, priority: null },
    { item_id: 'holdall', x: 3, y: 0, priority: null },
    { item_id: 'leather_bag', x: 6, y: 0, priority: null },
    { item_id: 'scholar_bag', x: 0, y: 3, priority: null },
    { item_id: 'box_of_prosperity', x: 6, y: 4, priority: null },

    { item_id: 'blood_goobert', x: 0, y: 0, priority: 'needed' },
    { item_id: 'goobert', x: 4, y: 0, priority: 'needed' },
    { item_id: 'wooden_sword', x: 8, y: 0, priority: 'needed' },
    { item_id: 'claws_of_attack', x: 0, y: 2, priority: 'needed' },
    { item_id: 'axe', x: 2, y: 2, priority: 'needed' },
    { item_id: 'bloodthorne', x: 4, y: 2, priority: 'needed' },
    { item_id: 'heart_container', x: 5, y: 2, priority: 'needed' },
    { item_id: 'blood_amulet', x: 7, y: 2, priority: 'needed' },
    { item_id: 'bloody_dagger', x: 8, y: 2, priority: 'needed' },
    { item_id: 'hero_sword', x: 7, y: 4, priority: 'needed' },

    { item_id: 'piggy_of_riches', x: 0, y: 3, priority: 'nice' },
    { item_id: 'whetstone', x: 2, y: 3, priority: 'nice' },
    { item_id: 'dragon_claws', x: 3, y: 3, priority: 'nice' },
    { item_id: 'power_puppy', x: 0, y: 4, priority: 'nice' },
    { item_id: 'heart_of_darkness', x: 4, y: 3, priority: 'nice' },

    { item_id: 'flame', x: 8, y: 1, priority: 'optional' },
    { item_id: 'oil_lamp', x: 5, y: 4, priority: 'optional' },
    { item_id: 'rope', x: 3, y: 5, priority: 'optional' },
    { item_id: 'lucky_clover', x: 6, y: 5, priority: 'optional' },
    { item_id: 'flame_badge', x: 7, y: 5, priority: 'optional' },
    { item_id: 'customer_card', x: 8, y: 5, priority: 'optional' },
    { item_id: 'dagger', x: 2, y: 5, priority: 'optional' },
    { item_id: 'burning_torch', x: 1, y: 5, priority: 'optional' },
    { item_id: 'skull_badge', x: 0, y: 5, priority: 'optional' },
    { item_id: 'chili_goobert', x: 4, y: 5, priority: 'optional' },
  ],
};

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  console.log('build_placements table ok');

  const { rows: builds } = await client.query(
    `select id, slug from public.builds where slug = any($1)`,
    [Object.keys(DEMO_LAYOUTS)],
  );

  for (const b of builds) {
    const layout = DEMO_LAYOUTS[b.slug];
    if (!layout) continue;

    // Only keep items that exist in catalog
    const ids = layout.map((p) => p.item_id);
    const { rows: existing } = await client.query(
      `select id from public.items where id = any($1)`,
      [ids],
    );
    const ok = new Set(existing.map((r) => r.id));
    const rows = layout.filter((p) => ok.has(p.item_id));
    if (!rows.length) {
      console.warn(`skip seed ${b.slug}: none of ${ids.join(', ')} in items`);
      continue;
    }

    await client.query(`delete from public.build_placements where build_id = $1`, [b.id]);
    for (const p of rows) {
      await client.query(
        `insert into public.build_placements (build_id, item_id, x, y, r, priority)
         values ($1, $2, $3, $4, 0, $5)`,
        [b.id, p.item_id, p.x, p.y, p.priority],
      );
    }
    console.log(`seeded ${b.slug}: ${rows.length} placements`);
  }

  await client.query(
    `update public.builds set notes = $1
     where slug = 'infinite-combo-machine' and (notes is null or notes like 'Long-form%' or notes like 'Keep weapons%')`,
    [
      'Keep weapons activating as often as possible. Stack on-hit and haste-style triggers so every swing feeds the next. Essentials are marked on the board and listed below.',
    ],
  );
} finally {
  await client.end();
}
