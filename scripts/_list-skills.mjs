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
  const types = await client.query(
    `select distinct type from items where type is not null order by type`,
  );
  console.log('types:', types.rows.map((r) => r.type).join(', '));

  const skills = await client.query(
    `select id, name, type, class from items
     where type = 'Skill' or type ilike '%skill%'
     order by class nulls last, name
     limit 80`,
  );
  console.log('\nskills:');
  for (const r of skills.rows) console.log(`${r.id}\t${r.class || '-'}\t${r.name}`);

  const builds = await client.query(`select slug, route_r3, route_r10, hero_class from builds`);
  console.log('\nbuilds routes:', builds.rows);
} finally {
  await client.end();
}
