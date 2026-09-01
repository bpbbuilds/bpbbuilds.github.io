/**
 * Apply docs/db/sql/011_build_authenticity_tags.sql
 * Run: node scripts/_apply-build-authenticity-tags.mjs
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

const sql = fs.readFileSync('docs/db/sql/011_build_authenticity_tags.sql', 'utf8');

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  const { rows } = await client.query(
    `select build_tag, count(*)::int as n
     from public.builds
     group by build_tag
     order by build_tag nulls last`,
  );
  console.log('builds.build_tag ok');
  for (const r of rows) {
    console.log(`  ${r.build_tag ?? 'null'}: ${r.n}`);
  }
  const { rows: chk } = await client.query(
    `select pg_get_constraintdef(oid) as def
     from pg_constraint
     where conname = 'builds_build_tag_check'`,
  );
  console.log('constraint:', chk[0]?.def || '(missing)');
} finally {
  await client.end();
}
