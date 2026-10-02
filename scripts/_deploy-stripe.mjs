/**
 * Deploy Stripe secrets + Edge Functions from .env
 * Run: node scripts/_deploy-stripe.mjs
 */
import fs from 'fs';
import { spawnSync } from 'child_process';

function loadEnv() {
  return Object.fromEntries(
    fs
      .readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
  );
}

const env = loadEnv();
const ref = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const required = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_PREMIUM',
];
for (const k of required) {
  if (!env[k]) {
    console.error(`missing ${k} in .env`);
    process.exit(1);
  }
}

const siteUrl = env.SITE_URL || 'https://bpbbuilds.github.io';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('Setting Supabase secrets…');
run('supabase', [
  'secrets',
  'set',
  `STRIPE_SECRET_KEY=${env.STRIPE_SECRET_KEY}`,
  `STRIPE_WEBHOOK_SECRET=${env.STRIPE_WEBHOOK_SECRET}`,
  `STRIPE_PRICE_ID_PREMIUM=${env.STRIPE_PRICE_ID_PREMIUM}`,
  `SITE_URL=${siteUrl}`,
  `--project-ref`,
  ref,
]);

console.log('Deploying create-checkout…');
run('supabase', [
  'functions',
  'deploy',
  'create-checkout',
  '--project-ref',
  ref,
  '--no-verify-jwt',
  '--use-api',
]);

console.log('Deploying create-portal…');
run('supabase', [
  'functions',
  'deploy',
  'create-portal',
  '--project-ref',
  ref,
  '--no-verify-jwt',
  '--use-api',
]);

console.log('Deploying stripe-webhook…');
run('supabase', [
  'functions',
  'deploy',
  'stripe-webhook',
  '--project-ref',
  ref,
  '--no-verify-jwt',
  '--use-api',
]);

console.log('Done. Register webhook in Stripe Dashboard:');
console.log(
  `  ${env.SUPABASE_PROJECT_URL?.replace(/\/$/, '')}/functions/v1/stripe-webhook`,
);
