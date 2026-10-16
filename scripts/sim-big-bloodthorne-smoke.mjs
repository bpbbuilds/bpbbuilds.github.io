import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('big_bloodthorne');
assert.equal(typeof handler?.onPrepare, 'function', 'Big Bloodthorne runs its source preparation hook');
assert.equal(typeof handler?.onPreDealDamageEarly, 'function', 'Big Bloodthorne exposes its source early-hit hook');

for (const side of ['you', 'them']) {
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const dummy = createActor(side === 'you' ? 'dummy' : 'player');
  const piece = {
    itemId: 'big_bloodthorne',
    placementKey: `${side}:big_bloodthorne`,
    side,
    name: 'Big Bloodthorne',
    kind: 'weapon',
    params: {
      p1: 5,
      p2: 2,
      p3: 2,
      p4: 3,
      p5: 6,
      p6: 6,
      p7: 2,
      regent: 3,
      vampirism: 6,
      spikes: 6,
      dam: 2,
    },
    damageMin: 10,
    damageMax: 10,
    staminaCost: 5,
    baseCooldown: 5,
    cooldown: 5,
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

  grantStacks(player, 'vampirism', 3);
  grantStacks(player, 'spikes', 2);
  grantStacks(player, 'regeneration', 3);
  handler.onPrepare(piece, ctx);

  assert.equal(piece.bonusDamage || 0, 0, `pre-existing Vampirism and Spikes do not retroactively change damage on ${side}`);
  assert.equal(piece.staminaCost, 5, `Greatsword keeps its base stamina cost before Empower on ${side}`);
  assert.equal(piece.cooldown, 5, `Greatsword keeps its base cooldown before Empower on ${side}`);

  grantStacks(player, 'empower', 5);
  assert.equal(piece.staminaCost, 2, `Greatsword applies the Empower stamina cost on ${side}`);
  assert.equal(piece.cooldown, 2, `Greatsword applies the Empower cooldown on ${side}`);
  spendStacks(player, 'empower', 5);
  assert.equal(piece.staminaCost, 5, `Greatsword restores stamina cost when Empower drops on ${side}`);
  assert.equal(piece.cooldown, 5, `Greatsword restores cooldown when Empower drops on ${side}`);

  grantStacks(player, 'vampirism', 1);
  grantStacks(player, 'spikes', 2);
  spendStacks(player, 'vampirism', 1);
  assert.equal(piece.bonusDamage, 4, `Vampirism and Spikes changes use source varying damage on ${side}`);

  const beforeHp = dummy.hp;
  handler.onCooldownEffect(piece, ctx);
  assert.equal(player.stacks.regeneration, 0, `a successful hit spends the configured Regeneration threshold on ${side}`);
  assert.equal(player.stacks.vampirism, 9, `a successful hit grants source Vampirism on ${side}`);
  assert.equal(player.stacks.spikes, 10, `a successful hit grants source Spikes on ${side}`);
  assert.equal(piece.bonusDamage, 28, `new Vampirism and Spikes immediately update varying damage on ${side}`);
  assert.equal(dummy.hp, beforeHp - 14, `the early-hit conversion does not retroactively alter the already rolled hit on ${side}`);

  player.stamina = player.maxStamina;
  handler.onCooldownEffect(piece, ctx);
  assert.equal(dummy.hp, beforeHp - 14 - 38, `the varying damage applies to the next hit on ${side}`);
}

console.log('OK Big Bloodthorne focused smoke');
