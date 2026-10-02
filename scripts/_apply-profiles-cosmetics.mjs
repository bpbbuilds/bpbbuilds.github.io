/**
 * Apply docs/db/sql/021_profiles_cosmetic_grants.sql + 022_profiles_coins.sql
 * Run: node scripts/_apply-profiles-cosmetics.mjs
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

const files = [
  'docs/db/sql/021_profiles_cosmetic_grants.sql',
  'docs/db/sql/022_profiles_coins.sql',
];

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query('begin');
  for (const f of files) await client.query(fs.readFileSync(f, 'utf8'));
  await client.query('commit');
  await client.query(`notify pgrst, 'reload schema'`);

  const { rows } = await client.query(
    `select column_name, data_type, column_default
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name in ('cosmetic_grants', 'coins')
     order by column_name`,
  );
  for (const r of rows) {
    console.log(`profiles.${r.column_name}: ${r.data_type} default=${r.column_default}`);
  }
  if (rows.length !== 2) {
    console.error('expected cosmetic_grants + coins after apply');
    process.exitCode = 1;
  }
} catch (err) {
  await client.query('rollback').catch(() => {});
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end();
}
