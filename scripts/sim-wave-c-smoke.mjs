/**
 * Band AE Wave C smoke — sample HAND weapon ports.
 *   node scripts/sim-wave-c-smoke.mjs
 */
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

const IDS = [
  'hammer',
  'spear',
  'hungry_blade',
  'magic_staff',
  'poison_spear',
  'claws_of_attack',
  'fancy_fencing_rapier',
  'wrench',
];
for (const id of IDS) {
  ok(!!getScriptHandler(id)?.handlerId, `handler ${id}`);
}

const hammer = {
  id: 'hammer',
  name: 'Hammer',
  type: 'Melee Weapon',
  cooldown: 2,
  staminaCost: 1,
  damageMin: 5,
  damageMax: 8,
  accuracy: 95,
  chance: 100,
  params: { dur_stun: 1, p1: 1 },
  shape: [[1]],
};
const spear = {
  id: 'spear',
  name: 'Spear',
  type: 'Melee Weapon',
  cooldown: 2,
  staminaCost: 1,
  damageMin: 4,
  damageMax: 7,
  accuracy: 90,
  params: { blockremoval: 3, p1: 3 },
  shape: [[1, 1]],
};
const hungry = {
  id: 'hungry_blade',
  name: 'Hungry Blade',
  type: 'Melee Weapon',
  cooldown: 2,
  staminaCost: 1,
  damageMin: 4,
  damageMax: 6,
  accuracy: 90,
  params: { p1: 3, p2: 2, p3: 1 },
  shape: [[1]],
};
const staff = {
  id: 'magic_staff',
  name: 'Magic Staff',
  type: 'Magic Weapon',
  cooldown: 2.5,
  staminaCost: 1,
  damageMin: 3,
  damageMax: 6,
  accuracy: 90,
  params: { p1: 2, p2: 4, p3: 1 },
  shape: [[1]],
};

const itemsById = new Map([hammer, spear, hungry, staff].map((i) => [i.id, i]));

{
  const result = simulateEngine({
    placements: [{ id: 'hammer', key: 'hm', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 10,
    seed: 1,
  });
  ok(
    result.events.some((e) => e.meta?.handler === 'hammer'),
    'hammer activates / stun path',
  );
}

{
  const result = simulateEngine({
    placements: [{ id: 'spear', key: 'sp', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 10,
    seed: 2,
  });
  ok(
    result.events.some((e) => e.meta?.handler === 'spear'),
    'spear activates',
  );
}

{
  const result = simulateEngine({
    placements: [{ id: 'hungry_blade', key: 'hb', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 8,
    seed: 3,
  });
  ok(
    result.events.some((e) => e.meta?.handler === 'hungry_blade' && e.meta?.stack === 'vampirism'),
    'hungry_blade start vamp',
  );
}

{
  const result = simulateEngine({
    placements: [{ id: 'magic_staff', key: 'ms', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 10,
    seed: 4,
  });
  ok(
    result.events.some((e) => e.meta?.handler === 'magic_staff'),
    'magic_staff activates',
  );
}

if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nWave C smoke passed');
