import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SkullBadge.gd', 'utf8');
const handler = fs.readFileSync('js/pages/sim/engine/scripts/ports-outliers.js', 'utf8');
const skullBadgeBlock = handler.slice(
  handler.indexOf('export const skullBadgePort'),
  handler.indexOf('/** @type {ScriptHandler} */', handler.indexOf('export const skullBadgePort') + 1),
);
const row = inventory.byId.skull_badge;

assert.equal(row?.file, 'Exclusive/SkullBadge.gd', 'Skull Badge extracted source path');
assert.deepEqual(row?.overrides, ['doCooldownEffect'], 'Skull Badge inventory override');
assert.match(source, /func onAddToInventory\(\):[\s\S]*ItemBook\.updateClass\(self\)/);
assert.match(source, /func onRemoveFromInventory\(\):[\s\S]*ItemBook\.updateClass\(self\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*inflictRandomDebuffs\(1\)[\s\S]*activate\(\)/);
assert.match(source, /func getRelatedItems\(\):[\s\S]*Game\.Classes_Full\.Reaper/);
assert.match(source, /func getRelatedItemColumns\(\) -> int:[\s\S]*return 3/);
assert.match(skullBadgeBlock, /inflictRandomDebuffs\([\s\S]*pushActivate/);

const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const piece = {
  itemId: 'skull_badge',
  placementKey: 'you:skull-badge',
  name: 'Skull Badge',
};
const runtime = getScriptHandler('skull_badge');
assert.equal(runtime?.handlerId, 'skull_badge', 'Skull Badge runtime handler');
assert.equal(runtime.onCooldownEffect(piece, {
  player,
  dummy,
  events,
  rng: () => 0,
  t: 7,
}), true, 'Skull Badge cooldown is handled');

assert.equal(dummy.stacks.poison + dummy.stacks.blind + dummy.stacks.cold, 1,
  'Skull Badge inflicts one random debuff');
assert.equal(events.at(-1)?.type, 'activate', 'Skull Badge activates after its debuff');
assert.equal(events.at(-1)?.itemId, 'skull_badge', 'Skull Badge activation identity');

console.log('OK Skull Badge source, inventory, debuff, and activation-order regression');
