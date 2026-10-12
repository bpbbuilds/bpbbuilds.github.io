import assert from 'node:assert/strict';

import { canBagAffectItem } from '../js/shared/backpack-grid/can-affect.js';

const hammer = { id: 'hammer', type: 'Melee Weapon', cooldown: 2, params: { dur_stun: 0.5 } };
const woodenSword = { id: 'wooden_sword', type: 'Melee Weapon', cooldown: 1 };
const healthPotion = { id: 'health_potion', type: 'Potion', cooldown: 5 };
const classItem = { id: 'hero_sword', type: 'Melee Weapon', class: 'Ranger' };
const sourceChecks = [
  ['bag_of_giving', classItem, { classMasks: { hero_sword: 1 }, classBits: { None: 0, Neutral: 127 } }],
  ['berserker_bag', woodenSword],
  ['box_of_prosperity', { id: 'godly', rarity: 'Godly' }],
  ['engineer_box', { id: 'battery', type: 'Accessory' }],
  ['fanny_pack', woodenSword],
  ['fire_pit', { id: 'torch', extraTypes: ['Fire'] }],
  ['holdall', { id: 'stone', class: 'Neutral' }],
  ['potion_belt', healthPotion],
  ['puzzlebag_j', hammer],
  ['puzzlebag_l', { id: 'garlic', params: { heal: 1 } }],
  ['puzzlebag_s', { id: 'regen', gainsBuffs: true }],
  ['puzzlebag_t', { id: 'mana_orb', usesBuffs: true }],
  ['puzzlebag_z', { id: 'poison_dagger', effect: '<Poison>' }],
  ['puzzlebox', woodenSword],
  ['ranger_bag', { id: 'spear', type: 'Melee Weapon', damageMin: 2 }],
  ['relic_case', woodenSword],
  ['scholar_bag', { id: 'mana_item' }, { gainedStacksById: { mana_item: ['Mana'] } }],
  ['sewing_case', woodenSword, { craftedIds: new Set(['wooden_sword']) }],
  ['storage_coffin', { id: 'trigger', canActivate: true }],
  ['toolbox', { id: 'axe', type: 'Melee Weapon', damageMin: 2 }],
  ['vineweave_basket', { id: 'leaf', extraTypes: ['Nature'] }],
  ['portable_altar', woodenSword],
];

for (const [bagId, target, extra] of sourceChecks) {
  assert.equal(canBagAffectItem({ id: bagId, type: 'Bag' }, target, extra), true, `${bagId} accepts its source-defined target`);
}

assert.equal(canBagAffectItem({ id: 'puzzlebag_j', type: 'Bag' }, hammer), true);
assert.equal(canBagAffectItem({ id: 'puzzlebag_j', type: 'Bag' }, woodenSword), false);
assert.equal(canBagAffectItem({ id: 'potion_belt', type: 'Bag' }, healthPotion), true);
assert.equal(canBagAffectItem({ id: 'potion_belt', type: 'Bag' }, woodenSword), false);
assert.equal(canBagAffectItem({ id: 'portable_altar', type: 'Bag' }, woodenSword), true);
assert.equal(canBagAffectItem({ id: 'portable_altar', type: 'Bag' }, { ...woodenSword, type: 'Bag' }), false);
assert.equal(canBagAffectItem({ id: 'engineer_box', type: 'Bag' }, woodenSword), false);

console.log('Create bag-synergy source-rule smoke passed.');
