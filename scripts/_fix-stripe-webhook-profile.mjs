/**
 * One-off: fix bpbbuilds profile + point Stripe webhook at BPB Supabase project.
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

const key = env.STRIPE_SECRET_KEY;
const bpbWebhook =
  `${env.SUPABASE_PROJECT_URL.replace(/\/$/, '')}/functions/v1/stripe-webhook`;

const client = new pg.Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const r = await client.query(
  `update public.profiles
   set plan = 'premium', premium_until = null, updated_at = now()
   where id = 'c3eed466-d546-48f7-aa4f-640bfb47091f'
   returning discord_id, display_name, plan, stripe_customer_id`,
);
console.log('profile fixed:', r.rows[0]);
await client.end();

const wh = await fetch('https://api.stripe.com/v1/webhook_endpoints/we_1UAiXo1qXkld5X0WuYgaqm8G', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({ url: bpbWebhook }).toString(),
});
const whData = await wh.json();
console.log('webhook url now:', whData.url || whData.error?.message);
