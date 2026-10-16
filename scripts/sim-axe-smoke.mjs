import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('axe');
assert.equal(typeof handler?.onPreDealDamageEarly, 'function', 'Axe exposes the source early-hit permanent bonus hook');

for (const side of ['you', 'them']) {
  const axe = { itemId: 'axe', placementKey: `${side}:axe`, params: { p1: 2 }, damageMin: 10, damageMax: 10, staminaCost: 1, accuracy: 100, critChance: 0 };
  const player = createActor('player');
  const dummy = createActor('dummy');
  const ctx = {
    t: 0,
    player,
    dummy,
    events: [],
    rng: () => 0.5,
    notifyPreDealDamageEarly(piece, hookCtx, res) {
      handler.onPreDealDamageEarly(piece, hookCtx, res);
    },
  };
  handler.onCooldownEffect(axe, ctx);
  assert.equal(axe.bonusDamage, 2, `first hit permanently adds source P1 damage on ${side}`);
  assert.equal(dummy.hp, 1188, `first Axe hit includes the newly added bonus on ${side}`);
  handler.onCooldownEffect(axe, ctx);
  assert.equal(axe.bonusDamage, 4, `second hit adds another permanent source bonus on ${side}`);
  assert.equal(dummy.hp, 1174, `later Axe hit includes the accumulated bonus on ${side}`);
}

console.log('OK Axe focused smoke');
