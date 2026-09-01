import fs from 'fs';
import pg from 'pg';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/)
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

// Prefer explicit password from .env — DB URL password can be stale/truncated.
const connectionString =
  `postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(password)}` +
  `@${base.hostname}:${base.port || 5432}${base.pathname}`;

const sql = fs.readFileSync('docs/db/sql/001_builds.sql', 'utf8');
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  const { rows } = await client.query(
    'select slug, title, hero_class, is_op, is_featured from public.builds order by id',
  );
  console.log('ok rows:', rows.length);
  for (const r of rows) {
    console.log(`- ${r.slug} | ${r.hero_class} | op=${r.is_op} featured=${r.is_featured}`);
  }
} finally {
  await client.end();
}
