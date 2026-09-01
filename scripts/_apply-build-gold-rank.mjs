/**
 * Apply docs/db/sql/007_build_gold_rank.sql + seed demo gold/rank on featured builds.
 * Run: node scripts/_apply-build-gold-rank.mjs
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
if (!env.SUPABASE_DB_PASSWORD) {
  console.error('missing SUPABASE_DB_PASSWORD');
  process.exit(1);
}

const connectionString =
  `postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}` +
  `@${base.hostname}:${base.port || 5432}${base.pathname}`;

const sql = fs.readFileSync('docs/db/sql/007_build_gold_rank.sql', 'utf8');

/** Demo values — rank is a game league key (bronze…grandma). */
const SEEDS = {
  'berserk-bloodline': { gold_count: 42, rank: 'gold' },
  'infinite-combo-machine': { gold_count: 55, rank: 'diamond' },
  'poison-garden-ranger': { gold_count: 38, rank: 'silver' },
  'pyro-furnace': { gold_count: 40, rank: 'platinum' },
  'reaper-harvest': { gold_count: 36, rank: 'master' },
};

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  console.log('builds.gold_count / rank ok');

  for (const [slug, meta] of Object.entries(SEEDS)) {
    const { rowCount } = await client.query(
      `update public.builds
       set gold_count = $2, rank = $3, updated_at = now()
       where slug = $1`,
      [slug, meta.gold_count, meta.rank],
    );
    console.log(`seed ${slug}: gold=${meta.gold_count} rank=${meta.rank} (${rowCount} row)`);
  }
} finally {
  await client.end();
}
