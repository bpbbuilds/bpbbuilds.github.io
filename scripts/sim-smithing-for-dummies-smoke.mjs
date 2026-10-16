import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SmithingForDummies.gd', 'utf8');
const handler = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b-aura.js', 'utf8');
const row = inventory.byId.smithing_for_dummies;
const portBlock = handler.slice(
  handler.indexOf('export const smithingForDummiesPort'),
  handler.indexOf('/** StoneGloves.gd', handler.indexOf('export const smithingForDummiesPort') + 1),
);

assert.equal(row?.file, 'Exclusive/SmithingForDummies.gd', 'Smithing for Dummies extracted source path');
assert.deepEqual(row?.overrides, ['onCombatStart'], 'Smithing for Dummies inventory override');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.isWeapon\(\)[\s\S]*item\.isCrafted\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*changeStaminaFactor\(staminaReduction\)[\s\S]*addBonusDamage\(bonusDamage\)[\s\S]*activate\(\)/);
assert.match(source, /func onBought\(\):[\s\S]*boostedWhetstones = 1[\s\S]*generateAndStorageItem\(whetstoneDescriptor/);
assert.match(source, /func onItemRoll\(descr\):[\s\S]*multiplyWeight\(1\.5\)/);
assert.match(source, /func onItemRolled\(descr\):[\s\S]*boostedWhetstones -= 1/);
assert.match(portBlock, /modifiedParamValue/);
assert.match(portBlock, /craftedIds/);
assert.match(portBlock, /itemHasType\(item, 'weapon'\)/);
assert.match(portBlock, /pushActivate/);
assert.doesNotMatch(portBlock, /Math\.max\(0, Math\.round\(/);

const smithing = {
  itemId: 'smithing_for_dummies',
  placementKey: 'smithing',
  name: 'Smithing For Dummies',
  params: { stamina: 40, p1: 40, dam: 1, p2: 1 },
  paramAdd: { stamina: 10, dam: 0.5 },
};
const craftedWeapon = {
  itemId: 'crafted_weapon',
  placementKey: 'crafted-weapon',
  name: 'Crafted Weapon',
  kind: 'weapon',
  damageMin: 5,
  damageMax: 6,
  staminaCost: 2,
  baseStaminaCost: 2,
  staminaFactor: 1,
};
const plainWeapon = {
  itemId: 'plain_weapon',
  placementKey: 'plain-weapon',
  name: 'Plain Weapon',
  kind: 'weapon',
  damageMin: 5,
  damageMax: 6,
  staminaCost: 2,
  baseStaminaCost: 2,
  staminaFactor: 1,
};
const craftedPet = {
  itemId: 'crafted_pet',
  placementKey: 'crafted-pet',
  name: 'Crafted Pet',
  kind: 'pet',
  damageMin: 5,
  damageMax: 6,
  staminaCost: 2,
  baseStaminaCost: 2,
  staminaFactor: 1,
};
const graph = {
  pieces: new Map([
    ['smithing', { key: 'smithing', id: 'smithing_for_dummies', cells: [], affectCells: [
      { cell: 'weapon-link', color: 'primary' },
      { cell: 'plain-link', color: 'primary' },
      { cell: 'pet-link', color: 'primary' },
    ] }],
    ['crafted-weapon', { key: 'crafted-weapon', id: 'crafted_weapon', cells: [], affectCells: [] }],
    ['plain-weapon', { key: 'plain-weapon', id: 'plain_weapon', cells: [], affectCells: [] }],
    ['crafted-pet', { key: 'crafted-pet', id: 'crafted_pet', cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['weapon-link', 'crafted-weapon'],
    ['plain-link', 'plain-weapon'],
    ['pet-link', 'crafted-pet'],
  ]),
};
const itemsById = new Map([
  ['smithing_for_dummies', { id: 'smithing_for_dummies' }],
  ['crafted_weapon', { id: 'crafted_weapon', type: 'Melee Weapon' }],
  ['plain_weapon', { id: 'plain_weapon', type: 'Melee Weapon' }],
  ['crafted_pet', { id: 'crafted_pet', type: 'Pet' }],
]);
const events = [];
const runtime = getScriptHandler('smithing_for_dummies');
assert.equal(runtime?.handlerId, 'smithing_for_dummies', 'Smithing for Dummies runtime handler');
runtime.onCombatStart(smithing, {
  pieces: [smithing, craftedWeapon, plainWeapon, craftedPet],
  graph,
  itemsById,
  canAffect: { craftedIds: new Set(['crafted_weapon', 'crafted_pet']) },
  events,
  t: 6,
});

assert.equal(craftedWeapon.staminaFactor, 0.5, 'crafted weapon receives source stamina reduction');
assert.equal(craftedWeapon.staminaCost, 1, 'crafted weapon stamina cost is refreshed');
assert.equal(craftedWeapon.bonusDamage, 1.5, 'crafted weapon receives modified flat damage');
assert.equal(plainWeapon.staminaFactor, 1, 'plain weapon is excluded');
assert.equal(craftedPet.staminaFactor, 1, 'crafted non-weapon is excluded');
assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'smithing_for_dummies'),
  'Smithing for Dummies activation is logged');

console.log('OK Smithing for Dummies source, inventory, crafted-weapon filtering, modified stats, exclusion, and activation regression');
