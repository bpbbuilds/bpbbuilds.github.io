import assert from 'node:assert/strict';
import fs from 'node:fs';

import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Item.gd', 'utf8');
assert.match(
  source,
  /func _physics_process\(delta: float\):[\s\S]*?if not character\(\)\.isStunned\(\):[\s\S]*?triggerTime -= delta \* getSpeed\(\)[\s\S]*?if triggerTime <= 0:[\s\S]*?trigger\(\)/,
  'the game freezes item cooldown progress while its owner is stunned',
);

const sword = {
  id: 'wooden_sword',
  name: 'Wooden Sword',
  type: 'Melee Weapon',
  cooldown: 2,
  staminaCost: 1,
  damageMin: 4,
  damageMax: 4,
  accuracy: 100,
  shape: [[1]],
};
const hammer = {
  id: 'hammer',
  name: 'Hammer',
  type: 'Melee Weapon',
  cooldown: 4,
  staminaCost: 1,
  damageMin: 0,
  damageMax: 0,
  accuracy: 100,
  chance: 100,
  params: { dur_stun: 1, p1: 1 },
  shape: [[1]],
};

const run = simulateEngine({
  placements: [{ id: sword.id, key: 'player:sword', x: 0, y: 0, r: 0 }],
  opponentPlacements: [{ id: hammer.id, key: 'opponent:hammer', x: 0, y: 0, r: 0 }],
  itemsById: new Map([
    [sword.id, sword],
    [hammer.id, hammer],
  ]),
  durationSec: 14,
  seed: 1,
  dummyAttacks: false,
});

const swordActivations = run.events.filter(
  (event) => event.type === 'activate' && event.itemId === sword.id,
);
const stun = run.events.find(
  (event) => event.type === 'debuff' && event.itemId === hammer.id && event.meta?.stack === 'stun',
);
assert.equal(swordActivations.length >= 3, true, 'the sword continues activating after the stun');
assert.ok(stun, 'the opponent hammer applies a deterministic stun');

const secondSword = swordActivations[1];
const stunEnd = stun.t + 1;
assert.ok(
  secondSword.t >= stunEnd - 1e-9,
  `a sword activation cannot occur before stun expiry (got ${secondSword.t}, expiry ${stunEnd})`,
);
assert.ok(
  secondSword.t < stunEnd + 0.8,
  `a ready sword resumes its existing cooldown promptly after stun (got ${secondSword.t}, expiry ${stunEnd})`,
);

console.log('OK source-backed stun freezes item cooldown and resumes without a fresh cooldown');
