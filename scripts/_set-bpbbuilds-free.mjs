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

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const upd = await client.query(
  `update public.profiles
   set plan = 'free', premium_until = null, updated_at = now()
   where discord_id = '1544380249012314196'
   returning discord_id, display_name, plan, stripe_customer_id`,
);
console.log(upd.rows[0]);
await client.end();
