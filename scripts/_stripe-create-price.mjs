/**
 * Create Stripe Premium product + $3/mo price; write STRIPE_PRICE_ID_PREMIUM to .env
 * Run: node scripts/_stripe-create-price.mjs
 */
import fs from 'fs';

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
if (!key) {
  console.error('missing STRIPE_SECRET_KEY in .env');
  process.exit(1);
}

const mode = key.startsWith('sk_live_') ? 'live' : 'test';
console.log(`Stripe mode: ${mode}`);

async function stripe(path, body) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || res.statusText);
  }
  return data;
}

async function stripeGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `https://api.stripe.com/v1${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || res.statusText);
  }
  return data;
}

// Reuse existing $3/mo Premium price if present
const prices = await stripeGet('/prices', {
  active: 'true',
  limit: '100',
  'expand[]': 'data.product',
});

const existing = (prices.data || []).find((p) => {
  const prod = p.product;
  const name = typeof prod === 'object' ? prod?.name : '';
  return (
    p.type === 'recurring' &&
    p.currency === 'usd' &&
    p.unit_amount === 300 &&
    p.recurring?.interval === 'month' &&
    (name === 'Premium' || name === 'BPB Builds Premium')
  );
});

let priceId = existing?.id || env.STRIPE_PRICE_ID_PREMIUM?.trim();

if (!priceId) {
  const product = await stripe('/products', {
    name: 'Premium',
    description: 'BPB Builds Premium — combat sandbox and member tools',
  });
  const price = await stripe('/prices', {
    product: product.id,
    unit_amount: '300',
    currency: 'usd',
    'recurring[interval]': 'month',
    nickname: 'Premium monthly',
  });
  priceId = price.id;
  console.log('Created product:', product.id);
  console.log('Created price:', priceId, '($3.00/mo USD)');
} else {
  console.log('Using existing price:', priceId);
}

// Update .env without touching other lines
let raw = fs.readFileSync(envPath, 'utf8');
if (/^STRIPE_PRICE_ID_PREMIUM=/m.test(raw)) {
  raw = raw.replace(/^STRIPE_PRICE_ID_PREMIUM=.*$/m, `STRIPE_PRICE_ID_PREMIUM=${priceId}`);
} else {
  raw = raw.trimEnd() + `\nSTRIPE_PRICE_ID_PREMIUM=${priceId}\n`;
}
fs.writeFileSync(envPath, raw);
console.log('Updated .env STRIPE_PRICE_ID_PREMIUM');
