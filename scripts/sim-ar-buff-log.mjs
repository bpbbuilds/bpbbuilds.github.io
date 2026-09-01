/**
 * Phase 263 — grantStacks writes Combat Log / meter buff lines.
 *   node scripts/sim-ar-buff-log.mjs
 */
import fs from 'fs';
import {
  bindBuffCombatLog,
  unbindBuffCombatLog,
  logGrantedStacks,
  collapseDuplicateBuffLogs,
} from '../js/pages/sim/engine/buff-log.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { buildSimDebugReport } from '../js/pages/sim/engine/log-export.js';
import { hydrateSimCoverage } from '../js/pages/sim/engine/scripts/registry.js';

const coverage = JSON.parse(fs.readFileSync('assets/data/sim-item-coverage.json', 'utf8'));
const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
hydrateSimCoverage(coverage, inventory);

const GAME_ITEMS = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const byId = new Map();
for (const it of GAME_ITEMS.items || []) {
  byId.set(it.id, { ...it, shape: it.shape || [[1]], params: it.params || {} });
}

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

{
  const events = [];
  let t = 2.5;
  const dummy = createActor('dummy');
  const player = createActor('player');
  bindBuffCombatLog({ events, getT: () => t, dummy });
  grantStacks(player, 'heat', 3, { originId: 'flame_badge', originKey: 'k' });
  ok(events.length === 1 && events[0].meta?.stack === 'heat', 'grantStacks logs heat buff');
  grantStacks(player, 'heat', 3, { originId: 'flame_badge', originKey: 'k' });
  ok(events.length === 2, 'two identical grants in one tick both log');
  unbindBuffCombatLog();
}

{
  const events = [];
  bindBuffCombatLog({ events, getT: () => 1, dummy: createActor('dummy') });
  events.push({
    t: 1,
    type: 'buff',
    amount: 1,
    itemId: 'leaf_badge',
    meta: { stack: 'lucky' },
  });
  logGrantedStacks(createActor('player'), 'lucky', 1, { originId: 'leaf_badge', t: 1 });
  collapseDuplicateBuffLogs(events);
  ok(events.length === 1, 'collapse drops auto line when port already logged');
  unbindBuffCombatLog();
}

{
  const placements = [
    { id: 'flame_badge', key: 'fb', x: 0, y: 0, r: 0 },
    { id: 'snake', key: 'sn', x: 2, y: 0, r: 0 },
  ];
  const run = simulateEngine({
    placements,
    itemsById: byId,
    durationSec: 8,
    seed: 2631,
  });
  const heatBuffs = (run.events || []).filter(
    (e) => e.type === 'buff' && (e.meta?.stack === 'heat' || /heat/i.test(String(e.label))),
  );
  ok(heatBuffs.length > 0, `flame_badge heat has buff events (${heatBuffs.length})`);
  const report = buildSimDebugReport(run, { itemsById: byId, placements, seed: 2631 });
  const heatMiss = (report.ui?.mismatches || []).filter((m) => m.stack === 'heat');
  ok(heatMiss.length === 0, `no empty Heat-tab mismatch (${heatMiss.length})`);
}

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAR buff-log smoke passed');
