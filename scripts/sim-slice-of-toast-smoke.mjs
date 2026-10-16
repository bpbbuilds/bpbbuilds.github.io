import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SliceofToast.gd', 'utf8');
const handler = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-regen.js', 'utf8');
const row = inventory.byId.slice_of_toast;
const portBlock = handler.slice(
  handler.indexOf('const sliceOfToastPort'),
  handler.indexOf('/** @type {Record<string, ScriptHandler>} */', handler.indexOf('const sliceOfToastPort') + 1),
);

assert.equal(row?.file, 'Exclusive/SliceofToast.gd', 'Slice of Toast extracted source path');
assert.deepEqual(row?.overrides, ['doCooldownEffect'], 'Slice of Toast inventory override');
assert.match(source, /^extends Food/m);
assert.match(source, /onready var staminaThreshold: = getP\("staminat"\)/);
assert.match(source, /onready var stamina: = getP\("stamina"\)/);
assert.match(source, /onready var regen: = int\(getP\("regen"\)\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getCurrentStamina\(\) < staminaThreshold[\s\S]*giveStamina\(stamina\)[\s\S]*else:[\s\S]*giveRegeneration\(regen\)[\s\S]*activate\(\)/);
assert.match(portBlock, /modifiedParamValue/);
assert.match(portBlock, /giveStamina\([\s\S]*grantStacks\([\s\S]*pushActivate/);
assert.doesNotMatch(portBlock, /pushActivate\([\s\S]*if \(\(Number\(ctx\.player\.stamina\)/);

const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const piece = {
  itemId: 'slice_of_toast',
  placementKey: 'you:slice-of-toast',
  name: 'Slice of Toast',
  params: { p1: 2.5, p2: 0.5, p3: 2.9 },
  paramAdd: { staminat: 0.5, stamina: 0.25, regen: 0.4 },
};
const runtime = getScriptHandler('slice_of_toast');
assert.equal(runtime?.handlerId, 'slice_of_toast', 'Slice of Toast runtime handler');

player.stamina = 2.9;
runtime.onCooldownEffect(piece, { player, dummy, events, t: 1 });
assert.equal(player.stamina, 3.65, 'low stamina receives fractional modified grant');
assert.equal(player.stacks.regeneration, 0, 'low stamina does not grant regeneration');
assert.equal(events.at(-1)?.type, 'activate', 'stamina grant precedes activation');

player.stamina = 4;
runtime.onCooldownEffect(piece, { player, dummy, events, t: 2 });
assert.equal(player.stamina, 4, 'high stamina does not receive stamina');
assert.equal(player.stacks.regeneration, 3, 'high stamina grants truncated modified regeneration');
assert.equal(events.at(-1)?.type, 'activate', 'regeneration precedes activation');

console.log('OK Slice of Toast source, inventory, fractional branch, truncation, and activation-order regression');
