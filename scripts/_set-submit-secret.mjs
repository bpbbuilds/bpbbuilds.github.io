/**
 * Set BPB_SUBMIT_SECRET on the linked Supabase project from .env
 * (does not print the secret).
 */
import fs from 'fs';
import { spawnSync } from 'child_process';

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

const secret = env.BPB_SUBMIT_SECRET;
if (!secret || secret.includes('YOUR_')) {
  console.error('BPB_SUBMIT_SECRET missing in .env — run node scripts/_ensure-submit-secret.mjs');
  process.exit(1);
}

const r = spawnSync(
  'supabase',
  ['secrets', 'set', `BPB_SUBMIT_SECRET=${secret}`, '--project-ref', 'xklkysmakrmgtiztsqug'],
  { stdio: 'inherit', shell: true },
);
process.exit(r.status ?? 1);
