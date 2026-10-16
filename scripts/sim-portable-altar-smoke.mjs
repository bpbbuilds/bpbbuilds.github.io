import assert from 'node:assert/strict';
import fs from 'node:fs';

import { canBagAffectItem } from '../js/shared/backpack-grid/can-affect.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const item = catalog.find((entry) => entry.id === 'portable_altar');
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/PortableAltar.gd', 'utf8');

assert.equal(inventory.byId.portable_altar?.file, 'Exclusive/PortableAltar.gd');
assert.equal(inventory.byId.portable_altar?.extends, 'Bag');
assert.match(source, /func canLockBag\(\):[\s\S]*return true/);
assert.match(source, /func showBagBorderForItem\(item\):[\s\S]*return not item\.isBag\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveEmpower\(getP\("empower"\)\)[\s\S]*activate\(\)/);
assert.equal(item.params.p1, 1);

const sword = { id: 'wooden_sword', type: 'Melee Weapon' };
assert.equal(canBagAffectItem({ id: 'portable_altar', type: 'Bag' }, sword), true);
assert.equal(canBagAffectItem({ id: 'portable_altar', type: 'Bag' }, { id: 'potion_belt', type: 'Bag' }), false);

const piece = {
  ...item,
  itemId: 'portable_altar',
  placementKey: 'altar',
  name: 'Portable Altar',
  params: item.params,
  kind: 'bag',
  alive: true,
};
const player = createActor('player', { maxHp: 100 });
const events = [];
const ctx = { player, dummy: createActor('dummy'), events, t: 2, rng: () => 0 };
const handler = getScriptHandler('portable_altar');

assert.equal(handler?.handlerId, 'portable_altar');
handler.onCombatStart(piece, ctx);
assert.equal(player.stacks.empower, 1, 'source Empower parameter grants one Empower');
assert.deepEqual(events.map((event) => event.type), ['buff', 'activate']);
assert.equal(events.at(-1)?.meta.handler, 'portable_altar');

console.log('OK Portable Altar source and bag activation regression');
