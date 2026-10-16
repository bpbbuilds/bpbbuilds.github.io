import assert from 'node:assert/strict';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { tickTimedSpeeds } from '../js/pages/sim/engine/timed-speed.js';

const handler = getScriptHandler('amulet_of_agility');
assert.equal(typeof handler?.onPreCombatStart, 'function');
assert.equal(typeof handler?.onCombatStart, 'function');
for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const amulet = { itemId: 'amulet_of_agility', placementKey: `${side}:amulet`, name: 'Amulet of Agility', params: { speed: 20, dur: 1, refund: 25 }, cooldown: 0, side };
  const target = { itemId: 'target', placementKey: `${side}:target`, name: 'Target', cooldown: 2, speedScale: 0, side };
  const graph = { pieces: new Map([[amulet.placementKey, { key: amulet.placementKey, id: amulet.itemId, cells: ['0,0'], affectCells: [] }], [target.placementKey, { key: target.placementKey, id: target.itemId, cells: ['1,0'], affectCells: [] }]]), filled: new Map([['0,0', amulet.placementKey], ['1,0', target.placementKey]]) };
  const ctx = { player: owner, dummy: createActor(side === 'you' ? 'dummy' : 'player'), pieces: [amulet, target], itemsById: new Map([[amulet.itemId, { id: amulet.itemId }], ['target', { id: 'target' }]]), graph, canAffect: null, events: [], t: 0, rng: () => 0 };
  handler.onPreCombatStart(amulet, ctx);
  handler.onCombatStart(amulet, ctx);
  assert.equal(target.speedScale, 0.2, `timed source speed applies on ${side}`);
  tickTimedSpeeds([target], 1);
  assert.equal(target.speedScale, 0, `timed source speed expires on ${side}`);
  grantStacks(owner, 'mana', 4, { rng: () => 0 });
  spendStacks(owner, 'mana', 4, { rng: () => 0, used: true });
  assert.equal(owner.stacks.mana, 1, `fractional source refund returns one Mana on ${side}`);
}
console.log('OK Amulet of Agility focused smoke');
