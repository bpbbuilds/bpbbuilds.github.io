/**
 * Phase 258 — AQ boards: loose gems + Port-O-Charger/battery.
 *   node scripts/sim-aq-smoke.mjs
 *
 * Writes compact dump: assets/data/sim-aq-smoke.json
 */
import fs from 'fs';
import { COMBAT_DELAY, simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { buildSimDebugReport } from '../js/pages/sim/engine/log-export.js';

const GAME_ITEMS = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const byId = new Map();
for (const it of GAME_ITEMS.items || []) {
  byId.set(it.id, {
    id: it.id,
    name: it.name,
    type: it.type,
    extraTypes: it.extraTypes,
    cooldown: it.cooldown,
    damageMin: it.damageMin,
    damageMax: it.damageMax,
    accuracy: it.accuracy,
    staminaCost: it.staminaCost,
    params: it.params,
    shape: it.shape || [[1]],
    chance: it.chance,
    chance2: it.chance2,
  });
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

function reportFor(placements, seed, durationSec) {
  const run = simulateEngine({
    placements,
    itemsById: byId,
    durationSec,
    seed,
  });
  const report = buildSimDebugReport(run, {
    itemsById: byId,
    placements,
    seed,
    title: 'aq-smoke',
  });
  return { run, report };
}

function dumpFlags(name, report) {
  const params = report.paramChecks || [];
  const ui = report.ui?.mismatches || [];
  if (params.length) {
    console.error(
      `${name} paramChecks:`,
      params.map((p) => p.expectedKey || p.note).join(' | '),
    );
  }
  if (ui.length) {
    console.error(
      `${name} ui.mismatches:`,
      ui.map((m) => m.hint || m.stack).join(' | '),
    );
  }
  ok(params.length === 0, `${name}: paramChecks empty (got ${params.length})`);
  ok(ui.length === 0, `${name}: ui.mismatches empty (got ${ui.length})`);
  return { paramCheckCount: params.length, mismatchCount: ui.length };
}

const dumps = [];

{
  const placements = [
    { id: 'chipped_ruby', key: 'ruby', x: 0, y: 0, r: 0 },
    { id: 'chipped_emerald', key: 'em', x: 1, y: 0, r: 0 },
    { id: 'chipped_sapphire', key: 'sap', x: 2, y: 0, r: 0 },
  ];
  const { run, report } = reportFor(placements, 2581, 20);
  const rubyActs = (run.events || []).filter(
    (e) => e.type === 'activate' && e.itemId === 'chipped_ruby',
  ).length;
  ok(rubyActs === 1, `loose ruby board: one consume activate (got ${rubyActs})`);
  dumps.push({
    board: 'loose_gems',
    ...dumpFlags('loose gems', report),
    dummyEndHp: run.dummyEndHp,
    eventCount: run.events?.length || 0,
  });
}

{
  const placements = [
    { id: 'engineer_box', key: 'box', x: 0, y: 0, r: 0 },
    { id: 'battery', key: 'bat', x: 0, y: 0, r: 0 },
  ];
  const { run, report } = reportFor(placements, 2582, 14);
  const sparks = (run.events || []).filter(
    (e) => e.type === 'activate' && e.itemId === 'battery' && e.meta?.emitCharge,
  );
  ok(sparks.length === 2, `charger+battery: two emitCharge (got ${sparks.length})`);
  ok(
    sparks[1] && Math.abs(Number(sparks[1].t) - (COMBAT_DELAY + 5)) < 0.08,
    `charger delay ~5s (${sparks[1]?.t})`,
  );
  dumps.push({
    board: 'port_o_charger_battery',
    ...dumpFlags('Port-O-Charger + battery', report),
    dummyEndHp: run.dummyEndHp,
    eventCount: run.events?.length || 0,
  });
}

{
  const placements = [
    { id: 'engineer_box', key: 'box', x: 0, y: 0, r: 0 },
    { id: 'battery', key: 'bat', x: 0, y: 0, r: 0 },
    { id: 'chipped_ruby', key: 'ruby', x: 4, y: 0, r: 0 },
  ];
  const { run, report } = reportFor(placements, 2583, 16);
  dumps.push({
    board: 'charger_battery_ruby',
    ...dumpFlags('combined AQ board', report),
    dummyEndHp: run.dummyEndHp,
    eventCount: run.events?.length || 0,
  });
}

fs.writeFileSync(
  'assets/data/sim-aq-smoke.json',
  `${JSON.stringify({ builtAt: new Date().toISOString(), dumps }, null, 2)}\n`,
);

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAQ smoke passed → assets/data/sim-aq-smoke.json');
