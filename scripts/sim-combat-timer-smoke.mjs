/**
 * CombatTimer parity smoke: source clock constants, normal fatigue cadence,
 * and advanceTime's delayed first tick must remain source-aligned.
 *
 *   node scripts/sim-combat-timer-smoke.mjs
 */

import fs from 'node:fs';
import { simulateEngine, COMBAT_DELAY } from '../js/pages/sim/engine/simulate.js';
import {
  FATIGUE_TIME,
  FATIGUE_FIRST_TICK,
  FATIGUE_TICK_INTERVAL,
  advanceFatigueTime,
  createFatigueState,
} from '../js/pages/sim/engine/fatigue.js';

const source = fs.readFileSync(
  new URL('../tools/game-extract-full/Interface/CombatTimer/CombatTimer.gd', import.meta.url),
  'utf8',
);
const cachedCatalog = JSON.parse(fs.readFileSync(new URL('./_cache/game-items.json', import.meta.url), 'utf8'));
const catalogRows = Array.isArray(cachedCatalog) ? cachedCatalog : cachedCatalog.items;
const catalog = new Map((catalogRows || []).map((item) => [item.id, item]));

let failed = 0;
function ok(condition, message) {
  if (condition) console.log(`OK ${message}`);
  else {
    console.error(`FAIL ${message}`);
    failed += 1;
  }
}

ok(/const\s+FATIGUE_TIME\s*=\s*17\b/.test(source), 'source keeps the 17-second fatigue threshold');
ok(/fatigueStartTimer\.start\(FATIGUE_TIME\s*-\s*3\)/.test(source), 'source starts the fatigue warning three seconds early');
ok(/func\s+startFatigue\(\)[\s\S]*?fatigueTickTimer\.start\(3\)/.test(source), 'source delays the first fatigue tick by three seconds');
ok(/func\s+dealFatigueDamage\(\)[\s\S]*?fatigueTickTimer\.start\(1\)/.test(source), 'source uses one-second subsequent fatigue ticks');
ok(/func\s+advanceTime\(time\)[\s\S]*?fatigueStartTimer\.get_time_left\(\)/.test(source), 'source advanceTime adjusts the fatigue timer only');
ok(COMBAT_DELAY === 2.5 && FATIGUE_TIME === 17, 'simulator combat constants match the source');

const normal = simulateEngine({
  placements: [],
  itemsById: new Map(),
  durationSec: COMBAT_DELAY + FATIGUE_TIME + 2.2,
  dummyAttacks: false,
  playerMaxHp: 10000,
  dummyMaxHp: 10000,
});
const normalTicks = normal.events
  .filter((event) => event.type === 'damage' && event.meta?.fatigue && event.target === 'player')
  .map((event) => event.t);
ok(
  Math.abs(normalTicks[0] - (COMBAT_DELAY + FATIGUE_TIME)) < 1e-6 &&
    Math.abs(normalTicks[1] - (normalTicks[0] + FATIGUE_TICK_INTERVAL)) < 1e-6,
  'normal fatigue cadence starts at 17 seconds and repeats every second',
);
ok(
  normal.events.some((event) => event.meta?.fatigue && event.meta?.phase === 'start' && Math.abs(event.t - normalTicks[0]) < 1e-6),
  'fatigue_start is projected at the first damage tick',
);

const moonRun = simulateEngine({
  placements: [{ id: 'power_of_the_moon', key: 'power' }],
  itemsById: catalog,
  durationSec: COMBAT_DELAY + FATIGUE_TIME - 6 + 1.2,
  dummyAttacks: false,
  playerMaxHp: 10000,
  dummyMaxHp: 10000,
});
const moonTicks = moonRun.events
  .filter((event) => event.type === 'damage' && event.meta?.fatigue && event.target === 'player')
  .map((event) => event.t);
ok(
  moonTicks[0] != null && Math.abs(moonTicks[0] - (COMBAT_DELAY + FATIGUE_TIME - 6)) < 0.1,
  'Power of the Moon advances the first fatigue damage without an extra delay',
);

const advanced = createFatigueState();
advanced.now = 12;
ok(advanceFatigueTime(advanced, 6) === 6 && advanced.startAt === 11, 'advanceTime shifts the warning threshold by the requested amount');
ok(advanced.delayFirstTick === true, 'advanceTime crossing the live timer schedules the source first-tick delay');
advanced.started = true;
ok(advanceFatigueTime(advanced, 1) === 0, 'advanceTime is inert after fatigue starts');

if (failed) {
  console.error(`\n${failed} combat-timer assertion(s) failed`);
  process.exit(1);
}
console.log('\nCombatTimer parity smoke passed');
