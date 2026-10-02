/**
 * Apply docs/db/sql/017_profiles_equipped_avatar.sql
 * Run: node scripts/_apply-equipped-avatar.mjs
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

const sql = fs.readFileSync('docs/db/sql/017_profiles_equipped_avatar.sql', 'utf8');

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);

  const { rows: cols } = await client.query(
    `select column_name, data_type, is_nullable
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'equipped_avatar'`,
  );
  if (!cols.length) {
    console.error('equipped_avatar column missing after apply');
    process.exit(1);
  }
  console.log(
    `profiles.equipped_avatar: ${cols[0].data_type} (nullable=${cols[0].is_nullable})`,
  );
} finally {
  await client.end();
}
