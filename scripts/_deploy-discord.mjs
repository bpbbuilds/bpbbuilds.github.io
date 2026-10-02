/**
 * Push Discord bot secrets and deploy the membership function plus the
 * Stripe webhook (it mirrors plan changes onto roles).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
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
const keys = [
  'DISCORD_BOT_TOKEN',
  'DISCORD_GUILD_ID',
  'DISCORD_ROLE_PREMIUM',
  'DISCORD_ROLE_FOUNDING',
];
for (const key of keys) {
  if (!env[key]) {
    console.error(`missing ${key} in .env`);
    process.exit(1);
  }
}

const file = path.join(os.tmpdir(), 'bpb-discord-secrets.env');
fs.writeFileSync(
  file,
  keys.map((key) => `${key}=${env[key]}`).join('\n'),
  { encoding: 'utf8' },
);

function run(args) {
  const r = spawnSync('supabase', args, { stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

try {
  console.log('Setting Discord secrets…');
  run(['secrets', 'set', '--env-file', file, '--project-ref', ref]);
  console.log('Deploying discord-guild…');
  run(['functions', 'deploy', 'discord-guild', '--project-ref', ref]);
  console.log('Deploying stripe-webhook…');
  run(['functions', 'deploy', 'stripe-webhook', '--project-ref', ref]);
} finally {
  fs.rmSync(file, { force: true });
}
