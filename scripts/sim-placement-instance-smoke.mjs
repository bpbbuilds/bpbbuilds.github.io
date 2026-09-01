/**
 * Placement instance stats + history vitals smoke.
 *   node scripts/sim-placement-instance-smoke.mjs
 */
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed += 1;
  } else console.log('OK', msg);
}

const catalog = {
  id: 'wooden_sword',
  name: 'Wooden Sword',
  type: 'Melee Weapon',
  cooldown: 4,
  staminaCost: 1,
  damageMin: 4,
  damageMax: 6,
  accuracy: 90,
  shape: [[1]],
  params: {},
};

const itemsById = new Map([['wooden_sword', catalog]]);

const pieces = buildCombatPieces(
  [
    {
      id: 'wooden_sword',
      x: 0,
      y: 0,
      r: 0,
      key: 'sword:0',
      instance: { baseCooldown: 2.5, speedScale: 0.15 },
    },
  ],
  itemsById,
);

ok(pieces.length === 1, 'piece built');
ok(Math.abs(pieces[0].baseCooldown - 2.5) < 0.001, 'instance baseCooldown applied');
ok(Math.abs(pieces[0].speedScale - 0.15) < 0.001, 'instance speedScale applied');

const runFast = simulateEngine({
  placements: [
    {
      id: 'wooden_sword',
      x: 0,
      y: 0,
      r: 0,
      key: 'sword:fast',
      instance: { baseCooldown: 2 },
    },
  ],
  itemsById,
  durationSec: 10,
  seed: 99,
  playerMaxHp: 412,
  playerMaxStamina: 88,
});

ok(runFast.summary.player.maxHp === 412, 'history max HP used');
ok(runFast.summary.player.maxStamina === 88, 'history max stamina used');

const runSlow = simulateEngine({
  placements: [{ id: 'wooden_sword', x: 0, y: 0, r: 0, key: 'sword:slow' }],
  itemsById,
  durationSec: 10,
  seed: 99,
});

const fastActs = runFast.events.filter(
  (e) => e.type === 'activate' && e.itemId === 'wooden_sword',
).length;
const slowActs = runSlow.events.filter(
  (e) => e.type === 'activate' && e.itemId === 'wooden_sword',
).length;
ok(fastActs > slowActs, `instance CD → more activations (${fastActs} vs ${slowActs})`);

if (failed) {
  process.exit(1);
}
console.log('sim-placement-instance-smoke passed');
