/**
 * Reciprocal-rank fusion. k=60, equal signals, no weights fit on the benchmark.
 * Signals: raw NCC, edge NCC, one normalization's NCC, DINOv2 on raw crops,
 * DINOv2 on that same normalization. Truth is used only to score.
 */
import fs from 'node:fs';
import path from 'node:path';
import { BRIGHT_FIXTURES, CLEAN_BRIGHT, FIXTURES, similar1x1, outDir } from './shared.mjs';

const K = 60;
const pool = JSON.parse(fs.readFileSync(path.join(outDir, 'pool.json'), 'utf8'));
const idToPool = new Map(pool.map((p) => [p.id, p.pool]));
const nccReport = JSON.parse(fs.readFileSync(path.join(outDir, 'ncc-report.json'), 'utf8'));
const chosen = nccReport.chosen || 'clahe';
const embed = JSON.parse(fs.readFileSync(path.join(outDir, 'embed-orders.json'), 'utf8'));

const ncc = new Map();
for (const name of FIXTURES) {
  const file = path.join(outDir, 'scores', `${name}.json`);
  if (!fs.existsSync(file)) continue;
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const row of doc.rows) ncc.set(`${name}|${row.i}`, row);
}

function rrf(lists) {
  const score = new Map();
  for (const list of lists) {
    if (!list) continue;
    for (let i = 0; i < list.length; i++) score.set(list[i], (score.get(list[i]) || 0) + 1 / (K + i + 1));
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
}

function embedOrder(variant, fixture, i) {
  const rows = embed[variant] || [];
  const row = rows.find((r) => r.fixture === fixture && r.i === i);
  return row?.order || null;
}

const signals = ['ncc-raw', 'ncc-edge', `ncc-${chosen}`, 'dino-raw', `dino-${chosen}`];
const combos = {
  'ncc+edge': ['ncc-raw', 'ncc-edge'],
  'ncc+dino': ['ncc-raw', 'dino-raw'],
  'edge+dino': ['ncc-edge', 'dino-raw'],
  'ncc+edge+dino': ['ncc-raw', 'ncc-edge', 'dino-raw'],
  [`norm+edge+dino`]: [`ncc-${chosen}`, 'ncc-edge', `dino-${chosen}`],
  'all': ['ncc-raw', 'ncc-edge', `ncc-${chosen}`, 'dino-raw', `dino-${chosen}`],
};

function pack(list) {
  const n = list.length;
  const c = (k) => list.filter((r) => r.rank > 0 && r.rank <= k).length;
  return { n, top1: c(1), top3: c(3), top5: c(5), top10: c(10), top20: c(20) };
}

const buckets = {};
for (const [combo, keys] of Object.entries(combos)) {
  const rows = [];
  for (const [key, row] of ncc) {
    if (row.kind !== 'item' || !row.truthId) continue;
    const lists = {
      'ncc-raw': row.methods?.raw?.order,
      'ncc-edge': row.methods?.edge?.order,
      [`ncc-${chosen}`]: row.methods?.[chosen]?.order,
      'dino-raw': embedOrder('raw', key.split('|')[0], row.i),
      [`dino-${chosen}`]: embedOrder(chosen, key.split('|')[0], row.i),
    };
    const used = keys.map((k) => lists[k]).filter(Boolean);
    if (!used.length) continue;
    const order = rrf(used);
    const truth = idToPool.get(row.truthId);
    const rank = truth == null ? 0 : order.indexOf(truth) + 1;
    const fixture = key.split('|')[0];
    rows.push({
      fixture, rank, area: row.area, name: row.name,
      bright: BRIGHT_FIXTURES.has(fixture),
      clean: CLEAN_BRIGHT.has(fixture),
      similar: similar1x1(row.name, row.area),
      largeShot: fixture === 'real-003',
    });
  }
  const dim = rows.filter((r) => !r.bright);
  buckets[combo] = {
    signals: keys,
    all: pack(rows),
    bright: pack(rows.filter((r) => r.bright)),
    cleanBright: pack(rows.filter((r) => r.clean)),
    dimmed: pack(dim),
    similar1x1: pack(rows.filter((r) => r.similar)),
    largeItems: pack(rows.filter((r) => (r.area || 1) >= 4)),
    oneByOne: pack(rows.filter((r) => (r.area || 1) === 1)),
    largeShot: pack(rows.filter((r) => r.largeShot)),
  };
}

const report = {
  fusion: 'reciprocal rank, k=60, equal signals, no benchmark-fit weights',
  chosenNormalization: chosen,
  pool: pool.length,
  buckets,
};
fs.writeFileSync(path.join(outDir, 'fusion-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(buckets, null, 2));
