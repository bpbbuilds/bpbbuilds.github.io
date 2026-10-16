import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DualWielding.gd', 'utf8');
assert.match(source, /extends Item/);
assert.match(source, /func onItemAdded\(item\)/);
assert.match(source, /func onItemRemoved\(item\)/);
assert.match(source, /func canAffect_global\(item\):[\s\S]*item\.isWeapon\(\)[\s\S]*item\.getBaseStaminaCost\(\) > 0/);
assert.match(source, /func onPrepare\(\):[\s\S]*item\.addSpeed\(weaponSpeed\)[\s\S]*item\.changeStaminaFactor\( - weaponStamina\)/);

const handler = getScriptHandler('dual_wielding');
assert.equal(typeof handler?.onPrepare, 'function', 'Dual Wielding has a source preparation hook');
assert.equal(handler?.onCombatStart, undefined, 'Dual Wielding has no extra combat-start mutation');

function weapon(id, baseStaminaCost = 4) {
  return {
    itemId: id,
    placementKey: `you:${id}`,
    kind: 'weapon',
    damageMin: 10,
    damageMax: 10,
    baseStaminaCost,
    staminaCost: baseStaminaCost,
    staminaFactor: 1,
    speedScale: 0,
  };
}

const dual = {
  itemId: 'dual_wielding',
  placementKey: 'you:dual_wielding',
  params: { speed: 15, stamina: 20 },
};
const first = weapon('first');
const second = weapon('second');
const nonWeapon = {
  itemId: 'non-weapon-damage-piece',
  placementKey: 'you:non-weapon-damage-piece',
  kind: 'gadget',
  damageMin: 10,
  damageMax: 10,
  baseStaminaCost: 4,
  staminaCost: 4,
  staminaFactor: 1,
  speedScale: 0,
};
const zeroBaseWeapon = weapon('zero-base', 0);
zeroBaseWeapon.staminaCost = 4;

handler.onPrepare(dual, { pieces: [dual, first, second, nonWeapon, zeroBaseWeapon] });
assert.equal(dual._dualWieldingActive, true, 'exactly two eligible weapons activate Dual Wielding');
assert.equal(first.speedScale, 0.15, 'first weapon gains the source speed factor during preparation');
assert.equal(second.speedScale, 0.15, 'second weapon gains the source speed factor during preparation');
assert.equal(first.staminaFactor, 0.8, 'first weapon gains the source stamina reduction');
assert.equal(second.staminaFactor, 0.8, 'second weapon gains the source stamina reduction');
assert.equal(first.staminaCost, 3.2, 'first weapon refreshes stamina cost from its base value');
assert.equal(second.staminaCost, 3.2, 'second weapon refreshes stamina cost from its base value');
assert.equal(nonWeapon.speedScale, 0, 'damage-bearing non-weapons are excluded by isWeapon');
assert.equal(nonWeapon.staminaCost, 4, 'damage-bearing non-weapons keep their stamina cost');
assert.equal(zeroBaseWeapon.speedScale, 0, 'weapons with zero base stamina are excluded');
assert.equal(zeroBaseWeapon.staminaCost, 4, 'zero-base weapons are not modified');

const threeWeapons = [dual, weapon('one'), weapon('two'), weapon('three')];
handler.onPrepare(dual, { pieces: threeWeapons });
assert.equal(dual._dualWieldingActive, false, 'three eligible weapons do not activate Dual Wielding');
assert.equal(threeWeapons[1].speedScale, 0, 'inactive Dual Wielding does not modify the first weapon');
assert.equal(threeWeapons[2].speedScale, 0, 'inactive Dual Wielding does not modify the second weapon');

const zeroParams = {
  itemId: 'dual_wielding',
  placementKey: 'you:dual-zero',
  params: { speed: 0, stamina: 0 },
};
const zeroFirst = weapon('zero-first');
const zeroSecond = weapon('zero-second');
handler.onPrepare(zeroParams, { pieces: [zeroParams, zeroFirst, zeroSecond] });
assert.equal(zeroParams._dualWieldingActive, true, 'zero parameters do not disable the source activation state');
assert.equal(zeroFirst.speedScale, 0, 'zero source speed remains zero');
assert.equal(zeroFirst.staminaFactor, 1, 'zero source stamina reduction remains zero');
assert.equal(zeroSecond.speedScale, 0, 'zero source speed remains zero on the second weapon');
assert.equal(zeroSecond.staminaFactor, 1, 'zero source stamina reduction remains zero on the second weapon');

console.log('OK Dual Wielding source port');
