import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/BowlofTreats.gd', 'utf8');
assert.match(source, /func onPrepare\(\)/);
assert.match(source, /giveDoubleActivationChance\(getChance\(\)\)/);
assert.match(source, /giveRandomBuffs\(getP1\(\)\)/);
assert.match(source, /maxSpeedBonus/);

const handler = getScriptHandler('bowl_of_treats');
assert.equal(handler?.handlerId, 'bowl_of_treats');
assert.equal(typeof handler?.onPrepare, 'function');

function run(side) {
  const owner = side === 'you' ? createActor('player') : createActor('dummy');
  const foe = side === 'you' ? createActor('dummy') : createActor('player');
  const bowl = {
    itemId: 'bowl_of_treats',
    name: 'Bowl of Treats',
    placementKey: `${side}:bowl`,
    side,
    kind: 'food',
    params: { p1: 2, foodspeed: 25, p2: 25, p3: 100 },
    chance: 20,
    alive: true,
    speedScale: 0,
  };
  const pet = {
    itemId: 'goobert',
    name: 'Goobert',
    placementKey: `${side}:pet`,
    side,
    kind: 'pet',
    speedScale: 0,
    alive: true,
  };
  const itemsById = new Map([
    ['bowl_of_treats', { id: 'bowl_of_treats', type: 'Food', chance: 20 }],
    ['goobert', { id: 'goobert', type: 'Pet' }],
  ]);
  const graph = {
    pieces: new Map([
      [bowl.placementKey, { id: bowl.itemId, cells: ['0,0'], affectCells: [] }],
      [pet.placementKey, { id: pet.itemId, cells: ['1,0'], affectCells: [] }],
    ]),
    filled: new Map([
      ['0,0', bowl.placementKey],
      ['1,0', pet.placementKey],
    ]),
  };
  const events = [];
  const ctx = {
    player: owner,
    dummy: foe,
    events,
    rng: () => 0,
    t: 4,
    graph,
    itemsById,
    pieces: [bowl, pet],
    canAffect: null,
  };

  handler.onPrepare(bowl, ctx);
  assert.equal(pet.doubleActivationChance, 0.2, `${side}: all pets receive source chance`);
  handler.onCooldownEffect(bowl, ctx);
  assert.equal(pet.speedScale, 0.25, `${side}: linked pet receives first speed increment`);
  assert.ok(Object.values(owner.stacks).some((amount) => amount > 0), `${side}: random buffs grant to owner`);
  const activation = events.findIndex((event) => event.type === 'activate');
  const grant = events.findIndex((event) => event.type === 'buff');
  assert.ok(activation > grant, `${side}: source activation follows its effects`);
  assert.equal(events[activation].actor, side === 'you' ? 'player' : 'dummy');
}

run('you');
run('them');
console.log('OK Bowl of Treats focused smoke');
