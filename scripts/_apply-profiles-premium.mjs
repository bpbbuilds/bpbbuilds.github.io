/**
 * Apply docs/db/sql/014_profiles_premium.sql
 * Run: node scripts/_apply-profiles-premium.mjs
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

const sql = fs.readFileSync('docs/db/sql/014_profiles_premium.sql', 'utf8');

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);

  const { rows: cols } = await client.query(
    `select column_name, data_type
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name in ('plan', 'founding_slot', 'premium_until', 'stripe_customer_id')
     order by column_name`,
  );
  console.log('profiles premium columns:');
  for (const r of cols) console.log(`  ${r.column_name}: ${r.data_type}`);

  const { rows: fn } = await client.query(
    `select proname from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname in ('claim_founding_slot', 'get_founding_status', 'founding_slots_used')
     order by proname`,
  );
  console.log('functions:', fn.map((r) => r.proname).join(', ') || '(none)');

  const { rows: status } = await client.query(`select public.get_founding_status() as status`);
  console.log('get_founding_status:', status[0]?.status);
} finally {
  await client.end();
}
