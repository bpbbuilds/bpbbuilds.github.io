/**
 * Recreate Stripe webhook endpoint (refresh signing secret) + set bpbbuilds to free after cancel.
 * Run: node scripts/_fix-stripe-webhook-secret.mjs
 */
import fs from 'fs';
import { spawnSync } from 'child_process';
import pg from 'pg';

const envPath = '.env';
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const key = env.STRIPE_SECRET_KEY;
const projectUrl = (env.SUPABASE_PROJECT_URL || '').replace(/\/$/, '');
if (!key || !projectUrl) {
  console.error('Need STRIPE_SECRET_KEY and SUPABASE_PROJECT_URL');
  process.exit(1);
}

const webhookUrl = `${projectUrl}/functions/v1/stripe-webhook`;
const OLD_WH = 'we_1UAiXo1qXkld5X0WuYgaqm8G';

async function stripe(method, path, body) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body
        ? { 'Content-Type': 'application/x-www-form-urlencoded' }
        : {}),
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || res.statusText);
  }
  return data;
}

console.log('Deleting old webhook endpoint…');
try {
  await stripe('DELETE', `/webhook_endpoints/${OLD_WH}`);
  console.log('Deleted', OLD_WH);
} catch (err) {
  console.warn('Delete old:', err instanceof Error ? err.message : err);
}

console.log('Creating webhook endpoint…', webhookUrl);
const created = await stripe('POST', '/webhook_endpoints', {
  url: webhookUrl,
  'enabled_events[0]': 'checkout.session.completed',
  'enabled_events[1]': 'customer.subscription.updated',
  'enabled_events[2]': 'customer.subscription.deleted',
  'enabled_events[3]': 'invoice.paid',
  'enabled_events[4]': 'invoice.payment_failed',
  description: 'BPB Builds profiles entitlement',
});

const secret = String(created.secret || '');
if (!secret.startsWith('whsec_')) {
  console.error('Create response missing secret', created.id);
  process.exit(1);
}

console.log('New endpoint:', created.id);
console.log('Updating .env STRIPE_WEBHOOK_SECRET…');
let raw = fs.readFileSync(envPath, 'utf8');
if (/^STRIPE_WEBHOOK_SECRET=/m.test(raw)) {
  raw = raw.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, `STRIPE_WEBHOOK_SECRET=${secret}`);
} else {
  raw = raw.trimEnd() + `\nSTRIPE_WEBHOOK_SECRET=${secret}\n`;
}
fs.writeFileSync(envPath, raw);

const ref = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
console.log('Setting Supabase secret…');
const r = spawnSync(
  'supabase',
  ['secrets', 'set', `STRIPE_WEBHOOK_SECRET=${secret}`, '--project-ref', ref],
  { stdio: 'inherit', shell: true },
);
if (r.status !== 0) process.exit(r.status ?? 1);

console.log('Setting bpbbuilds plan → free (cancel smoke after failed delivery)…');
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
console.log('profile:', upd.rows[0]);
await client.end();

console.log('Done. Redeploy stripe-webhook so it picks up the new secret env on cold start.');
