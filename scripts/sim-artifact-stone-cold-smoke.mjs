import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('artifact_stone_cold');
assert.equal(typeof handler?.onPrepare, 'function', 'Artifact Stone Cold installs its weapon listener during preparation');

for (const side of ['you', 'them']) {
  const stone = { itemId: 'artifact_stone_cold', placementKey: `${side}:stone`, params: { p1: 2, p2: 4 }, ammunition: 1, staminaCost: 1, damageMin: 8, damageMax: 8, accuracy: 100 };
  const weapon = { itemId: 'weapon', placementKey: `${side}:weapon`, damageMin: 1, damageMax: 1, kind: 'weapon' };
  const trinket = { itemId: 'trinket', placementKey: `${side}:trinket`, damageMin: 0, damageMax: 0 };
  const graph = { pieces: new Map([[stone.placementKey, { key: stone.placementKey, id: stone.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }] }], [weapon.placementKey, { key: weapon.placementKey, id: weapon.itemId, cells: ['1,0'], affectCells: [] }], [trinket.placementKey, { key: trinket.placementKey, id: trinket.itemId, cells: ['2,0'], affectCells: [] }]]), filled: new Map([['0,0', stone.placementKey], ['1,0', weapon.placementKey], ['2,0', trinket.placementKey]]) };
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const dummy = createActor(side === 'you' ? 'dummy' : 'player');
  const bus = createCombatBus();
  const ctx = { t: 0, player, dummy, bus, events: [], rng: () => 0.5, pieces: [stone, weapon, trinket], graph, itemsById: new Map([[stone.itemId, { id: stone.itemId, type: 'Weapon' }], [weapon.itemId, { id: weapon.itemId, type: 'Weapon' }], [trinket.itemId, { id: trinket.itemId, type: 'Accessory' }]]), canAffect: null };

  handler.onPrepare(stone, ctx);
  assert.equal(stone.ammunition, 1, `Stone ammo initializes during preparation on ${side}`);
  bus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: false }, t: 1 });
  assert.equal(dummy.stacks.cold, 0, `missed affected weapon does not inflict Cold on ${side}`);
  bus.emit('piece_dealt_damage', { piece: trinket, hit: { hit: true }, t: 2 });
  assert.equal(dummy.stacks.cold, 0, `non-empowerable affected item does not inflict Cold on ${side}`);
  bus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true }, t: 3 });
  assert.equal(dummy.stacks.cold, 4, `hit affected weapon inflicts source P2 Cold on ${side}`);
  handler.onCooldownEffect(stone, ctx);
  assert.equal(dummy.stacks.cold, 6, `stone pre-hit inflicts source P1 Cold on ${side}`);
}

console.log('OK Artifact Stone Cold focused smoke');
