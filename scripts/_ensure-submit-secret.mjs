/**
 * Ensure BPB_SUBMIT_SECRET exists in .env (generate if missing).
 * Does not print the secret value.
 */
import fs from 'fs';
import crypto from 'crypto';

const path = '.env';
let text = fs.readFileSync(path, 'utf8');
const m = text.match(/^BPB_SUBMIT_SECRET=(.*)$/m);
const existing = m?.[1]?.trim();
if (existing && !existing.includes('YOUR_')) {
  console.log('BPB_SUBMIT_SECRET already set in .env');
  process.exit(0);
}

const secret = crypto.randomBytes(32).toString('hex');
if (/^BPB_SUBMIT_SECRET=/m.test(text)) {
  text = text.replace(/^BPB_SUBMIT_SECRET=.*$/m, `BPB_SUBMIT_SECRET=${secret}`);
} else {
  if (!text.endsWith('\n')) text += '\n';
  text +=
    '\n# Owner-only create Submit (Edge Function header x-bpb-submit-secret)\n' +
    `BPB_SUBMIT_SECRET=${secret}\n`;
}
fs.writeFileSync(path, text);
console.log('BPB_SUBMIT_SECRET generated and written to .env');
