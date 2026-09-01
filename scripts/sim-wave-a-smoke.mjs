/**
 * Band AC Wave A — cupcake giveMostBuffs + easy start/food ports.
 *   node scripts/sim-wave-a-smoke.mjs
 */
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { giveMostBuffs } from '../js/pages/sim/engine/buff-economy.js';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

for (const id of [
  'cupcake',
  'pineapple',
  'flame',
  'lucky_piggy',
  'protective_purse',
  'holdall',
]) {
  ok(!!getScriptHandler(id), `handler ${id}`);
}

// Unit: giveMostBuffs amplifies current leader
{
  const a = createActor('player');
  grantStacks(a, 'heat', 5);
  grantStacks(a, 'mana', 2);
  const picked = giveMostBuffs(a, 2, () => 0.1);
  ok(picked.heat === 2, 'giveMostBuffs adds to heat when heat leads');
  ok(a.stacks.heat === 7, 'heat is 5+2');
}

const itemsById = new Map(
  [
    {
      id: 'cupcake',
      name: 'Cupcake',
      type: 'Food',
      cooldown: 3,
      params: { heal: 5, buffs: 2, p1: 5, p2: 2 },
      shape: [[1]],
    },
    {
      id: 'pineapple',
      name: 'Pineapple',
      type: 'Food',
      cooldown: 3,
      params: { heal: 6, p1: 6 },
      shape: [[1]],
    },
    {
      id: 'flame',
      name: 'Flame',
      type: 'Accessory',
      params: {},
      shape: [[1]],
    },
    {
      id: 'lucky_piggy',
      name: 'Lucky Piggy',
      type: 'Accessory',
      params: { luck: 2, p2: 2, chance: 5, p3: 5 },
      shape: [[1]],
    },
    {
      id: 'protective_purse',
      name: 'Protective Purse',
      type: 'Bag',
      block: 10,
      params: {},
      shape: [
        [1, 1],
        [1, 1],
      ],
    },
  ].map((i) => [i.id, i]),
);

{
  const result = simulateEngine({
    placements: [{ id: 'flame', key: 'fl', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 6,
    seed: 1,
  });
  ok(
    result.events.some((e) => e.meta?.handler === 'flame' && e.meta?.stack === 'heat'),
    'flame grants start heat',
  );
}

{
  const result = simulateEngine({
    placements: [{ id: 'lucky_piggy', key: 'lp', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 6,
    seed: 2,
  });
  ok(
    result.events.some((e) => e.meta?.handler === 'lucky_piggy' && e.meta?.stack === 'lucky'),
    'lucky_piggy grants lucky',
  );
}

{
  const result = simulateEngine({
    placements: [{ id: 'protective_purse', key: 'pp', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 6,
    seed: 3,
  });
  ok(
    result.events.some((e) => e.meta?.handler === 'protective_purse' && e.meta?.stack === 'block'),
    'protective_purse grants block',
  );
}

{
  const result = simulateEngine({
    placements: [{ id: 'pineapple', key: 'pa', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 10,
    seed: 4,
  });
  ok(
    result.events.some((e) => e.type === 'heal' && e.meta?.handler === 'pineapple'),
    'pineapple heals',
  );
  ok(
    result.events.some((e) => e.meta?.handler === 'pineapple' && e.meta?.stack === 'spikes'),
    'pineapple grants spikes',
  );
}

{
  const result = simulateEngine({
    placements: [{ id: 'cupcake', key: 'ck', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 10,
    seed: 5,
  });
  ok(
    result.events.some((e) => e.type === 'heal' && e.meta?.handler === 'cupcake'),
    'cupcake heals',
  );
  ok(
    result.events.some((e) => e.meta?.handler === 'cupcake' && e.type === 'buff'),
    'cupcake grants most-buff stacks',
  );
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nWave A smoke passed');
