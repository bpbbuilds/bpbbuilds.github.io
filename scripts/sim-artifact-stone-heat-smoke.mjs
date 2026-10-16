import assert from 'node:assert/strict';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('artifact_stone_heat');
assert.equal(typeof handler?.onPrepare, 'function', 'Artifact Stone Heat installs its heat listener during preparation');

for (const side of ['you', 'them']) {
  const stone = { itemId: 'artifact_stone_heat', placementKey: `${side}:stone`, params: { p1: 3, p2: 5, p3: 7 }, ammunition: 1, staminaCost: 1, damageMin: 8, damageMax: 8, accuracy: 100 };
  const weapon = { itemId: 'weapon', placementKey: `${side}:weapon`, damageMin: 1, damageMax: 1, kind: 'weapon', bonusDamage: 0 };
  const trinket = { itemId: 'trinket', placementKey: `${side}:trinket`, damageMin: 0, damageMax: 0, bonusDamage: 0 };
  const graph = { pieces: new Map([[stone.placementKey, { key: stone.placementKey, id: stone.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }] }], [weapon.placementKey, { key: weapon.placementKey, id: weapon.itemId, cells: ['1,0'], affectCells: [] }], [trinket.placementKey, { key: trinket.placementKey, id: trinket.itemId, cells: ['2,0'], affectCells: [] }]]), filled: new Map([['0,0', stone.placementKey], ['1,0', weapon.placementKey], ['2,0', trinket.placementKey]]) };
  const player = createActor('player');
  const dummy = createActor('dummy');
  const ctx = { t: 0, player, dummy, events: [], rng: () => 0.5, pieces: [stone, weapon, trinket], graph, itemsById: new Map([[stone.itemId, { id: stone.itemId, type: 'Weapon' }], [weapon.itemId, { id: weapon.itemId, type: 'Weapon' }], [trinket.itemId, { id: trinket.itemId, type: 'Accessory' }]]), canAffect: null };

  handler.onPrepare(stone, ctx);
  assert.equal(stone.ammunition, 1, `Stone ammo initializes during preparation on ${side}`);
  grantStacks(player, 'heat', 4);
  assert.equal(weapon.bonusDamage, 0, `heat below source threshold does not empower on ${side}`);
  grantStacks(player, 'heat', 1);
  assert.equal(weapon.bonusDamage, 7, `reaching source heat threshold empowers the weapon on ${side}`);
  assert.equal(trinket.bonusDamage, 0, `non-empowerable affected item is excluded on ${side}`);
  grantStacks(player, 'heat', 2);
  assert.equal(weapon.bonusDamage, 7, `threshold empowerment activates only once on ${side}`);
  handler.onCooldownEffect(stone, ctx);
  assert.equal(player.stacks.heat, 10, `stone throw grants source P1 Heat on ${side}`);
  assert.equal(stone.ammunition, 0, `one stone is consumed after the throw on ${side}`);
}

console.log('OK Artifact Stone Heat focused smoke');
