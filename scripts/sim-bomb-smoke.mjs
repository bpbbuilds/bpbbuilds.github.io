import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('bomb');

for (const side of ['you', 'them']) {
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const dummy = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  const piece = {
    itemId: 'bomb',
    placementKey: `${side}:bomb`,
    side,
    name: 'Bomb',
    kind: 'gadget',
    params: { dam: 4 },
    staminaCost: 1,
    damageMin: 30,
    damageMax: 30,
    alive: true,
    charges: 1,
  };
  const events = [];
  const ctx = { t: 1, player, dummy, events, rng: () => 0.5 };
  const ownerId = side === 'you' ? 'player' : 'dummy';
  const foeId = side === 'you' ? 'dummy' : 'player';

  player.stamina = player.maxStamina;
  dummy.damageResistancePct = 10;
  grantStacks(player, 'lucky', 2);
  grantStacks(player, 'regeneration', 1);
  grantStacks(player, 'mana', 3);
  handler.onCooldownEffect(piece, ctx);

  assert.equal(player.stacks.lucky, 0, `Bomb spends all Lucky on ${side}`);
  assert.equal(player.stacks.regeneration, 0, `Bomb spends all Regeneration on ${side}`);
  assert.equal(player.stacks.mana, 0, `Bomb spends all Mana on ${side}`);
  assert.equal(dummy.damageResistancePct, -14, `Bomb shreds source resistance by dam times removed buffs on ${side}`);
  assert.ok(dummy.hp < 70, `Bomb deals its fixed effect damage after the resistance shred on ${side}`);
  assert.equal(piece.alive, false, `Bomb consumes after a successful stamina spend on ${side}`);
  assert.equal(piece.charges, 0, `Bomb reaches zero charges after consumption on ${side}`);
  assert.ok(events.some((event) => event.type === 'activate' && event.actor === ownerId && event.itemId === 'bomb'), `Bomb activation is attributed to the owner on ${side}`);
  assert.ok(events.some((event) => event.type === 'damage' && event.actor === ownerId && event.target === foeId), `Bomb effect damage is attributed to the owner on ${side}`);

  const starved = { ...piece, placementKey: `${side}:starved-bomb`, alive: true, charges: 1 };
  const starvedEvents = [];
  const starvedCtx = { ...ctx, events: starvedEvents };
  player.stamina = 0;
  player.stacks.lucky = 2;
  handler.onCooldownEffect(starved, starvedCtx);
  assert.equal(starved.alive, true, `starved Bomb is not consumed on ${side}`);
  assert.equal(player.stacks.lucky, 2, `starved Bomb preserves buffs on ${side}`);
  assert.equal(starvedEvents.filter((event) => event.type === 'activate').length, 0, `starved Bomb does not activate on ${side}`);
}

console.log('OK Bomb focused smoke');
