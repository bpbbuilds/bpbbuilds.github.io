/**
 * Band AD Wave B smoke — sample HAND ports.
 *   node scripts/sim-wave-b-smoke.mjs
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
  'whetstone',
  'hero_shield',
  'magic_badge',
  'shiny_shell',
  'wisdom_puppy',
  'dancing_dragon',
  'bomb',
  'sun_armor',
];
for (const id of IDS) {
  ok(!!getScriptHandler(id)?.handlerId, `handler ${id}`);
}

const sword = {
  id: 'wooden_sword',
  name: 'Wooden Sword',
  type: 'Melee Weapon',
  cooldown: 1.5,
  staminaCost: 1,
  damageMin: 4,
  damageMax: 6,
  accuracy: 90,
  shape: [[1]],
};
const whet = {
  id: 'whetstone',
  name: 'Whetstone',
  type: 'Accessory',
  params: { dam: 3, p1: 3 },
  shape: [[1]],
};
const badge = {
  id: 'magic_badge',
  name: 'Magic Badge',
  type: 'Accessory',
  params: { mana: 4, p1: 4 },
  shape: [[1]],
};
const shell = {
  id: 'shiny_shell',
  name: 'Shiny Shell',
  type: 'Accessory',
  cooldown: 3,
  params: { heal: 8, heal_bonus: 2, p1: 8, p2: 2 },
  shape: [[1]],
};
const puppy = {
  id: 'wisdom_puppy',
  name: 'Wisdom Puppy',
  type: 'Pet',
  cooldown: 3,
  block: 5,
  params: { p1: 1, p2: 10 },
  shape: [[1]],
};

const itemsById = new Map(
  [sword, whet, badge, shell, puppy].map((i) => [i.id, i]),
);

{
  const result = simulateEngine({
    placements: [
      { id: 'whetstone', key: 'wh', x: 0, y: 0, r: 0 },
      { id: 'wooden_sword', key: 'ws', x: 1, y: 0, r: 0 },
    ],
    itemsById,
    durationSec: 8,
    seed: 1,
  });
  ok(
    result.events.some((e) => e.meta?.handler === 'whetstone'),
    'whetstone aura event',
  );
}

{
  const result = simulateEngine({
    placements: [{ id: 'magic_badge', key: 'mb', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 6,
    seed: 2,
  });
  ok(
    result.events.some((e) => e.meta?.handler === 'magic_badge' && e.meta?.stack === 'mana'),
    'magic_badge grants mana',
  );
}

{
  const result = simulateEngine({
    placements: [{ id: 'shiny_shell', key: 'ss', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 10,
    seed: 3,
  });
  ok(
    result.events.some((e) => e.type === 'heal' && e.meta?.handler === 'shiny_shell'),
    'shiny_shell heals',
  );
}

{
  const result = simulateEngine({
    placements: [{ id: 'wisdom_puppy', key: 'wp', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 10,
    seed: 4,
  });
  ok(
    result.events.some((e) => e.meta?.handler === 'wisdom_puppy' && e.meta?.stack === 'block'),
    'wisdom_puppy grants block',
  );
}

if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nWave B smoke passed');
