/**
 * Write a tiny history.db with one run + two rounds (leather_bag on board).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'history-mini.db');

const MAX_HEALTH = 999;
const MAX_STAMINA = 999;
const MAX_SIZE = 10;
const BASE64_OFFSET = 62;
const NUM_ITEMS = 518;

function ceilLog2(n) {
  if (n <= 1) return 0;
  return Math.ceil(Math.log2(n));
}

/** @param {number[]} bits @param {number} value @param {number} rangeMax */
function push(bits, value, rangeMax) {
  const nbits = ceilLog2(rangeMax);
  for (let d = nbits - 1; d >= 0; d -= 1) {
    bits.push((value >> d) & 1);
  }
}

/** @param {number[]} bits */
function toGodotString(bits) {
  const b = bits.slice();
  while (b.length % 6) b.push(0);
  let s = '';
  for (let i = 0; i < b.length; i += 6) {
    let offset = 0;
    for (let d = 0; d < 6; d += 1) {
      if (b[i + d]) offset |= 1 << (5 - d);
    }
    s += String.fromCharCode(offset + BASE64_OFFSET);
  }
  return s;
}

/** leather_bag gid 11 at (3,3) */
function encodeBoard() {
  const bits = [];
  push(bits, 100, MAX_HEALTH);
  push(bits, 100, MAX_STAMINA);
  push(bits, 11, NUM_ITEMS);
  push(bits, 3, MAX_SIZE);
  push(bits, 3, MAX_SIZE);
  push(bits, 0, 4);
  return toGodotString(bits);
}

const wasmPath = path.join(ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');
const SQL = await initSqlJs({
  locateFile: () => wasmPath,
});
const db = new SQL.Database();
db.run(`
  CREATE TABLE runData (
    runID INTEGER PRIMARY KEY,
    class INTEGER,
    loadout INTEGER,
    rank INTEGER,
    version INTEGER,
    time INTEGER,
    subclass INTEGER,
    skill1 INTEGER,
    skill2 INTEGER
  );
  CREATE TABLE roundData (
    runID INTEGER,
    roundID INTEGER,
    result INTEGER,
    buildInfo TEXT,
    tries INTEGER
  );
`);

const buildInfo = encodeBoard();
const now = Math.floor(Date.now() / 1000) - 3600 * 26;
const version = 1_001_000; // 1.1.0

db.run(
  `INSERT INTO runData (runID, class, loadout, rank, version, time, subclass, skill1, skill2)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [1, 0, 0, 55, version, now, 0, 0, 0],
);
db.run(
  `INSERT INTO roundData (runID, roundID, result, buildInfo, tries) VALUES (?, ?, ?, ?, ?)`,
  [1, 1, 0, buildInfo, 3],
);
db.run(
  `INSERT INTO roundData (runID, roundID, result, buildInfo, tries) VALUES (?, ?, ?, ?, ?)`,
  [1, 2, 1, buildInfo, 2],
);

const data = db.export();
fs.writeFileSync(OUT, Buffer.from(data));
db.close();
console.log('Wrote', OUT, 'buildInfo', JSON.stringify(buildInfo));
