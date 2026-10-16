import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SlimeTime.gd', 'utf8');
const handler = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-d-board.js', 'utf8');
const row = inventory.byId.slime_time;
const portBlock = handler.slice(
  handler.indexOf('export const slimeTimePort'),
  handler.indexOf('/** @type {Record<string, ScriptHandler>} */', handler.indexOf('export const slimeTimePort') + 1),
);

assert.equal(row?.file, 'Exclusive/SlimeTime.gd', 'Slime Time extracted source path');
assert.deepEqual(row?.overrides, ['doCooldownEffect'], 'Slime Time inventory override');
assert.match(source, /func onBought\(\):[\s\S]*generateAndStorageItem\(gooblingDescriptor[\s\S]*Game\.saveRunState\(\)[\s\S]*activate\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*inventory\.getItems\(\)[\s\S]*canAffect_global\(item\)[\s\S]*item\.onItemActivated\(null\)[\s\S]*activate\(\)/);
assert.match(source, /func canAffect_global\(item\):[\s\S]*return item is Goobert/);
assert.match(portBlock, /for \(const other of ctx\.pieces \|\| \[\]\)/);
assert.match(portBlock, /other\.side !== piece\.side/);
assert.match(portBlock, /onPeerActivated/);
assert.match(portBlock, /for \(const other of ctx\.pieces \|\| \[\]\)[\s\S]*pushActivate/);

const player = createActor('player');
const dummy = createActor('dummy');
player.hp = 100;
const events = [];
const slime = {
  itemId: 'slime_time',
  placementKey: 'you:slime-time',
  name: 'Slime Time',
  side: 'you',
};
const friendlyGoobert = {
  itemId: 'goobert',
  placementKey: 'you:goobert',
  name: 'Goobert',
  side: 'you',
  params: { p1: 1, p2: 8 },
};
const opposingGoobert = {
  itemId: 'goobert',
  placementKey: 'them:goobert',
  name: 'Goobert',
  side: 'them',
  params: { p1: 1, p2: 8 },
};
const runtime = getScriptHandler('slime_time');
assert.equal(runtime?.handlerId, 'slime_time', 'Slime Time runtime handler');
runtime.onCooldownEffect(slime, {
  player,
  dummy,
  pieces: [slime, friendlyGoobert, opposingGoobert],
  itemsById: new Map(),
  events,
  rng: () => 0,
  t: 4,
});

assert.equal(player.hp, 108, 'Slime Time activates only same-side Gooberts');
const healIndex = events.findIndex((event) => event.type === 'heal' && event.itemId === 'goobert');
const slimeActivationIndex = events.findIndex((event) => event.type === 'activate' && event.itemId === 'slime_time');
assert.ok(healIndex >= 0 && slimeActivationIndex > healIndex,
  'Goobert activation effects precede Slime Time activation');

console.log('OK Slime Time source, inventory, same-side Goobert filtering, and activation-order regression');
