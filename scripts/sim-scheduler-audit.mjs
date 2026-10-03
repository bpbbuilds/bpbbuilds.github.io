/**
 * Package B scheduler baseline.
 *
 *   node scripts/sim-scheduler-audit.mjs
 *   node scripts/sim-scheduler-audit.mjs --check
 *
 * This validates only source-settled timing facts. It deliberately reports
 * unproven clocks/advance semantics rather than treating a fixed JS loop as
 * equivalent to every Godot Timer.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulateEngine, COMBAT_DELAY } from '../js/pages/sim/engine/simulate.js';
import {
  FATIGUE_TIME,
  FATIGUE_FIRST_TICK,
  FATIGUE_TICK_INTERVAL,
} from '../js/pages/sim/engine/fatigue.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/data/sim-scheduler-audit.json');
const TIMER = fs.readFileSync(path.join(ROOT, 'tools/game-extract-full/Interface/CombatTimer/CombatTimer.gd'), 'utf8');

function requireSource(expression, description) {
  if (!expression.test(TIMER)) throw new Error(`Scheduler source changed: ${description}`);
}

function close(actual, expected, description) {
  if (Math.abs(actual - expected) > 1e-7) {
    throw new Error(`${description}: expected ${expected}, received ${actual}`);
  }
}

requireSource(/const\s+FATIGUE_TIME\s*=\s*17\b/, 'FATIGUE_TIME');
requireSource(/fatigueStartTimer\.start\(FATIGUE_TIME\s*-\s*3\)/, 'fatigue start warning delay');
requireSource(/func\s+startFatigue\(\)[\s\S]*?fatigueTickTimer\.start\(3\)/, 'first fatigue tick delay');
requireSource(/func\s+dealFatigueDamage\(\)[\s\S]*?fatigueTickTimer\.start\(1\)/, 'subsequent fatigue tick delay');
requireSource(/func\s+advanceTime\(time\)[\s\S]*?fatigueStartTimer\.get_time_left\(\)[\s\S]*?fatigueStartTimer\.start\(newTime\)/, 'advanceTime warning-timer behavior');

if (COMBAT_DELAY !== 2.5) throw new Error(`Simulator COMBAT_DELAY drifted: ${COMBAT_DELAY}`);
if (FATIGUE_TIME !== 17 || FATIGUE_FIRST_TICK !== 3 || FATIGUE_TICK_INTERVAL !== 1) {
  throw new Error('Simulator fatigue constants no longer match the extracted CombatTimer');
}

const run = simulateEngine({
  placements: [],
  itemsById: new Map(),
  durationSec: COMBAT_DELAY + FATIGUE_TIME + 3.2,
  dummyAttacks: false,
  playerMaxHp: 10000,
  dummyMaxHp: 10000,
});
const fatigueTicks = run.events
  .filter((event) => event.type === 'damage' && event.meta?.fatigue && event.target === 'player')
  .map((event) => event.t);
const expectedTicks = [
  COMBAT_DELAY + FATIGUE_TIME,
  COMBAT_DELAY + FATIGUE_TIME + FATIGUE_TICK_INTERVAL,
  COMBAT_DELAY + FATIGUE_TIME + (2 * FATIGUE_TICK_INTERVAL),
  COMBAT_DELAY + FATIGUE_TIME + (3 * FATIGUE_TICK_INTERVAL),
];
if (fatigueTicks.length < expectedTicks.length) {
  throw new Error(`Expected ${expectedTicks.length} fatigue ticks, received ${fatigueTicks.length}`);
}
for (let index = 0; index < expectedTicks.length; index += 1) {
  close(fatigueTicks[index], expectedTicks[index], `fatigue tick ${index + 1}`);
}

const output = {
  schema: 1,
  source: 'tools/game-extract-full/Interface/CombatTimer/CombatTimer.gd',
  confirmed: {
    combatDelay: COMBAT_DELAY,
    fatigueWarningAfterCombatSeconds: FATIGUE_TIME - FATIGUE_FIRST_TICK,
    firstFatigueDamageAfterCombatSeconds: FATIGUE_TIME,
    fatigueTickIntervalSeconds: FATIGUE_TICK_INTERVAL,
    observedPlayerFatigueTicks: fatigueTicks.slice(0, expectedTicks.length).map((time) => Number(time.toFixed(6))),
  },
  unresolved: [
    'Same-timestamp tie order among Godot Timer callbacks, physics callbacks, and item triggers.',
    'Timer cancellation/restart and re-entrancy outside the fatigue path.',
    'CombatTimer.advanceTime has no simulator counterpart; source advances the fatigue warning timer, not generic item cooldowns.',
    'Visual fatigue-warning presentation at combat time 14 seconds is not represented as a distinct simulator event.',
  ],
  note: 'Passing this audit proves the listed source-settled fatigue cadence only; it is not scheduler parity certification.',
};

const rendered = `${JSON.stringify(output, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== rendered) {
    console.error('FAIL sim-scheduler-audit is stale; run node scripts/sim-scheduler-audit.mjs');
    process.exit(1);
  }
  console.log('OK sim-scheduler-audit: source-settled fatigue cadence');
} else {
  fs.writeFileSync(OUT, rendered);
  console.log(JSON.stringify(output.confirmed, null, 2));
  console.log(`Wrote ${path.relative(ROOT, OUT)}`);
}
