import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/WisdomPuppy.gd', 'utf8');
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasType\(Type\.Pet\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveBlock\(\)[\s\S]*cleanseCold\(getP1\(\)\)[\s\S]*activate\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(getNumAffectedItems\(\) \* getP2\(\) \/ 100\.0\)/);

const handler = getScriptHandler('wisdom_puppy');
assert.equal(typeof handler?.onPrepare, 'function', 'Wisdom Puppy uses source preparation hook');
assert.equal(typeof handler?.onCooldownEffect, 'function', 'Wisdom Puppy has a cooldown hook');

for (const side of ['you', 'them']) {
  const puppyKey = `${side}:wisdom`;
  const petKey = `${side}:pet`;
  const nonPetKey = `${side}:sword`;
  const puppy = {
    itemId: 'wisdom_puppy',
    placementKey: puppyKey,
    name: 'Wisdom Puppy',
    params: { p1: 2, p2: 15 },
    blockGrant: 10,
    buffPowers: { block: 1.5 },
    speedScale: 0,
    side,
    kind: 'gadget',
    alive: true,
  };
  const pet = { itemId: 'power_puppy', placementKey: petKey, side, kind: 'pet' };
  const nonPet = { itemId: 'wooden_sword', placementKey: nonPetKey, side, kind: 'weapon' };
  const graph = {
    pieces: new Map([
      [puppyKey, { key: puppyKey, id: puppy.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }],
      [petKey, { key: petKey, id: pet.itemId, cells: ['1,0'], affectCells: [] }],
      [nonPetKey, { key: nonPetKey, id: nonPet.itemId, cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', puppyKey], ['1,0', petKey], ['2,0', nonPetKey]]),
  };
  const actor = createActor(side === 'you' ? 'player' : 'dummy');
  actor.stacks.cold = 5;
  const ctx = {
    t: 4,
    player: actor,
    events: [],
    pieces: [puppy, pet, nonPet],
    graph,
    itemsById: new Map([
      ['wisdom_puppy', { id: 'wisdom_puppy', type: 'Pet', block: 10 }],
      ['power_puppy', { id: 'power_puppy', type: 'Pet' }],
      ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon' }],
    ]),
    canAffect: null,
  };

  handler.onPrepare(puppy, ctx);
  assert.equal(puppy.speedScale, 0.15, `linked Pet speed applies on ${side}`);
  handler.onCooldownEffect(puppy, ctx);
  assert.equal(actor.block, 15, `Block uses the source item buff power on ${side}`);
  assert.equal(actor.stacks.cold, 3, `Cold cleanse uses source P1 on ${side}`);
  const blockEvent = ctx.events.find((event) => event.meta?.handler === 'wisdom_puppy' && event.meta?.stack === 'block');
  const activateEvent = ctx.events.find((event) => event.type === 'activate' && event.meta?.handler === 'wisdom_puppy');
  assert.ok(
    blockEvent && activateEvent &&
      ctx.events.indexOf(blockEvent) < ctx.events.indexOf(activateEvent),
    `effects precede activation on ${side}`,
  );
}

{
  const actor = createActor('player');
  const piece = {
    itemId: 'wisdom_puppy',
    placementKey: 'zero-wisdom',
    name: 'Wisdom Puppy',
    params: { p1: 0, p2: 0 },
    blockGrant: 0,
    side: 'you',
    kind: 'gadget',
    alive: true,
  };
  const ctx = {
    t: 0,
    player: actor,
    events: [],
    itemsById: new Map([['wisdom_puppy', { type: 'Pet', block: 10 }]]),
  };
  handler.onCooldownEffect(piece, ctx);
  assert.equal(actor.block, 0, 'explicit zero Block is not replaced by a fallback or minimum');
  assert.equal(actor.stacks.cold, 0, 'explicit zero Cold cleanse is a no-op');
  assert.ok(ctx.events.some((event) => event.type === 'activate'), 'zero-valued Wisdom Puppy still activates');
}

console.log('OK Wisdom Puppy source parity');
