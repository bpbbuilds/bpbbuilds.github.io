import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('angel_crystal');
assert.equal(typeof handler?.onPrepare, 'function', 'Angel Crystal binds its regeneration listener during source preparation');

for (const side of ['you', 'them']) {
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  player.hp = 80;
  player.maxHp = 100;
  const angel = { itemId: 'angel_crystal', placementKey: `${side}:angel`, name: 'Angel Crystal', params: { regen: 2, regen_holy: 3, empower: 1, empower_holy: 2, maxhealth: 4 }, alive: true, charges: 1 };
  const holy = { itemId: 'holy', placementKey: `${side}:holy`, name: 'Holy Item' };
  const nonHoly = { itemId: 'non-holy', placementKey: `${side}:non-holy`, name: 'Non-Holy Item' };
  const graph = { pieces: new Map([[angel.placementKey, { key: angel.placementKey, id: angel.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }] }], [holy.placementKey, { key: holy.placementKey, id: holy.itemId, cells: ['1,0'], affectCells: [] }], [nonHoly.placementKey, { key: nonHoly.placementKey, id: nonHoly.itemId, cells: ['2,0'], affectCells: [] }]]), filled: new Map([['0,0', angel.placementKey], ['1,0', holy.placementKey], ['2,0', nonHoly.placementKey]]) };
  const ctx = { player, pieces: [angel, holy, nonHoly], graph, itemsById: new Map([[angel.itemId, { id: angel.itemId }], [holy.itemId, { id: holy.itemId, extraTypes: ['Holy'] }], [nonHoly.itemId, { id: nonHoly.itemId, type: 'Weapon' }]]), canAffect: null, events: [], t: 0 };
  handler.onPrepare(angel, ctx);
  handler.onCombatStart(angel, ctx);
  assert.equal(player.stacks.regeneration, 5, `start regeneration counts only linked Holy items on ${side}`);
  assert.equal(player.maxHp, 120, `prepared regeneration listener converts start regeneration to max health on ${side}`);
  grantStacks(player, 'regeneration', 1, { originKey: holy.placementKey, originId: holy.itemId });
  assert.equal(player.maxHp, 124, `later regeneration retains source max-health conversion on ${side}`);
  handler.onCooldownEffect(angel, ctx);
  assert.equal(player.stacks.empower, 3, `cooldown Empower counts only linked Holy items on ${side}`);
  assert.equal(angel.alive, false, `source cooldown after-effect consumes Angel Crystal on ${side}`);
}

console.log('OK Angel Crystal focused smoke');
