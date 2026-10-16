import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('bloodthorne');
assert.equal(typeof handler?.onPrepare, 'function', 'Bloodthorne binds source listeners during preparation');

for (const side of ['you', 'them']) {
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const dummy = createActor(side === 'you' ? 'dummy' : 'player');
  const piece = {
    itemId: 'bloodthorne',
    placementKey: `${side}:bloodthorne`,
    side,
    name: 'Bloodthorne',
    kind: 'weapon',
    params: { p1: 3, p2: 1, p3: 1 },
    damageMin: 10,
    damageMax: 10,
    staminaCost: 5,
    accuracy: 100,
    critChance: 0,
  };
  const ctx = {
    t: 0,
    player,
    dummy,
    events: [],
    rng: () => 0.5,
    notifyPreDealDamageEarly(currentPiece, hookCtx, res) {
      handler.onPreDealDamageEarly(currentPiece, hookCtx, res);
    },
  };

  grantStacks(player, 'vampirism', 2);
  grantStacks(player, 'spikes', 3);
  handler.onPrepare(piece, ctx);
  assert.equal(piece.bonusDamage || 0, 0, `pre-existing Vampirism and Spikes do not retroactively change damage on ${side}`);

  grantStacks(player, 'vampirism', 1);
  grantStacks(player, 'spikes', 2);
  assert.equal(piece.bonusDamage, 3, `source Vampirism and Spikes listeners add varying damage on ${side}`);
  assert.equal(piece.removableBonusDamage || 0, 0, `source varying damage is not removable bonus damage on ${side}`);

  grantStacks(player, 'regeneration', 3);
  const beforeHp = dummy.hp;
  handler.onCooldownEffect(piece, ctx);
  assert.equal(player.stacks.regeneration, 0, `Bloodthorne spends source Regeneration on a successful hit on ${side}`);
  assert.equal(player.stacks.vampirism, 4, `Bloodthorne grants source Vampirism on ${side}`);
  assert.equal(player.stacks.spikes, 6, `Bloodthorne grants source Spikes on ${side}`);
  assert.equal(piece.bonusDamage, 5, `source varying damage updates after the Regen conversion on ${side}`);
  assert.equal(dummy.hp, beforeHp - 13, `new varying damage waits until the next already-rolled hit on ${side}`);

  player.stamina = player.maxStamina;
  handler.onCooldownEffect(piece, ctx);
  assert.equal(dummy.hp, beforeHp - 13 - 15, `Bloodthorne carries varying damage into the next hit on ${side}`);
}

console.log('OK Bloodthorne focused smoke');
