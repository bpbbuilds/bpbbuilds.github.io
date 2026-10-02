/**
 * Apply docs/db/sql/024_event_entry_privacy.sql
 * Run: node scripts/_apply-event-gallery.mjs
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

const sql = fs.readFileSync('docs/db/sql/024_event_entry_privacy.sql', 'utf8');
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

await client.connect();
try {
  await client.query(sql);
  const { rows } = await client.query(
    `select event_slug, is_public, event_held, count(*)::int as n
     from public.builds
     where event_slug is not null
     group by event_slug, is_public, event_held
     order by event_slug`,
  );
  console.log(JSON.stringify(rows, null, 2));
} finally {
  await client.end();
}
