import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/ProtectivePurse.gd', 'utf8');

assert.equal(inventory.byId.protective_purse?.file, 'ProtectivePurse.gd');
assert.match(source, /extends Bag/);
assert.match(source, /func onCombatStart\(\):[\s\S]*var totalBlock = getBlock\(\)[\s\S]*bagtacularDescriptor\.getP\("block"\)[\s\S]*giveBlock\(totalBlock\)[\s\S]*activate\(\)/);

const purseData = byId.get('protective_purse');
const purse = {
  ...purseData,
  itemId: 'protective_purse',
  placementKey: 'purse',
  name: 'Protective Purse',
  kind: 'bag',
  side: 'you',
  alive: true,
};
const bagtacular = {
  ...byId.get('bagtacular'),
  itemId: 'bagtacular',
  placementKey: 'bagtacular',
  name: 'Bagtacular',
  kind: 'gadget',
  side: 'you',
  alive: true,
};
const player = createActor('player');
const events = [];
const handler = getScriptHandler('protective_purse');

assert.equal(handler?.handlerId, 'protective_purse');
handler.onCombatStart(purse, {
  player,
  pieces: [purse, bagtacular],
  itemsById: byId,
  events,
  t: 0,
});
assert.equal(player.block, 30, 'source uses Purse descriptor block plus named Bagtacular block');
assert.equal(events.at(-2)?.type, 'buff');
assert.equal(events.at(-2)?.amount, 30);
assert.equal(events.at(-1)?.type, 'activate', 'source bag activation is retained');
assert.equal(events.at(-1)?.itemId, 'protective_purse');

console.log('OK Protective Purse source and handler regression');
