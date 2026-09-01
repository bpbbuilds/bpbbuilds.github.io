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
const client = new pg.Client({
  connectionString:
    `postgresql://${encodeURIComponent(base.username)}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}` +
    `@${base.hostname}:${base.port || 5432}${base.pathname}`,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const { rows } = await client.query(
    `select id, name from items where type = 'Bag' order by name limit 40`,
  );
  for (const r of rows) console.log(`${r.id}\t${r.name}`);
} finally {
  await client.end();
}
