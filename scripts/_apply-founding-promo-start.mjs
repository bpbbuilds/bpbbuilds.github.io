/**
 * Apply docs/db/sql/016_founding_promo_start.sql
 * Run: node scripts/_apply-founding-promo-start.mjs
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

const sql = fs.readFileSync('docs/db/sql/016_founding_promo_start.sql', 'utf8');

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);

  const { rows: promo } = await client.query(
    `select id, started_at from public.founding_promo where id = true`,
  );
  console.log('founding_promo:', promo[0] ?? '(missing)');

  const { rows: status } = await client.query(`select public.get_founding_status() as status`);
  console.log('get_founding_status:', status[0]?.status);
} finally {
  await client.end();
}
