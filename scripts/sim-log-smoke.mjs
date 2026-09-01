/**
 * Smoke test for Band Q combat log sentences + damage meters.
 *   node scripts/sim-log-smoke.mjs
 */
import { formatLogLine, prepareLogEvents } from '../js/pages/sim/sim-log-sentences.js';
import {
  buildDamageSources,
  buildCumulativeSeries,
  buildMetricSources,
  METER_METRICS,
} from '../js/pages/sim/sim-meter-metrics.js';

const itemsById = new Map([
  ['wooden_sword', { id: 'wooden_sword', name: 'Wooden Sword' }],
  ['garlic', { id: 'garlic', name: 'Garlic' }],
  ['banana', { id: 'banana', name: 'Banana' }],
  ['piggybank', { id: 'piggybank', name: 'Piggybank' }],
]);

const events = [
  { t: 1.38, type: 'damage', actor: 'player', target: 'dummy', itemId: 'wooden_sword', amount: 1 },
  { t: 2.23, type: 'damage', actor: 'player', target: 'dummy', itemId: 'wooden_sword', amount: 8, meta: { critical: true } },
  { t: 4.18, type: 'buff', actor: 'player', target: 'player', itemId: 'garlic', amount: 3, meta: { stack: 'block' } },
  { t: 4.38, type: 'miss', actor: 'player', itemId: 'wooden_sword' },
  { t: 4.95, type: 'heal', actor: 'player', target: 'player', itemId: 'banana', amount: 4 },
  { t: 4.95, type: 'stamina', actor: 'player', itemId: 'banana', amount: 1, label: 'Regenerated 1 stamina (Banana)' },
  { t: 5.0, type: 'activate', actor: 'player', itemId: 'wooden_sword' },
  { t: 5.1, type: 'tick' },
  { t: 7.08, type: 'fight_end', label: 'time_cap' },
];

const { lines } = prepareLogEvents(events, {
  dummyEndHp: 100,
  itemsById,
  assetRoot: '../',
});

const plains = lines.map((l) => l.plain);
const expect = [
  '1.38:  Dealt 1 damage (Wooden Sword).',
  '2.23:  Dealt 8 critical damage (Wooden Sword).',
  '4.18:  Gained 3 block (Garlic).',
  '4.38:  Missed an attack (Wooden Sword).',
  '4.95:  Regenerated 4 health (Banana).',
  '4.95:  Regenerated 1 stamina (Banana).',
  '5.00:  Wooden Sword activated.',
  '7.08:  Round lost.',
];

let ok = true;
for (let i = 0; i < expect.length; i++) {
  if (plains[i] !== expect[i]) {
    console.error('FAIL line', i, '\n got:', plains[i], '\n want:', expect[i]);
    ok = false;
  }
}
if (lines.length !== expect.length) {
  console.error('FAIL count', lines.length, expect.length);
  ok = false;
}

const sources = buildDamageSources(events, itemsById, 'player');
if (sources[0]?.total !== 9) {
  console.error('FAIL damage total', sources[0]?.total);
  ok = false;
}
const series = buildCumulativeSeries(sources, 7.08);
if (series[series.length - 1]?.cum !== 9) {
  console.error('FAIL series cum', series[series.length - 1]);
  ok = false;
}

const actHidden = lines.filter((l) => l.activation).length === 1;
if (!actHidden) {
  console.error('FAIL activation line missing');
  ok = false;
}

const sample = formatLogLine(events[2], { itemsById, assetRoot: '../' });
if (!sample?.html.includes('sim-clog__icon')) {
  console.error('FAIL missing stack icon html');
  ok = false;
}

if (METER_METRICS.length !== 15) {
  console.error('FAIL metric count', METER_METRICS.length);
  ok = false;
}
const blockSrc = buildMetricSources(events, itemsById, 'block', 'player');
if (blockSrc[0]?.total !== 3) {
  console.error('FAIL block meter', blockSrc);
  ok = false;
}
const actSrc = buildMetricSources(events, itemsById, 'activations', 'player');
if (actSrc[0]?.total !== 1) {
  console.error('FAIL activations meter', actSrc);
  ok = false;
}

if (!ok) process.exit(1);

const maxHpLine = formatLogLine(
  {
    t: 2.5,
    type: 'heal',
    itemId: 'piggybank',
    amount: 4,
    meta: { handler: 'piggybank', kind: 'maxHp' },
  },
  { itemsById, assetRoot: '../', useCombatClock: true },
);
if (maxHpLine?.plain !== '0.00:  Gained 4 maximum health (Piggybank).') {
  console.error('FAIL maxHp wording', maxHpLine?.plain);
  ok = false;
}

if (!ok) process.exit(1);
console.log(
  'OK sim-log-smoke:',
  lines.length,
  'lines, damage',
  sources[0].total,
  'metrics',
  METER_METRICS.length,
);
