import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { tickTimedSpeeds } from '../js/pages/sim/engine/timed-speed.js';

const handler = getScriptHandler('arcane_boots');
assert.equal(typeof handler?.onPrepare, 'function', 'Arcane Boots bind their source damage listener during preparation');

for (const side of ['you', 'them']) {
  const listeners = new Map();
  const bus = { on(name, fn) { const rows = listeners.get(name) || []; rows.push(fn); listeners.set(name, rows); }, emit(name, payload) { for (const fn of listeners.get(name) || []) fn(payload); } };
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  player.hp = 49;
  player.maxHp = 100;
  grantStacks(player, 'mana', 4);
  const boots = { itemId: 'arcane_boots', placementKey: `${side}:boots`, name: 'Arcane Boots', params: { healtht: 50, manat: 4, luck: 2, empower: 3, speed: 20, dur_speed: 1 }, blockGrant: 5, alive: true, charges: 1 };
  const target = { itemId: 'target', placementKey: `${side}:target`, cooldown: 2, speedScale: 0 };
  const graph = { pieces: new Map([[boots.placementKey, { key: boots.placementKey, id: boots.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }], [target.placementKey, { key: target.placementKey, id: target.itemId, cells: ['1,0'], affectCells: [] }]]), filled: new Map([['0,0', boots.placementKey], ['1,0', target.placementKey]]) };
  const ctx = { player, pieces: [boots, target], graph, itemsById: new Map([[boots.itemId, { id: boots.itemId }], [target.itemId, { id: target.itemId }]]), canAffect: null, events: [], t: 0, bus };
  handler.onPrepare(boots, ctx);
  bus.emit('character_damaged', { actor: player });
  assert.equal(player.stacks.mana, 0, `source Mana cost is spent once on ${side}`);
  assert.equal(player.stacks.lucky, 2, `source Lucky grant applies on ${side}`);
  assert.equal(player.stacks.empower, 3, `source Empower grant applies on ${side}`);
  assert.equal(player.block, 5, `source Block grant applies on ${side}`);
  assert.equal(target.speedScale, 0.2, `affected cooldown item receives timed speed on ${side}`);
  assert.equal(boots.alive, false, `source consumption removes Arcane Boots on ${side}`);
  assert.equal(boots.charges, 0, `source consumption clears Arcane Boots charges on ${side}`);
  tickTimedSpeeds([target], 1);
  assert.equal(target.speedScale, 0, `source timed speed expires on ${side}`);
}

console.log('OK Arcane Boots focused smoke');
