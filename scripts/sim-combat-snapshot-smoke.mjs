/**
 * CombatSnapshot parity smoke: source state fields and simulator scrub
 * selection must preserve the latest actor/item state at the playhead.
 *
 *   node scripts/sim-combat-snapshot-smoke.mjs
 */

import fs from 'node:fs';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { snapAt } from '../js/pages/sim/hud/sim-hud.js';

const source = fs.readFileSync(
  new URL('../tools/game-extract-full/Core/CombatSnapshot.gd', import.meta.url),
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

for (const method of ['_init', 'apply']) {
  ok(
    new RegExp(`func\\s+${method}\\s*\\(`).test(source),
    `source CombatSnapshot exposes ${method}`,
  );
}
for (const field of ['health', 'stamina', 'stacks', 'damageMeter']) {
  ok(new RegExp(`\\b${field}\\b`).test(source), `source CombatStats retains ${field}`);
}
ok(/setCurrentStamina\(stamina\)/.test(source), 'source snapshot apply restores stamina');

const snapshots = [
  {
    t: 0,
    player: { hp: 100, maxHp: 100, stamina: 5, maxStamina: 5, block: 0, poison: 0, dead: false },
    dummy: { hp: 100, maxHp: 100, stamina: 5, maxStamina: 5, block: 0, poison: 0, dead: false },
  },
  {
    t: 2,
    player: { hp: 82, maxHp: 100, stamina: 3, maxStamina: 5, block: 7, poison: 2, dead: false },
    dummy: { hp: 90, maxHp: 100, stamina: 5, maxStamina: 5, block: 0, poison: 0, dead: false },
  },
  {
    t: 2,
    player: { hp: 80, maxHp: 100, stamina: 3, maxStamina: 5, block: 5, poison: 2, dead: false },
    dummy: { hp: 90, maxHp: 100, stamina: 5, maxStamina: 5, block: 0, poison: 0, dead: false },
  },
];
ok(snapAt(snapshots, 1.5, 'player')?.hp === 100, 'scrubber keeps the prior snapshot before the next event');
ok(snapAt(snapshots, 2, 'player')?.hp === 80, 'scrubber chooses the latest same-time snapshot');
ok(snapAt(snapshots, 2.5, 'player')?.block === 5, 'scrubber retains the selected actor state after the event');

const run = simulateEngine({
  placements: [],
  itemsById: new Map(),
  durationSec: 0.1,
  dummyAttacks: false,
});
const first = run.snapshots?.[0];
const last = run.snapshots?.at(-1);
ok(first?.t === 0 && last?.t === 0.1, 'engine snapshots include start and capped end times');
for (const side of ['player', 'dummy']) {
  const snap = last?.[side];
  ok(
    snap &&
      typeof snap.hp === 'number' &&
      typeof snap.stamina === 'number' &&
      typeof snap.block === 'number' &&
      typeof snap.poison === 'number' &&
      typeof snap.dead === 'boolean',
    `engine snapshot retains ${side} health, stamina, stack, and death state`,
  );
}
ok(Array.isArray(run.pieceSnapshots) && run.pieceSnapshots.at(-1)?.t === 0.1, 'engine item snapshots share the capped end time');

if (failed) {
  console.error(`\n${failed} combat-snapshot assertion(s) failed`);
  process.exit(1);
}
console.log('\nCombatSnapshot parity smoke passed');
