import assert from 'node:assert/strict';

import { createActor, gainMaxStaminaTemporary } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('banana');
assert.equal(typeof handler?.onCooldownEffect, 'function', 'Banana exposes its source cooldown effect');

for (const side of ['you', 'them']) {
  const banana = {
    itemId: 'banana',
    placementKey: `${side}:banana`,
    side,
    name: 'Banana',
    params: { heal: 4, stamina: 2 },
    charges: 1,
    alive: true,
  };
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const dummy = createActor(side === 'you' ? 'dummy' : 'player');
  player.hp = player.maxHp - 10;
  player.stamina = player.maxStamina - 1;
  gainMaxStaminaTemporary(player, 2, { filled: false });
  const beforeStamina = player.stamina;
  const events = [];
  const result = handler.onCooldownEffect(banana, { t: 3, player, dummy, events });
  const actor = side === 'you' ? 'player' : 'dummy';
  assert.equal(result, true, `Banana completes its cooldown effect on ${side}`);
  assert.equal(player.hp, player.maxHp - 6, `Banana heals the source amount on ${side}`);
  assert.equal(player.stamina, beforeStamina + 2, `Banana gives stamina through the effective temporary cap on ${side}`);
  assert.equal(banana.charges, 0, `Banana consumes its final charge on ${side}`);
  assert.equal(banana.alive, false, `Banana is removed after its final charge on ${side}`);
  assert.ok(events.some((event) => event.type === 'activate' && event.actor === actor && event.meta?.handler === 'banana'), `Banana activation is attributed to the owner on ${side}`);
  assert.ok(events.some((event) => event.type === 'heal' && event.actor === actor && event.target === actor && event.amount === 4), `Banana heal is attributed to the owner on ${side}`);
  assert.ok(events.some((event) => event.type === 'stamina' && event.actor === actor && event.amount === 2), `Banana stamina grant is attributed to the owner on ${side}`);
}

console.log('OK Banana focused smoke');
