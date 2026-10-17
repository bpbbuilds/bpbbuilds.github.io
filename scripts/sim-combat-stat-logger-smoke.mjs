/**
 * CombatStatLogger parity smoke: source histories and simulator meter/report
 * projections must preserve event-indexed cumulative values and final state.
 *
 *   node scripts/sim-combat-stat-logger-smoke.mjs
 */

import fs from 'node:fs';
import { buildMetricSections, buildMetricSources, sourceValueAt } from '../js/pages/sim/log/sim-meter-metrics.js';
import { summarizeStatusReport } from '../js/pages/sim/engine/report-status.js';

const source = fs.readFileSync(
  new URL('../tools/game-extract-full/Core/CombatStatLogger.gd', import.meta.url),
  'utf8',
);

let failed = 0;
function ok(condition, message) {
  if (condition) console.log(`OK ${message}`);
  else {
    console.error(`FAIL ${message}`);
    failed += 1;
  }
}

for (const method of [
  '_init',
  'clear',
  'logCharacterStat',
  'getCharacterStatAt',
  'logStack',
  'getStackAt',
  'logItemMetric',
  'getItemMetricAt',
  'logMetric',
  'getMetricAt',
  'getValuesForMetricAt',
  'getStatHistoriesForMetric',
]) {
  ok(
    new RegExp(`func\\s+${method}\\s*\\(`).test(source),
    `source CombatStatLogger exposes ${method}`,
  );
}
for (const field of ['characterStatHistories', 'stackHistories', 'itemMetricHistories', 'metricHistories']) {
  ok(new RegExp(`\\b${field}\\b`).test(source), `source CombatStatLogger retains ${field}`);
}

const itemsById = new Map([
  ['sword', { id: 'sword', name: 'Wooden Sword' }],
  ['lotus', { id: 'lotus', name: 'Death Lotus' }],
]);
const events = [
  {
    t: 1,
    type: 'damage',
    actor: 'player',
    target: 'dummy',
    itemId: 'sword',
    placementKey: 'you:sword',
    amount: 8,
    meta: { critical: true },
  },
  {
    t: 1.5,
    type: 'buff',
    actor: 'player',
    target: 'player',
    itemId: 'lotus',
    placementKey: 'you:lotus',
    amount: 3,
    meta: { stack: 'block' },
  },
  {
    t: 2,
    type: 'damage',
    actor: 'dummy',
    target: 'player',
    amount: 2,
    meta: { systemOrigin: 'Poison', stack: 'poison' },
  },
  {
    t: 2.5,
    type: 'heal',
    actor: 'player',
    target: 'player',
    itemId: 'lotus',
    amount: 4,
    meta: { systemOrigin: 'Vampirism', stack: 'vampirism' },
  },
];
const run = {
  events,
  summary: {
    player: { hp: 98, maxHp: 100, block: 3, vampirism: 4 },
    dummy: { hp: 92, maxHp: 100, poison: 2 },
  },
};

const damage = buildMetricSources(events, itemsById, 'damage', 'player');
ok(damage[0]?.total === 8, 'meter history attributes player damage to its placement');
ok(sourceValueAt(damage[0], 0.5) === 0 && sourceValueAt(damage[0], 1.5) === 8, 'meter history supports event-time lookup');
const block = buildMetricSections(events, itemsById, 'block', 'player');
ok(block[0]?.sources[0]?.total === 3, 'stack history preserves character Block gains');
const poison = buildMetricSources(events, itemsById, 'damage', 'dummy');
ok(poison[0]?.total === 2 && poison[0]?.name === 'Poison', 'damage history attributes hostile Poison to the opponent side');

const report = summarizeStatusReport(run, itemsById);
ok(report.damage.toDummy.total === 8, 'status report preserves item damage totals');
ok(report.damage.toPlayer.total === 2 && report.damage.toPlayer.byKind.poison?.total === 2, 'status report preserves system damage kind');
ok(report.heals.player.byKind.vampirism?.total === 4, 'status report preserves system heal kind');
ok(report.end.player.stacks.block === 3 && report.end.dummy.stacks.poison === 2, 'status report preserves end stack histories');

if (failed) {
  console.error(`\n${failed} combat-stat-logger assertion(s) failed`);
  process.exit(1);
}
console.log('\nCombatStatLogger parity smoke passed');
