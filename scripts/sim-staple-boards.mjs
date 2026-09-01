/**
 * Phase 260 / 264 — class staple boards: dump `bpb-sim-debug` flags.
 * Phase 264: ui.mismatches must be empty (`npm run sim-ar-milestone`).
 *   node scripts/sim-staple-boards.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { buildSimDebugReport } from '../js/pages/sim/engine/log-export.js';
import { hydrateSimCoverage } from '../js/pages/sim/engine/scripts/registry.js';
import {
  auditSimDebugDump,
  formatAuditReport,
} from '../js/pages/sim/engine/audit-debug.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FIX_DIR = path.join(__dirname, 'fixtures', 'parity');
const OUT_JSON = path.join(ROOT, 'assets', 'data', 'sim-staple-boards.json');
const OUT_DUMP_DIR = path.join(__dirname, 'fixtures', 'debug', 'staple');

const STAPLES = [
  { heroClass: 'Ranger', slug: 'poison-garden-ranger' },
  { heroClass: 'Pyromancer', slug: 'pyro-furnace' },
  { heroClass: 'Berserker', slug: 'berserk-bloodline' },
  { heroClass: 'Reaper', slug: 'reaper-harvest' },
  { heroClass: 'Adventurer', slug: 'history-3705' },
  { heroClass: 'Engineer', slug: 'history-3703' },
];

const coverage = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets/data/sim-item-coverage.json'), 'utf8'),
);
const inventory = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets/data/sim-item-inventory.json'), 'utf8'),
);
hydrateSimCoverage(coverage, inventory);

const gameItems = JSON.parse(
  fs.readFileSync(path.join(__dirname, '_cache', 'game-items.json'), 'utf8'),
);
const catalog = new Map((gameItems.items || []).map((it) => [it.id, it]));

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

function itemsFor(ids) {
  const m = new Map();
  for (const id of ids) {
    const it = catalog.get(id);
    m.set(
      id,
      it
        ? {
            ...it,
            shape: it.shape || [[1]],
            params: it.params || {},
          }
        : {
            id,
            name: id,
            type: 'Accessory',
            cooldown: 5,
            damageMin: 0,
            damageMax: 0,
            shape: [[1]],
            params: {},
          },
    );
  }
  return m;
}

function compactDump(report) {
  return {
    kind: report.kind,
    v: report.v,
    slug: report.slug,
    seed: report.seed,
    durationSec: report.durationSec,
    dummyEndHp: report.dummyEndHp,
    playerEndHp: report.playerEndHp,
    eventCount: report.eventCount,
    catalog: report.catalog,
    paramChecks: report.paramChecks,
    unhealingMath: report.unhealingMath,
    status: report.status,
    ui: report.ui,
  };
}

function summarizeFlags(report) {
  const params = report.paramChecks || [];
  const ui = report.ui?.mismatches || [];
  return {
    paramCheckCount: params.length,
    mismatchCount: ui.length,
    paramChecks: params.map((p) => ({
      itemId: p.itemId || null,
      expectedKey: p.expectedKey || null,
      stack: p.stack || null,
      note: p.note || null,
    })),
    mismatches: ui.map((m) => ({
      itemId: m.itemId || null,
      stack: m.stack || null,
      hint: m.hint || m.note || null,
    })),
  };
}

fs.mkdirSync(OUT_DUMP_DIR, { recursive: true });

const dumps = [];

for (const row of STAPLES) {
  const fp = path.join(FIX_DIR, `${row.slug}.json`);
  ok(fs.existsSync(fp), `${row.heroClass}: fixture ${row.slug}.json exists`);
  if (!fs.existsSync(fp)) continue;

  const fix = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const ids = [...new Set(fix.placements.map((p) => p.id))];
  for (const p of fix.placements) {
    for (const g of p.gems || []) if (g) ids.push(g);
  }
  const itemsById = itemsFor(ids);
  const placements = fix.placements.map((p) => ({
    id: p.id,
    key: p.key,
    x: p.x,
    y: p.y,
    r: p.r || 0,
    gems: p.gems || [],
  }));
  const seed = fix.seed ?? 42;
  const durationSec = fix.durationSec ?? 30;

  let run;
  try {
    run = simulateEngine({ placements, itemsById, seed, durationSec });
  } catch (e) {
    ok(false, `${row.heroClass}: sim threw ${e.message || e}`);
    continue;
  }

  const report = buildSimDebugReport(run, {
    itemsById,
    placements,
    seed,
    slug: row.slug,
    title: `staple-${row.heroClass}`,
  });
  const audit = auditSimDebugDump(report, inventory);
  ok(audit.ok && report.kind === 'bpb-sim-debug', `${row.heroClass}: dump kind`);
  ok(placements.length > 0, `${row.heroClass}: placements (${placements.length})`);

  const flags = summarizeFlags(report);
  console.log(
    `  ${row.heroClass} ${row.slug}: paramChecks=${flags.paramCheckCount} mismatches=${flags.mismatchCount} pHP=${run.playerEndHp} dHP=${run.dummyEndHp}`,
  );
  if (flags.paramCheckCount || flags.mismatchCount) {
    console.log(formatAuditReport(audit).split('\n').slice(0, 24).join('\n'));
  }

  const compact = compactDump(report);
  fs.writeFileSync(
    path.join(OUT_DUMP_DIR, `${row.slug}.json`),
    `${JSON.stringify(compact, null, 2)}\n`,
  );

  dumps.push({
    heroClass: row.heroClass,
    slug: row.slug,
    dummyEndHp: run.dummyEndHp,
    playerEndHp: run.playerEndHp,
    eventCount: run.events?.length || 0,
    emptyFlagsAreNotALivePass: audit.emptyFlagsAreNotALivePass,
    ...flags,
  });
}

ok(dumps.length === 6, `six class staple dumps (got ${dumps.length})`);
ok(
  STAPLES.every((s) => dumps.some((d) => d.heroClass === s.heroClass)),
  'Ranger / Pyromancer / Berserker / Reaper / Adventurer / Engineer present',
);

fs.writeFileSync(
  OUT_JSON,
  `${JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      note: 'Phase 264: ui.mismatches required empty on these boards. Empty flags are not a live pass. paramChecks may remain.',
      dumps,
    },
    null,
    2,
  )}\n`,
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log(`\nStaple dumps → ${path.relative(ROOT, OUT_JSON)}`);
