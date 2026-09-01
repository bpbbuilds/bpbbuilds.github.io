/**
 * Backfill builds.author_id for legacy rows (null author → owner profile).
 * Run: node scripts/_backfill-build-authors.mjs
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

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const { rows: owners } = await client.query(
    `select id, discord_id, display_name
     from public.profiles
     where is_owner = true
     order by created_at nulls last, id`,
  );

  if (owners.length === 0) {
    console.error('No profile with is_owner = true. Bootstrap owner first.');
    process.exit(1);
  }
  if (owners.length > 1) {
    console.error(
      'Multiple is_owner profiles — expected exactly one:',
      owners.map((o) => `${o.display_name} (${o.discord_id})`).join(', '),
    );
    process.exit(1);
  }

  const owner = owners[0];
  const displayName =
    String(owner.display_name || '').trim() ||
    String(owner.discord_id || '').trim() ||
    'Owner';

  console.log(
    `Owner: ${displayName} discord=${owner.discord_id} id=${owner.id}`,
  );

  const { rows: before } = await client.query(`
    select
      count(*)::int as total,
      count(*) filter (where author_id is null)::int as null_author,
      count(*) filter (where author_id is not null)::int as has_author
    from public.builds
  `);
  console.log('Before:', before[0]);

  const { rows: updated } = await client.query(
    `update public.builds
     set author_id = $1,
         author_name = $2
     where author_id is null
     returning slug`,
    [owner.id, displayName],
  );

  console.log(`Updated ${updated.length} build(s):`);
  for (const r of updated) console.log(`  - ${r.slug}`);

  const { rows: after } = await client.query(`
    select
      count(*)::int as total,
      count(*) filter (where author_id is null)::int as null_author,
      count(*) filter (where author_id is not null)::int as has_author
    from public.builds
  `);
  console.log('After:', after[0]);
} finally {
  await client.end();
}
