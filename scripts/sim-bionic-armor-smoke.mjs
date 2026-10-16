import assert from 'node:assert/strict';

import { createActor, healActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('bionic_armor');
assert.equal(typeof handler?.onPrepare, 'function', 'Bionic Armor binds its source listeners during preparation');

for (const side of ['you', 'them']) {
  const player = createActor(side === 'you' ? 'player' : 'dummy', { staminaRegen: 2 });
  const dummy = createActor(side === 'you' ? 'dummy' : 'player');
  const bus = createCombatBus();
  player._combatBus = bus;
  const piece = {
    itemId: 'bionic_armor',
    placementKey: `${side}:bionic_armor`,
    side,
    name: 'Bionic Armor',
    params: {
      staminaregen: 100,
      healtht: 10,
      maxstamina: 0.2,
      staminat1: 5,
      block: 30,
      staminat2: 1,
      empower: 3,
    },
    blockGrant: 100,
  };
  const ctx = { t: 0, player, dummy, bus, events: [], rng: () => 0.5 };

  handler.onPrepare(piece, ctx);
  assert.equal(player.staminaRegen, 0, `source stamina regeneration malus uses the actor base on ${side}`);
  assert.equal(piece._bionicAcc, 0, `Bionic Armor resets its healing/block accumulator on ${side}`);

  handler.onCombatStart(piece, ctx);
  assert.equal(player.block, 100, `Bionic Armor grants its normal combat-start Block on ${side}`);
  const ownerId = side === 'you' ? 'player' : 'dummy';
  assert.ok(ctx.events.some((event) => event.type === 'buff' && event.actor === ownerId && event.target === ownerId), `combat-start Block is attributed to the owner on ${side}`);
  assert.equal(piece._bionicAcc, 0, `an exact multiple of source thresholds leaves no accumulator remainder on ${side}`);
  assert.equal(player.temporaryMaxStamina, 2, `combat-start Block grants source temporary stamina on ${side}`);

  player.hp = player.maxHp - 20;
  healActor(player, 10);
  assert.ok(Math.abs(player.temporaryMaxStamina - 2.2) < 1e-9, `healing crosses one source threshold on ${side}`);
  grantStacks(player, 'block', 10, { originKey: piece.placementKey, originId: piece.itemId });
  assert.ok(Math.abs(player.temporaryMaxStamina - 2.4) < 1e-9, `positive Block changes use the same source accumulator on ${side}`);

  player.stamina = 4;
  handler.onCooldownEffect(piece, ctx);
  assert.equal(player.block, 140, `low stamina grants the source fallback Block amount on ${side}`);
  assert.equal(player.stacks.empower, 0, `low stamina does not grant Empower on ${side}`);
  assert.ok(ctx.events.some((event) => event.type === 'buff' && event.actor === ownerId && event.target === ownerId && event.amount === 30), `low-stamina Block is attributed to the owner on ${side}`);

  player.stamina = 6;
  handler.onCooldownEffect(piece, ctx);
  assert.equal(player.stamina, 5, `high stamina spends the source stamina amount on ${side}`);
  assert.equal(player.stacks.empower, 3, `high stamina grants the source Empower amount on ${side}`);
  assert.ok(ctx.events.some((event) => event.type === 'buff' && event.actor === ownerId && event.target === ownerId && event.amount === 3), `high-stamina Empower is attributed to the owner on ${side}`);
}

console.log('OK Bionic Armor focused smoke');
