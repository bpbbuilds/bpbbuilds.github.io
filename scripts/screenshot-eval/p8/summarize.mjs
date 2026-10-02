/**
 * Collapse per-fixture NCC score files into the P8 retrieval table.
 * Ordinary items only for the decision metric. Truth is used only to score.
 */
import fs from 'node:fs';
import path from 'node:path';
import { BRIGHT_FIXTURES, CLEAN_BRIGHT, FIXTURES, similar1x1, outDir } from './shared.mjs';
import { METHODS } from './normalize.mjs';

const scores = [];
for (const name of FIXTURES) {
  const file = path.join(outDir, 'scores', `${name}.json`);
  if (!fs.existsSync(file)) continue;
  scores.push(JSON.parse(fs.readFileSync(file, 'utf8')));
}

function rowsOf(method) {
  const out = [];
  for (const fix of scores) {
    for (const row of fix.rows) {
      const hit = row.methods?.[method];
      if (!hit || row.kind !== 'item' || !hit.rank) continue;
      out.push({
        fixture: fix.fixture,
        ...row,
        hit,
        bright: BRIGHT_FIXTURES.has(fix.fixture),
        clean: CLEAN_BRIGHT.has(fix.fixture),
        similar: similar1x1(row.name, row.area),
        largeItem: (row.area || 1) >= 4,
        one: (row.area || 1) === 1,
      });
    }
  }
  return out;
}

function pack(list) {
  const n = list.length;
  const c = (k) => list.filter((r) => r.hit.rank <= k).length;
  return { n, top1: c(1), top3: c(3), top5: c(5), top10: c(10), top20: c(20) };
}

const byFixture = (list) => Object.fromEntries(FIXTURES.map((f) => [f, pack(list.filter((r) => r.fixture === f))]));

function rotation(list) {
  const sel = list.filter((r) => r.oblong && r.r != null);
  return {
    n: sel.length,
    faceMatchesLabel: sel.filter((r) => r.hit.face === r.r).length,
  };
}

const table = {};
for (const method of METHODS) {
  const list = rowsOf(method.id);
  const bright = list.filter((r) => r.bright);
  const dim = list.filter((r) => !r.bright);
  const clean = list.filter((r) => r.clean);
  table[method.id] = {
    all: pack(list),
    bright: pack(bright),
    cleanBright: pack(clean),
    dimmed: pack(dim),
    similar1x1: pack(list.filter((r) => r.similar)),
    oneByOne: pack(list.filter((r) => r.one)),
    largeItems: pack(list.filter((r) => r.largeItem)),
    largeShot: pack(list.filter((r) => r.fixture === 'real-003')),
    byFixture: byFixture(list),
    rotation: rotation(list),
  };
}

const raw = table.raw;
const candidates = METHODS.filter((m) => m.id !== 'raw');
const within = candidates.filter((m) => table[m.id].cleanBright.top5 >= raw.cleanBright.top5 - 3);
const pool = within.length ? within : candidates;
pool.sort((a, b) => {
  const d = table[b.id].dimmed.top5 - table[a.id].dimmed.top5;
  if (d) return d;
  return table[b.id].cleanBright.top5 - table[a.id].cleanBright.top5;
});
const chosen = pool[0]?.id || 'raw';

function examples(method) {
  const list = rowsOf('raw');
  const other = new Map(rowsOf(method).map((r) => [`${r.fixture}|${r.i}`, r]));
  const rescued = [];
  const damaged = [];
  for (const r of list) {
    const o = other.get(`${r.fixture}|${r.i}`);
    if (!o) continue;
    if (r.hit.rank > 20 && o.hit.rank <= 5) rescued.push({ fixture: r.fixture, name: r.name, x: r.x, y: r.y, raw: r.hit.rank, next: o.hit.rank, top: o.hit.top5[0]?.name });
    if (r.hit.rank <= 5 && o.hit.rank > 20) damaged.push({ fixture: r.fixture, name: r.name, x: r.x, y: r.y, raw: r.hit.rank, next: o.hit.rank, top: o.hit.top5[0]?.name });
  }
  return { rescued: rescued.slice(0, 8), damaged: damaged.slice(0, 8) };
}

const elapsedMs = scores.reduce((s, f) => s + (f.elapsedMs || 0), 0);
const report = {
  date: '2026-10-01',
  experiment: 'P8 photometric normalization sweep',
  pool: scores[0]?.pool || null,
  elapsedMs,
  elapsedNote: 'Sum of per-fixture wall times. Fixtures ran in parallel, so the clock time is closer to the slowest fixture.',
  perFixtureElapsedMs: Object.fromEntries(scores.map((f) => [f.fixture, f.elapsedMs])),
  decision: 'ordinary-item candidate recall. Pool is every catalog class with a 2x thumb. Shape is not used to shrink the pool.',
  selectionRule: 'Among normalizations whose clean-bright (pine-protector + real-010) top-5 is within 3 of raw, pick the highest dimmed-fixture top-5. Equal RRF later uses that method. The rule does not fit weights.',
  chosen,
  table,
  examplesVsRaw: examples(chosen),
};
fs.writeFileSync(path.join(outDir, 'ncc-report.json'), JSON.stringify(report, null, 2));
const line = (id) => {
  const t = table[id];
  return [id, t.all.top1, t.all.top5, t.all.top10, t.all.top20, t.bright.top5, t.dimmed.top5, t.cleanBright.top5, t.rotation.faceMatchesLabel + '/' + t.rotation.n].join('\t');
};
console.log(['method', 'top1', 'top5', 'top10', 'top20', 'brightTop5', 'dimTop5', 'cleanTop5', 'rot'].join('\t'));
for (const m of METHODS) console.log(line(m.id));
console.log('chosen', chosen, 'elapsedSec', Math.round(elapsedMs / 1000));
