/**
 * Apply docs/db/sql/012_build_votes.sql
 * Run: node scripts/_apply-build-votes.mjs
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

const sql = fs.readFileSync('docs/db/sql/012_build_votes.sql', 'utf8');

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  const { rows } = await client.query(
    `select column_name, data_type, column_default
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'builds'
       and column_name = 'vote_score'`,
  );
  console.log('builds.vote_score ok');
  for (const r of rows) {
    console.log(`  ${r.column_name}: ${r.data_type} default=${r.column_default}`);
  }
  const { rows: tbl } = await client.query(
    `select count(*)::int as n from public.build_votes`,
  );
  console.log(`build_votes rows: ${tbl[0]?.n ?? 0}`);
} finally {
  await client.end();
}
