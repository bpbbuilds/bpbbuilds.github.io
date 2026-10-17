/**
 * CombatLog parity smoke: source event creation/logging and raw engine event
 * identity must be available before log, meter, HUD, or export projection.
 *
 *   node scripts/sim-combat-log-smoke.mjs
 */

import fs from 'node:fs';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const source = fs.readFileSync(
  new URL('../tools/game-extract-full/Core/CombatLog.gd', import.meta.url),
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
  'createEvent',
  'logEvent',
  'snapshotStack',
  'snapshotMetric',
  'createEvent_Activation',
  'createEvent_Damage',
]) {
  ok(
    new RegExp(`func\\s+${method}\\s*\\(`).test(source),
    `source CombatLog exposes ${method}`,
  );
}
ok(/eventNum\s*\+=\s*1/.test(source), 'source CombatLog advances its event number during creation');
ok(/events\.push_back\(event\)/.test(source), 'source CombatLog retains every logged event');
ok(/fightEnded\s+and\s+not\s+afterFightAllowed/.test(source), 'source CombatLog preserves post-fight allowlisting');

const run = simulateEngine({
  placements: [],
  itemsById: new Map(),
  durationSec: 0.1,
  dummyAttacks: false,
});
const rawEvents = run.events || [];
ok(rawEvents.length >= 2, 'engine emits start and outcome events for an empty board');
const eventIds = rawEvents.map((event) => event?.meta?.eventId);
const eventNums = rawEvents.map((event) => event?.meta?.combatEventNum);
ok(eventIds.every((id) => id != null), 'raw engine events have source-like identities before conforming');
ok(new Set(eventIds.map((id) => `${typeof id}:${String(id)}`)).size === eventIds.length, 'raw engine event identities are unique');
ok(
  eventNums.every((n) => Number.isInteger(n) && n > 0) &&
    eventNums.every((n, i) => i === 0 || n > eventNums[i - 1]),
  'raw engine event numbers are monotonic in creation order',
);
ok(
  Array.isArray(run.snapshots) &&
    run.snapshots.length >= 2 &&
    run.snapshots[0]?.player?.hp != null &&
    run.snapshots[0]?.dummy?.stamina != null,
  'CombatLog snapshot projection retains both character histories',
);
ok(
  Array.isArray(run.pieceSnapshots) && run.pieceSnapshots.length >= 2,
  'CombatLog item-state snapshot projection retains start and end samples',
);
ok(
  /logStack\([^\n]+eventNum/.test(source) &&
    /logMetric\([^\n]+eventNum/.test(source),
  'source stack and metric snapshots remain event-number indexed',
);

if (failed) {
  console.error(`\n${failed} combat-log assertion(s) failed`);
  process.exit(1);
}
console.log('\nCombatLog parity smoke passed');
