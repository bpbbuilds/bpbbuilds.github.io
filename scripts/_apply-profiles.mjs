/**
 * Apply docs/db/sql/013_profiles.sql
 * Run: node scripts/_apply-profiles.mjs
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

const sql = fs.readFileSync('docs/db/sql/013_profiles.sql', 'utf8');

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  const { rows: cols } = await client.query(
    `select column_name, data_type
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
     order by ordinal_position`,
  );
  console.log('profiles columns:');
  for (const r of cols) console.log(`  ${r.column_name}: ${r.data_type}`);

  const { rows: fk } = await client.query(
    `select conname from pg_constraint where conname = 'builds_author_id_fkey'`,
  );
  console.log(
    fk.length
      ? 'builds_author_id_fkey: ok'
      : 'builds_author_id_fkey: MISSING',
  );

  const { rows: fn } = await client.query(
    `select proname from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname in ('bind_my_voter_key', 'handle_new_user')
     order by proname`,
  );
  console.log('functions:', fn.map((r) => r.proname).join(', ') || '(none)');
} finally {
  await client.end();
}
