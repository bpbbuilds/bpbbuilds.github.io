/**
 * Apply docs/db/sql/015_drop_route_amulet.sql
 * Run: node scripts/_apply-drop-route-amulet.mjs
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
const password = env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error('missing SUPABASE_DB_PASSWORD');
  process.exit(1);
}

const connectionString =
  `postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(password)}` +
  `@${base.hostname}:${base.port || 5432}${base.pathname}`;

const sql = fs.readFileSync('docs/db/sql/015_drop_route_amulet.sql', 'utf8');
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  const { rows } = await client.query(
    `select column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'builds'
       and column_name = 'route_amulet_item_id'`,
  );
  console.log(
    rows.length
      ? 'FAILED: builds.route_amulet_item_id still present'
      : 'ok: builds.route_amulet_item_id dropped',
  );
  if (rows.length) process.exit(1);
} finally {
  await client.end();
}
