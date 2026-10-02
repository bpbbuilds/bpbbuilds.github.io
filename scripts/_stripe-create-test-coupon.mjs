/**
 * One-time 100% off promo for portal / checkout smoke tests (live or test).
 * Run: node scripts/_stripe-create-test-coupon.mjs
 */
import fs from 'fs';
import { randomBytes } from 'crypto';

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
if (!key) {
  console.error('missing STRIPE_SECRET_KEY in .env');
  process.exit(1);
}

const mode = key.startsWith('sk_live_') ? 'live' : 'test';
const suffix = randomBytes(3).toString('hex').toUpperCase();
const code = `BPB-PORTAL-${suffix}`;

async function stripe(path, body) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || res.statusText);
  }
  return data;
}

const coupon = await stripe('/coupons', {
  percent_off: '100',
  duration: 'once',
  max_redemptions: '1',
});

const promo = await stripe('/promotion_codes', {
  'promotion[type]': 'coupon',
  'promotion[coupon]': coupon.id,
  code,
  max_redemptions: '1',
  active: 'true',
});

console.log(`Stripe mode: ${mode}`);
console.log(`Promotion code: ${promo.code}`);
console.log(`Coupon id: ${coupon.id}`);
console.log('100% off first invoice · max 1 redemption · deactivate in Dashboard after test');
