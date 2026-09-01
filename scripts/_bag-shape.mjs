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

const ids = [
  'ranger_bag',
  'berserker_bag',
  'holdall',
  'leather_bag',
  'piggy_of_riches',
  'piggybank',
  'broom',
  'wooden_sword',
  'pan',
  'banana',
  'stone',
  'wooden_buckler',
];

await client.connect();
try {
  const { rows } = await client.query(
    `select id, name, type, shape from items where id = any($1) order by type, name`,
    [ids],
  );
  for (const r of rows) {
    console.log(r.id, r.name, JSON.stringify(r.shape));
  }
} finally {
  await client.end();
}
