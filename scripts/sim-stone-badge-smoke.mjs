import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/StoneBadge.gd', 'utf8');
const aiDSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ai-d.js', 'utf8');
const portBlock = aiDSource.slice(
  aiDSource.indexOf('export const stoneBadgePort'),
  aiDSource.indexOf('/** @type {Record<string, ScriptHandler>} */', aiDSource.indexOf('export const stoneBadgePort')),
);
const cooldownBlock = portBlock.slice(portBlock.indexOf('onCooldownEffect(piece, ctx)'));

assert.equal(inventory.byId.stone_badge?.file, 'Exclusive/StoneBadge.gd');
assert.equal(inventory.byId.stone_badge?.extends, 'Item');
assert.deepEqual(inventory.byId.stone_badge?.overrides, ['doCooldownEffect']);
assert.match(source, /^extends Item/);
assert.match(source, /onready var goldValue: = int\(getP\("goldvalue"\)\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveBlock\(\)[\s\S]*activate\(\)/);
assert.match(source, /func onShopEntered\(\):[\s\S]*goldToSpend = goldValue[\s\S]*generateItem[\s\S]*saveRunState/);
assert.match(source, /func onAddToInventory\(\):[\s\S]*ItemBook\.updateClass\(self\)/);
assert.match(source, /func onAddedToStorageBox\(\):[\s\S]*ItemBook\.updateClass\(self\)/);
assert.match(source, /func discard\(discardGems = true\):[\s\S]*\.discard\(discardGems\)[\s\S]*ItemBook\.updateClass\(self\)/);
assert.match(portBlock, /onCooldownEffect\(piece, ctx\)/);
assert.match(portBlock, /grantStacks\(player, 'block'/);
assert.ok(
  cooldownBlock.indexOf("grantStacks(player, 'block'") < cooldownBlock.indexOf("pushActivate(piece, ctx, 'stone_badge'"),
  'Stone Badge grants Block before activating',
);
assert.match(portBlock, /ctx\.itemsById/);

const badge = {
  ...byId.get('stone_badge'),
  itemId: 'stone_badge',
  placementKey: 'badge',
  name: 'Stone Badge',
  kind: 'accessory',
  params: { goldvalue: 1, p1: 1 },
};
const player = createActor('player');
const events = [];
player._eventLog = events;
const ctx = {
  player,
  pieces: [badge],
  itemsById: byId,
  events,
  t: 2,
};
const handler = getScriptHandler('stone_badge');
assert.equal(handler?.handlerId, 'stone_badge');
handler.onCooldownEffect(badge, ctx);
assert.equal(player.block, 4, 'the catalog Block stat is used by giveBlock()');
assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'stone_badge'));

console.log('OK Stone Badge source, Block grant, activation ordering, and shop/persistence hook regression');
