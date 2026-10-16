import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/StarofCourage.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-accessories.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('const starOfCouragePort'),
  handlerSource.indexOf('/** @type {ScriptHandler} */', handlerSource.indexOf('const starOfCouragePort') + 1),
);

assert.equal(inventory.byId.star_of_courage?.file, 'Exclusive/StarofCourage.gd');
assert.equal(inventory.byId.star_of_courage?.extends, 'Item');
assert.deepEqual(inventory.byId.star_of_courage?.overrides, ['onPrepare']);
assert.match(source, /^extends Item/);
assert.match(source, /onready var staminaReduction = - getP\(\"stamina\"\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*inventory\.getItems\(\)[\s\S]*item\.isWeapon\(\)[\s\S]*changeStaminaFactor\(staminaReduction\)/);
assert.doesNotMatch(portBlock, /onCombatStart/);
assert.match(portBlock, /onPrepare/);
assert.match(portBlock, /itemHasType/);
assert.match(portBlock, /multiplyStaminaCost/);

const star = {
  ...byId.get('star_of_courage'),
  itemId: 'star_of_courage',
  placementKey: 'star',
  name: 'Star of Courage',
  params: { stamina: 5, p2: 5 },
  kind: 'accessory',
};
const weapon = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'weapon',
  name: 'Wooden Sword',
  kind: 'weapon',
  staminaCost: 1.3,
};
const pet = {
  ...byId.get('squirrel'),
  itemId: 'squirrel',
  placementKey: 'pet',
  name: 'Squirrel',
  kind: 'pet',
  damageMax: 10,
  staminaCost: 2,
};
const nonWeaponDamage = {
  ...byId.get('magic_badge'),
  itemId: 'magic_badge',
  placementKey: 'badge',
  name: 'Magic Badge',
  kind: 'passive',
  damageMax: 10,
  staminaCost: 2,
};
const player = createActor('player');
const ctx = {
  player,
  pieces: [star, weapon, pet, nonWeaponDamage],
  itemsById: byId,
  events: [],
  t: 2,
};
const handler = getScriptHandler('star_of_courage');

assert.equal(handler?.handlerId, 'star_of_courage');
handler.onPrepare(star, ctx);
assert.equal(weapon.staminaCost, 1.23, 'the source percentage is applied through the simulator stamina-cost projection');
assert.equal(pet.staminaCost, 2, 'pets are not inventory weapons');
assert.equal(nonWeaponDamage.staminaCost, 2, 'damage-bearing non-weapons are not affected');
console.log('OK Star of Courage source, prepare lifecycle, weapon-only filter, percentage stamina reduction, and non-weapon exclusion regression');
