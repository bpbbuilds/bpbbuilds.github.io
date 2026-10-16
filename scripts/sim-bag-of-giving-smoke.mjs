import assert from 'node:assert/strict';

import { createActor, effectiveMaxStamina } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('bag_of_giving');
assert.equal(typeof handler?.onPrepare, 'function', 'Bag of Giving binds during preparation');
assert.equal(typeof handler?.onPeerActivated, 'function', 'Bag of Giving handles linked activations');

for (const side of ['you', 'them']) {
  const bag = {
    itemId: 'bag_of_giving',
    placementKey: `${side}:bag`,
    side,
    name: 'Bag of Giving',
    params: { stamina: 2 },
  };
  const classItem = {
    itemId: 'hero_sword',
    placementKey: `${side}:class-item`,
    side,
    name: 'Hero Sword',
  };
  const neutralItem = {
    itemId: 'neutral_item',
    placementKey: `${side}:neutral-item`,
    side,
    name: 'Neutral Item',
  };
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const opponent = createActor(side === 'you' ? 'dummy' : 'player');
  const bus = createCombatBus();
  const events = [];
  const ctx = {
    t: 1,
    player: owner,
    dummy: opponent,
    bus,
    events,
    canAffect: null,
    itemsById: new Map([
      [bag.itemId, { id: bag.itemId, type: 'Bag' }],
      [classItem.itemId, { id: classItem.itemId, type: 'Melee Weapon', class: 'Ranger' }],
      [neutralItem.itemId, { id: neutralItem.itemId, type: 'Accessory', class: 'Neutral' }],
    ]),
  };

  handler.onPrepare(bag, ctx);
  const beforeMax = owner.maxStamina;
  const beforeStamina = owner.stamina;
  handler.onPeerActivated(bag, classItem, ctx);
  assert.equal(owner.maxStamina, beforeMax, `class activation does not permanently change max stamina on ${side}`);
  assert.equal(owner.temporaryMaxStamina, 2, `class activation grants temporary stamina capacity on ${side}`);
  assert.equal(owner.stamina, beforeStamina + 2, `class activation fills the temporary stamina on ${side}`);
  assert.equal(effectiveMaxStamina(owner), beforeMax + 2, `temporary stamina is reflected in the effective cap on ${side}`);
  assert.ok(events.some((event) => event.type === 'activate' && event.meta?.handler === 'bag_of_giving'), `class activation mini-activates the bag on ${side}`);

  handler.onPeerActivated(bag, neutralItem, ctx);
  assert.equal(owner.temporaryMaxStamina, 2, `neutral activation is rejected by the source class-item filter on ${side}`);
  bus.emit('piece_dealt_damage', { piece: classItem, hit: { hit: true }, t: 2 });
  assert.equal(owner.temporaryMaxStamina, 2, `damage from an inside item does not trigger the bag on ${side}`);
}

console.log('OK Bag of Giving focused smoke');
