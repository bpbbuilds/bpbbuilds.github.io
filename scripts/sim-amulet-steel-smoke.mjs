import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('amulet_of_steel');
assert.equal(typeof handler?.onPrepare, 'function', 'Amulet of Steel binds block listeners during source preparation');
assert.equal(typeof handler?.onCombatStart, 'function', 'Amulet of Steel performs its source combat-start block grant');

for (const side of ['you', 'them']) {
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const steel = { itemId: 'amulet_of_steel', placementKey: `${side}:steel`, name: 'Amulet of Steel', params: { blockt: 10, empower: 2, p1: 8 } };
  const blocker = { itemId: 'shield', placementKey: `${side}:blocker`, name: 'Shield' };
  const unrelated = { itemId: 'other', placementKey: `${side}:other`, name: 'Other' };
  const graph = {
    pieces: new Map([
      [steel.placementKey, { key: steel.placementKey, id: steel.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }],
      [blocker.placementKey, { key: blocker.placementKey, id: blocker.itemId, cells: ['1,0'], affectCells: [] }],
      [unrelated.placementKey, { key: unrelated.placementKey, id: unrelated.itemId, cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', steel.placementKey], ['1,0', blocker.placementKey], ['2,0', unrelated.placementKey]]),
  };
  const ctx = { player, pieces: [steel, blocker, unrelated], graph, itemsById: new Map([[steel.itemId, { id: steel.itemId }], [blocker.itemId, { id: blocker.itemId }], [unrelated.itemId, { id: unrelated.itemId }]]), canAffect: null, events: [], t: 0 };

  handler.onPrepare(steel, ctx);
  grantStacks(player, 'block', 10, { originKey: blocker.placementKey, originId: blocker.itemId });
  assert.equal(player.stacks.empower, 2, `linked block threshold grants source Empower on ${side}`);
  grantStacks(player, 'block', 20, { originKey: unrelated.placementKey, originId: unrelated.itemId });
  assert.equal(player.stacks.empower, 2, `unlinked block does not feed source threshold on ${side}`);
  handler.onCombatStart(steel, ctx);
  assert.equal(player.block, 38, `combat-start source Block grant is retained on ${side}`);
  assert.ok(ctx.events.some((event) => event.type === 'buff' && event.meta?.stack === 'empower'), `Empower is projected on ${side}`);
  assert.ok(ctx.events.some((event) => event.type === 'buff' && event.meta?.stack === 'block'), `Block is projected on ${side}`);
}

console.log('OK Amulet of Steel focused smoke');
