import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('artifact_stone_death');
assert.equal(typeof handler?.onPrepare, 'function', 'Artifact Stone Death installs fatigue listeners during preparation');

for (const side of ['you', 'them']) {
  const stone = { itemId: 'artifact_stone_death', placementKey: `${side}:stone`, params: { p1: 2 }, chance: 2, ammunition: 1, staminaCost: 1, damageMin: 8, damageMax: 8, accuracy: 100 };
  const weapon = { itemId: 'weapon', placementKey: `${side}:weapon`, damageMin: 1, damageMax: 1, kind: 'weapon', critChance: 0 };
  const trinket = { itemId: 'trinket', placementKey: `${side}:trinket`, damageMin: 0, damageMax: 0, critChance: 0 };
  const graph = { pieces: new Map([[stone.placementKey, { key: stone.placementKey, id: stone.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }] }], [weapon.placementKey, { key: weapon.placementKey, id: weapon.itemId, cells: ['1,0'], affectCells: [] }], [trinket.placementKey, { key: trinket.placementKey, id: trinket.itemId, cells: ['2,0'], affectCells: [] }]]), filled: new Map([['0,0', stone.placementKey], ['1,0', weapon.placementKey], ['2,0', trinket.placementKey]]) };
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const ctx = { t: 0, player, dummy, bus, events: [], rng: () => 0.5, pieces: [stone, weapon, trinket], graph, itemsById: new Map([[stone.itemId, { id: stone.itemId, type: 'Weapon' }], [weapon.itemId, { id: weapon.itemId, type: 'Weapon' }], [trinket.itemId, { id: trinket.itemId, type: 'Accessory' }]]), canAffect: null };

  handler.onPrepare(stone, ctx);
  assert.equal(stone.ammunition, 1, `Stone ammo initializes during preparation on ${side}`);
  bus.emit('fatigue_tick', { damage: 3, t: 1 });
  assert.equal(weapon.critChance, 6, `fatigue increase adds source chance times the fatigue difference on ${side}`);
  assert.equal(trinket.critChance, 0, `non-damaging affected item is excluded on ${side}`);
  bus.emit('fatigue_tick', { damage: 5, t: 2 });
  assert.equal(weapon.critChance, 10, `only the next fatigue difference is added on ${side}`);
  handler.onCooldownEffect(stone, ctx);
  assert.equal(dummy.hp, 1190, `stone pre-hit applies source P1 Fatigue plus the configured stone hit on ${side}`);
  assert.equal(stone.ammunition, 0, `one stone is consumed after the throw on ${side}`);
}

console.log('OK Artifact Stone Death focused smoke');
