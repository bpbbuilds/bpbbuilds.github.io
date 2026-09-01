/**
 * Band AE Wave D smoke — sample HAND ports + invuln.
 *   node scripts/sim-wave-d-smoke.mjs
 */
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { createActor, grantInvuln, isInvulnerable } from '../js/pages/sim/engine/actor.js';
import { takeDamage } from '../js/pages/sim/engine/damage.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

const IDS = [
  'goobert',
  'crown',
  'hyper_hedgehog',
  'chess_board',
  'plastic_cube',
  'slime_time',
  'holy_spear',
  'inner_power',
];
for (const id of IDS) {
  ok(!!getScriptHandler(id)?.handlerId, `handler ${id}`);
}

{
  const player = createActor('player');
  const dummy = createActor('dummy');
  grantInvuln(player, 2, 0);
  ok(isInvulnerable(player, 0.5), 'invuln active mid-window');
  const res = takeDamage(player, dummy, {
    amount: 50,
    canMiss: false,
    isAttack: true,
    nowT: 0.5,
    rng: () => 0.5,
  });
  ok(res.healthDamage === 0 && player.hp === player.maxHp, 'invuln blocks HP damage');
  ok(!isInvulnerable(player, 2.1), 'invuln expired');
}

const goobert = {
  id: 'goobert',
  name: 'Goobert',
  type: 'Pet',
  cooldown: 3,
  params: { p1: 8 },
  shape: [[1]],
};
const crown = {
  id: 'crown',
  name: 'Crown',
  type: 'Accessory',
  cooldown: 4,
  params: { manat: 2, p1: 2, heal: 6, dur_invuln: 2 },
  shape: [[1]],
};
const hyper = {
  id: 'hyper_hedgehog',
  name: 'Hyper Hedgehog',
  type: 'Pet',
  cooldown: 3,
  damageMin: 4,
  damageMax: 6,
  params: { dam_spikes: 1, dam_empower: 1 },
  shape: [[1]],
};
const chess = {
  id: 'chess_board',
  name: 'Chess Board',
  type: 'Accessory',
  cooldown: 5,
  shape: [[1]],
};
const cube = {
  id: 'plastic_cube',
  name: 'Plastic Cube',
  type: 'Accessory',
  cooldown: 3,
  params: { cd: 1, p1: 1, p2: 1 },
  shape: [[1]],
};

const banana = {
  id: 'banana',
  name: 'Banana',
  type: 'Food',
  cooldown: 2,
  params: { p1: 8 },
  shape: [[1]],
};

const itemsById = new Map(
  [goobert, crown, hyper, chess, cube, banana].map((i) => [i.id, i]),
);

{
  // AG: goobert heals via peer activations, not CD
  goobert.params = { p1: 2, heal: 8 };
  const result = simulateEngine({
    placements: [
      { id: 'goobert', key: 'gb', x: 0, y: 0, r: 0 },
      { id: 'banana', key: 'bn', x: 1, y: 0, r: 0 },
    ],
    itemsById,
    durationSec: 12,
    seed: 1,
  });
  ok(
    result.events.some((e) => e.type === 'heal' && e.meta?.handler === 'goobert'),
    'goobert heals',
  );
}

{
  const result = simulateEngine({
    placements: [{ id: 'crown', key: 'cr', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 12,
    seed: 2,
  });
  ok(
    result.events.some((e) => e.meta?.handler === 'crown'),
    'crown activates',
  );
}

{
  const result = simulateEngine({
    placements: [{ id: 'hyper_hedgehog', key: 'hh', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 10,
    seed: 3,
  });
  ok(
    result.events.some((e) => e.meta?.handler === 'hyper_hedgehog'),
    'hyper_hedgehog strikes',
  );
}

{
  const result = simulateEngine({
    placements: [{ id: 'chess_board', key: 'cb', x: 0, y: 0, r: 0 }],
    itemsById,
    durationSec: 8,
    seed: 4,
  });
  ok(
    result.events.some((e) => e.meta?.handler === 'chess_board'),
    'chess_board noop activate',
  );
}

{
  const result = simulateEngine({
    placements: [
      { id: 'plastic_cube', key: 'pc', x: 0, y: 0, r: 0 },
      { id: 'goobert', key: 'gb2', x: 1, y: 0, r: 0 },
    ],
    itemsById,
    durationSec: 10,
    seed: 5,
  });
  ok(
    result.events.some((e) => e.meta?.handler === 'plastic_cube'),
    'plastic_cube event',
  );
}

if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nWave D smoke passed');
