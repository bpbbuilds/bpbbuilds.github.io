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
const connectionString =
  `postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}` +
  `@${base.hostname}:${base.port || 5432}${base.pathname}`;

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const cols = await client.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'builds'
       and column_name in ('route_r3', 'route_r10')
     order by column_name`,
  );
  console.log('route cols:', cols.rows.map((r) => r.column_name).join(', ') || '(none)');

  const counts = await client.query(
    `select b.slug, count(*)::int as n
     from builds b
     join build_placements p on p.build_id = b.id
     group by b.slug
     order by b.slug`,
  );
  console.log('placements:', counts.rows);

  const one = await client.query(
    `select slug, route_r3, route_r10, left(notes, 60) as notes
     from builds where slug = 'infinite-combo-machine'`,
  );
  console.log('sample build:', one.rows[0]);
} finally {
  await client.end();
}
