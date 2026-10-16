import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SliceofBread.gd', 'utf8');
const handler = fs.readFileSync('js/pages/sim/engine/scripts/ports-consumable.js', 'utf8');
const row = inventory.byId.slice_of_bread;
const portBlock = handler.slice(
  handler.indexOf('export const sliceOfBreadPort'),
  handler.indexOf('/** @type {ScriptHandler} */', handler.indexOf('export const sliceOfBreadPort') + 1),
);

assert.equal(row?.file, 'Exclusive/SliceofBread.gd', 'Slice of Bread extracted source path');
assert.deepEqual(row?.overrides, ['doCooldownEffect'], 'Slice of Bread inventory override');
assert.match(source, /^extends Food/m);
assert.match(source, /onready var staminaThreshold: = getP\("staminat"\)/);
assert.match(source, /onready var stamina: = getP\("stamina"\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getCurrentStamina\(\) < staminaThreshold[\s\S]*giveStamina\(stamina\)[\s\S]*activate\(\)/);
assert.match(portBlock, /modifiedParamValue/);
assert.match(portBlock, /giveStamina\([\s\S]*pushActivate/);
assert.doesNotMatch(portBlock, /Math\.max\(1, Math\.round\(/);

const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const piece = {
  itemId: 'slice_of_bread',
  placementKey: 'you:slice-of-bread',
  name: 'Slice of Bread',
  params: { p1: 2.5, p2: 0.5 },
  paramAdd: { staminat: 0.5, stamina: 0.25 },
};
const runtime = getScriptHandler('slice_of_bread');
assert.equal(runtime?.handlerId, 'slice_of_bread', 'Slice of Bread runtime handler');

player.stamina = 3;
runtime.onCooldownEffect(piece, { player, dummy, events, t: 1 });
assert.equal(player.stamina, 3, 'equal threshold does not grant stamina');
assert.equal(events.at(-1)?.type, 'activate', 'Slice of Bread always activates');

player.stamina = 2.9;
runtime.onCooldownEffect(piece, { player, dummy, events, t: 2 });
assert.equal(player.stamina, 3.65, 'fractional modified stamina grant is preserved');
assert.equal(events.at(-1)?.type, 'activate', 'stamina grant precedes activation');
assert.equal(events.at(-2)?.type, 'stamina', 'stamina event precedes activation');
assert.equal(events.at(-2)?.amount, 0.75, 'stamina event reports the actual grant');

console.log('OK Slice of Bread source, inventory, fractional threshold, and activation-order regression');
