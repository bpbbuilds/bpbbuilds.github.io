/**
 * Apply docs/db/sql/006_build_route_items.sql + seed class skill picks.
 * Run: node scripts/_apply-build-route-items.mjs
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

/** Demo Round 3 / Round 10 skill item ids by build slug. */
const ROUTE_SKILLS = {
  'infinite-combo-machine': { r3: 'extra_angy', r10: 'dragon_set' },
  'berserk-bloodline': { r3: 'extra_angy', r10: 'blood_manipulation' },
  'poison-garden-ranger': { r3: 'critical_poison', r10: 'markswoman' },
  'pyro-furnace': { r3: 'energy_conversion', r10: 'everburning' },
  'reaper-harvest': { r3: 'dark_ritual', r10: 'bewitchment' },
};

const sql = fs.readFileSync('docs/db/sql/006_build_route_items.sql', 'utf8');
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  console.log('route item columns ok');

  for (const [slug, picks] of Object.entries(ROUTE_SKILLS)) {
    const { rows: items } = await client.query(
      `select id from public.items where id = any($1)`,
      [[picks.r3, picks.r10]],
    );
    const ok = new Set(items.map((r) => r.id));
    if (!ok.has(picks.r3) || !ok.has(picks.r10)) {
      console.warn(`skip ${slug}: missing`, picks);
      continue;
    }
    const { rowCount } = await client.query(
      `update public.builds
       set route_r3_item_id = $2, route_r10_item_id = $3
       where slug = $1`,
      [slug, picks.r3, picks.r10],
    );
    console.log(`seeded ${slug}: R3=${picks.r3} R10=${picks.r10} (${rowCount})`);
  }
} finally {
  await client.end();
}
