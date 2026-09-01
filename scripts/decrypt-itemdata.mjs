/**
 * Decrypt Sheets/CSV/ItemData_e.csv from a GDRE recover folder.
 *
 * The sheet key is bytes 0..31 with runtime mutations at indexes 5 and 12
 * (same pattern as the script AES key). Live key is read from tools/keydot/sheet_key.txt
 * when present; otherwise the known mutation of 0..31 is used.
 *
 * Usage:
 *   node scripts/decrypt-itemdata.mjs
 *   node scripts/decrypt-itemdata.mjs path/to/ItemData_e.csv
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_ENC = path.join(
  ROOT,
  'tools/game-extract-full/Sheets/CSV/ItemData_e.csv',
);
const OUT = path.join(__dirname, '_cache', 'ItemData.csv');
const SHEET_KEY_FILE = path.join(ROOT, 'tools/keydot/sheet_key.txt');

/** Default mutated 0..31 sheet key (indexes 5 and 12 patched at runtime). */
function defaultSheetKey() {
  const key = Buffer.from(Array.from({ length: 32 }, (_, i) => i));
  key[5] = 0xc6;
  key[12] = 0xc3;
  return key;
}

function loadSheetKey() {
  if (fs.existsSync(SHEET_KEY_FILE)) {
    const hex = fs.readFileSync(SHEET_KEY_FILE, 'utf8').trim();
    if (/^[0-9a-fA-F]{64}$/.test(hex)) return Buffer.from(hex, 'hex');
  }
  return defaultSheetKey();
}

function decryptGdec(buf, key) {
  if (buf.subarray(0, 4).toString('ascii') !== 'GDEC') {
    throw new Error('not a GDEC file');
  }
  const md5exp = buf.subarray(8, 24);
  const length = Number(buf.readBigUInt64LE(24));
  const padded = length + ((16 - (length % 16)) % 16);
  const enc = buf.subarray(32, 32 + padded);
  const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
  decipher.setAutoPadding(false);
  const pt = Buffer.concat([decipher.update(enc), decipher.final()]).subarray(0, length);
  const md5 = crypto.createHash('md5').update(pt).digest();
  if (!md5.equals(md5exp)) {
    throw new Error('MD5 mismatch — wrong sheet key (re-dump tools/keydot/sheet_key.txt)');
  }
  return pt;
}

function main() {
  const encPath = path.resolve(process.argv[2] || DEFAULT_ENC);
  if (!fs.existsSync(encPath)) {
    console.error('missing', encPath);
    process.exit(1);
  }
  const key = loadSheetKey();
  const pt = decryptGdec(fs.readFileSync(encPath), key);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, pt);
  console.log('wrote', OUT, `(${pt.length} bytes)`);
}

main();
