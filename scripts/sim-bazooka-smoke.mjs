import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('bazooka');
assert.equal(typeof handler?.onPrepare, 'function', 'Bazooka initializes during preparation');
assert.equal(typeof handler?.onDealtDamage, 'function', 'Bazooka exposes its source hit hook');

for (const side of ['you', 'them']) {
  const bazooka = {
    itemId: 'bazooka',
    placementKey: `${side}:bazooka`,
    side,
    name: 'Bazooka',
    chance: 20,
    blockGrant: 25,
    params: { heatt: 1, luck: 2, luckt: 3, max: 2, dur_stun: 0.6, dur_stunself: 0.4 },
  };
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const dummy = createActor(side === 'you' ? 'dummy' : 'player');
  const ctx = { t: 2, player, dummy, events: [], itemsById: new Map([['bazooka', { id: 'bazooka', chance: 20, block: 25 }]]), rng: () => 0 };

  handler.onPrepare(bazooka, ctx);
  assert.equal(bazooka._bazoUses, 0, `Bazooka resets uses during preparation on ${side}`);
  handler.onDealtDamage(bazooka, ctx, { hit: false });
  assert.equal(bazooka._bazoUses, 0, `a miss does not consume a Bazooka activation on ${side}`);

  grantStacks(player, 'heat', 1);
  handler.onDealtDamage(bazooka, ctx, { hit: true });
  assert.equal(player.stacks.heat, 0, `a qualifying hit spends source Heat on ${side}`);
  assert.equal(player.stacks.lucky, 2, `a qualifying hit grants source Lucky on ${side}`);
  assert.equal(player.block, 25, `a qualifying hit grants source Block on ${side}`);
  assert.equal(dummy.stunnedUntil, 2.6, `a qualifying hit stuns the opponent for source duration on ${side}`);
  assert.equal(player.stunnedUntil, 2.4, `a qualifying hit stuns the owner for source self duration on ${side}`);
  assert.equal(bazooka._bazoUses, 1, `a qualifying hit consumes one use on ${side}`);

  grantStacks(player, 'heat', 1);
  handler.onDealtDamage(bazooka, ctx, { hit: true });
  assert.equal(bazooka._bazoUses, 2, `Bazooka can use its configured maximum on ${side}`);
  grantStacks(player, 'heat', 1);
  handler.onDealtDamage(bazooka, ctx, { hit: true });
  assert.equal(player.stacks.heat, 1, `Bazooka stops after its configured maximum uses on ${side}`);

  grantStacks(player, 'lucky', 1);
  assert.equal(player.stunResistance, 20, `Lucky threshold activates source stun resistance on ${side}`);
  spendStacks(player, 'lucky', 3);
  assert.equal(player.stunResistance, 0, `dropping below Lucky threshold removes source stun resistance on ${side}`);
}

console.log('OK Bazooka focused smoke');
