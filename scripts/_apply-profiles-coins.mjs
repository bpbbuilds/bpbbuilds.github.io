/**
 * Apply docs/db/sql/022_profiles_coins.sql
 * Run: node scripts/_apply-profiles-coins.mjs
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

const sql = fs.readFileSync('docs/db/sql/022_profiles_coins.sql', 'utf8');

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);

  const { rows: cols } = await client.query(
    `select column_name, data_type, column_default, is_nullable
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'coins'`,
  );
  if (!cols.length) {
    console.error('coins column missing after apply');
    process.exit(1);
  }
  console.log(
    `profiles.coins: ${cols[0].data_type} default=${cols[0].column_default} nullable=${cols[0].is_nullable}`,
  );

  const { rows: sample } = await client.query(
    `select count(*)::int as n, coalesce(sum(coins), 0)::bigint as total
     from public.profiles`,
  );
  console.log(`profiles rows=${sample[0].n} coins_sum=${sample[0].total}`);
} finally {
  await client.end();
}
