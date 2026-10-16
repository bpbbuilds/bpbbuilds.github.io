import assert from 'node:assert/strict';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const handler = getScriptHandler('anvil');
assert.equal(typeof handler?.onPreCombatStart, 'function', 'Anvil applies its source aura before combat starts');

for (const side of ['you', 'them']) {
  const anvil = { itemId: 'anvil', placementKey: `${side}:anvil`, name: 'Anvil', params: { p1: 3, p2: 10 } };
  const crafted = { itemId: 'crafted', placementKey: `${side}:crafted`, name: 'Crafted Item' };
  const weapon = { itemId: 'weapon', placementKey: `${side}:weapon`, name: 'Weapon', kind: 'weapon', damageMin: 5, damageMax: 5, staminaCost: 10 };
  const primaryWeapon = { itemId: 'primary-weapon', placementKey: `${side}:primary-weapon`, name: 'Primary Weapon', kind: 'weapon', damageMin: 5, damageMax: 5, staminaCost: 10 };
  const graph = { pieces: new Map([[anvil.placementKey, { key: anvil.placementKey, id: anvil.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'secondary' }, { cell: '3,0', color: 'primary' }] }], [crafted.placementKey, { key: crafted.placementKey, id: crafted.itemId, cells: ['1,0'], affectCells: [] }], [weapon.placementKey, { key: weapon.placementKey, id: weapon.itemId, cells: ['2,0'], affectCells: [] }], [primaryWeapon.placementKey, { key: primaryWeapon.placementKey, id: primaryWeapon.itemId, cells: ['3,0'], affectCells: [] }]]), filled: new Map([['0,0', anvil.placementKey], ['1,0', crafted.placementKey], ['2,0', weapon.placementKey], ['3,0', primaryWeapon.placementKey]]) };
  const ctx = { pieces: [anvil, crafted, weapon, primaryWeapon], graph, itemsById: new Map([[anvil.itemId, { id: anvil.itemId }], [crafted.itemId, { id: crafted.itemId, crafted: true }], [weapon.itemId, { id: weapon.itemId, type: 'Weapon' }], [primaryWeapon.itemId, { id: primaryWeapon.itemId, type: 'Weapon' }]]), canAffect: null, events: [], t: 0 };
  handler.onPreCombatStart(anvil, ctx);
  assert.equal(weapon.bonusDamage, 3, `secondary weapon gets source crafted-count damage on ${side}`);
  assert.equal(weapon.staminaCost, 9, `secondary weapon gets source stamina-factor reduction on ${side}`);
  assert.equal(primaryWeapon.bonusDamage || 0, 0, `primary weapon is not a secondary target on ${side}`);
  assert.ok(ctx.events.some((event) => event.type === 'activate'), `Anvil source activation is projected on ${side}`);
}

console.log('OK Anvil focused smoke');
