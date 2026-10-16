import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Eat-o-matic.gd', 'utf8');
assert.match(source, /extends Item/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Food\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*setState\(ArmState\.Off\)[\s\S]*getFirstAffectedItem\(\)[\s\S]*affectedFood\.addSpeed\(foodSpeed\)/);
assert.match(source, /otherFood\.clear\(\)[\s\S]*canAffect_global\(item\)[\s\S]*item != affectedFood/);
assert.match(source, /func onChargeReceived\(_charge\):[\s\S]*if numCharges == 1:[\s\S]*chargedSpeed - foodSpeed[\s\S]*food\.addSpeed\(otherSpeed\)/);
assert.match(source, /func onChargeLeft\(_charge\):[\s\S]*if numCharges == 0:[\s\S]*chargedSpeed - foodSpeed[\s\S]*food\.reduceSpeed\(otherSpeed\)/);

const handler = getScriptHandler('eat_o_matic');
assert.equal(typeof handler?.onPrepare, 'function', 'Eat-o-matic has a source preparation hook');
assert.equal(typeof handler?.onCombatStart, 'function', 'Eat-o-matic preserves its combat-start arm state');
assert.equal(typeof handler?.onChargeReceived, 'function', 'Eat-o-matic reacts to first charge entry');
assert.equal(typeof handler?.onChargeLeft, 'function', 'Eat-o-matic reacts to final charge exit');

function food(id, key = `you:${id}`) {
  return { itemId: id, placementKey: key, kind: 'consumable', speedScale: 0 };
}

const eat = {
  itemId: 'eat_o_matic',
  placementKey: 'you:eat',
  params: { speed: 10, speed2: 40, speed3: 20 },
};
const primary = food('primary_food');
const secondary = food('secondary_food');
const other = food('other_food');
const itemsById = new Map([
  [eat.itemId, { id: eat.itemId, type: 'Accessory' }],
  [primary.itemId, { id: primary.itemId, type: 'Food' }],
  [secondary.itemId, { id: secondary.itemId, type: 'Food' }],
  [other.itemId, { id: other.itemId, type: 'Food' }],
]);
const graph = {
  pieces: new Map([
    [eat.placementKey, { key: eat.placementKey, id: eat.itemId, affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'secondary' }], cells: ['0,0'] }],
    [primary.placementKey, { key: primary.placementKey, id: primary.itemId, affectCells: [], cells: ['1,0'] }],
    [secondary.placementKey, { key: secondary.placementKey, id: secondary.itemId, affectCells: [], cells: ['2,0'] }],
    [other.placementKey, { key: other.placementKey, id: other.itemId, affectCells: [], cells: ['4,0'] }],
  ]),
  filled: new Map([['0,0', eat.placementKey], ['1,0', primary.placementKey], ['2,0', secondary.placementKey], ['4,0', other.placementKey]]),
};
const ctx = { pieces: [eat, primary, secondary, other], graph, itemsById, canAffect: null };

handler.onPrepare(eat, ctx);
assert.equal(eat._eatArmState, 'off', 'preparation starts with the source arm off');
assert.equal(eat._eatPrimary, primary, 'the first primary affected Food is selected');
assert.deepEqual(eat._eatOthers, [secondary, other], 'all other inventory Food items are retained');
assert.equal(primary.speedScale, 0.1, 'the primary Food gains the source preparation speed');
assert.equal(secondary.speedScale, 0, 'secondary Food waits for a charge');
assert.equal(other.speedScale, 0, 'unlinked Food waits for a charge');

handler.onCombatStart(eat, ctx);
assert.equal(eat._eatArmState, 'slow', 'combat start enters the source slow arm state');

eat.numCharges = 1;
handler.onChargeReceived(eat, ctx);
assert.equal(primary.speedScale, 0.4, 'the first charge raises primary Food to charged speed');
assert.equal(secondary.speedScale, 0.2, 'the first charge speeds secondary Food');
assert.equal(other.speedScale, 0.2, 'the first charge speeds every other Food item');
assert.equal(eat._eatArmState, 'fast', 'the first charge enters the source fast arm state');

eat.numCharges = 2;
handler.onChargeReceived(eat, ctx);
assert.equal(primary.speedScale, 0.4, 'additional charges do not stack the source fast transition');
assert.equal(secondary.speedScale, 0.2, 'additional charges do not stack other Food speed');

eat.numCharges = 1;
handler.onChargeLeft(eat, ctx);
assert.equal(primary.speedScale, 0.4, 'non-final charge exit keeps the fast speed');
assert.equal(secondary.speedScale, 0.2, 'non-final charge exit keeps other Food speed');

eat.numCharges = 0;
handler.onChargeLeft(eat, ctx);
assert.ok(Math.abs(primary.speedScale - 0.1) < 1e-9, 'final charge exit restores primary preparation speed');
assert.equal(secondary.speedScale, 0, 'final charge exit removes secondary Food speed');
assert.equal(other.speedScale, 0, 'final charge exit removes other Food speed');
assert.equal(eat._eatArmState, 'slow', 'final charge exit returns to the source slow arm state');

const zero = { ...eat, placementKey: 'you:eat-zero', params: { speed: 0, speed2: 0, speed3: 0 } };
const zeroPrimary = food('zero-primary', 'you:zero-primary');
const zeroCtx = { ...ctx, pieces: [zero, zeroPrimary], graph: { ...graph, pieces: new Map([[zero.placementKey, { key: zero.placementKey, id: zero.itemId, affectCells: [{ cell: '1,0', color: 'primary' }], cells: ['0,0'] }], [zeroPrimary.placementKey, { key: zeroPrimary.placementKey, id: zeroPrimary.itemId, affectCells: [], cells: ['1,0'] }]]), filled: new Map([['0,0', zero.placementKey], ['1,0', zeroPrimary.placementKey]]) }, itemsById: new Map([...itemsById, [zeroPrimary.itemId, { id: zeroPrimary.itemId, type: 'Food' }]]) };
handler.onPrepare(zero, zeroCtx);
assert.equal(zero._eatPrimary, zeroPrimary, 'zero parameters still select the source primary Food');
assert.equal(zeroPrimary.speedScale, 0, 'zero preparation speed remains zero');
zero.numCharges = 1;
handler.onChargeReceived(zero, zeroCtx);
assert.equal(zeroPrimary.speedScale, 0, 'zero charged speed remains zero');

const noLinkEat = { ...eat, placementKey: 'you:eat-no-link', params: { speed: 30, speed2: 40, speed3: 5 } };
const noLinkFood = food('no-link-food', 'you:no-link-food');
const noLinkCtx = { ...ctx, pieces: [noLinkEat, noLinkFood], graph: { pieces: new Map([[noLinkEat.placementKey, { key: noLinkEat.placementKey, id: noLinkEat.itemId, affectCells: [], cells: ['0,0'] }], [noLinkFood.placementKey, { key: noLinkFood.placementKey, id: noLinkFood.itemId, affectCells: [], cells: ['3,0'] }]]), filled: new Map([['0,0', noLinkEat.placementKey], ['3,0', noLinkFood.placementKey]]) }, itemsById: new Map([...itemsById, [noLinkFood.itemId, { id: noLinkFood.itemId, type: 'Food' }]]) };
handler.onPrepare(noLinkEat, noLinkCtx);
assert.equal(noLinkEat._eatPrimary, null, 'no primary board target does not fall back to arbitrary inventory Food');
assert.equal(noLinkFood.speedScale, 0, 'unlinked Food remains unchanged before charge');

console.log('OK Eat-o-matic source port');
