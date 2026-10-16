import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Boomerang.gd', 'utf8');
assert.match(source, /onPreDealDamage_early/);
assert.match(source, /changeStaminaFactor\( - staminaReduction\)/);
assert.match(source, /stealRandomBuff\(1\)/);

const handler = getScriptHandler('boomerang');
assert.equal(handler?.handlerId, 'boomerang');
assert.equal(typeof handler?.onPreDealDamageEarly, 'function');

function run(side) {
  const owner = side === 'you' ? createActor('player') : createActor('dummy');
  const foe = side === 'you' ? createActor('dummy') : createActor('player');
  foe.stacks.lucky = 1;
  const piece = {
    itemId: 'boomerang',
    name: 'Boomerang',
    placementKey: `${side}:boomerang`,
    side,
    params: { stamina: 20, p1: 20 },
    chance: 100,
    staminaCost: 5,
    baseStaminaCost: 5,
    staminaFactor: 1,
    alive: true,
  };
  const events = [];
  const ctx = {
    player: owner,
    dummy: foe,
    events,
    rng: () => 0,
    t: 4,
  };
  handler.onPreDealDamageEarly(piece, ctx, { hit: true });
  assert.equal(piece.staminaFactor, 0.8, `${side}: source stamina reduction applies on hit`);
  assert.equal(piece.staminaCost, 4, `${side}: stamina cost refreshes from the factor`);
  assert.equal(owner.stacks.lucky, 1, `${side}: stolen buff reaches the owner`);
  assert.equal(foe.stacks.lucky, 0, `${side}: stolen buff leaves the opponent`);
  const steal = events.find((event) => event.type === 'buff' && event.itemId === 'boomerang');
  assert.equal(steal?.actor, side === 'you' ? 'player' : 'dummy');
  assert.equal(steal?.target, side === 'you' ? 'player' : 'dummy');

  const before = piece.staminaFactor;
  handler.onPreDealDamageEarly(piece, ctx, { hit: false });
  assert.equal(piece.staminaFactor, before, `${side}: misses do not apply the hit effect`);
}

run('you');
run('them');
console.log('OK Boomerang focused smoke');
