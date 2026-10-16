import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const source = fs.readFileSync('tools/game-extract-full/Items/PocketSand.gd', 'utf8');

assert.equal(inventory.byId.pocket_sand?.file, 'PocketSand.gd');
assert.match(source, /func onCombatStart\(\):[\s\S]*inflictBlind\(getP1\(\)\)[\s\S]*consume\(\)/);

const sand = {
  ...byId.get('pocket_sand'),
  itemId: 'pocket_sand',
  placementKey: 'sand',
  name: 'Pocket Sand',
  params: byId.get('pocket_sand').params,
  alive: true,
  charges: 1,
  kind: 'passive',
};
const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 100 });
const events = [];
const ctx = { player, dummy, events, t: 2.5, rng: () => 0 };
const handler = getScriptHandler('pocket_sand');

assert.equal(handler?.handlerId, 'pocket_sand');
handler.onCombatStart(sand, ctx);
assert.equal(dummy.stacks.blind, 1, 'Pocket Sand applies source p1 Blind');
assert.equal(sand.alive, false, 'Pocket Sand is consumed once');
assert.equal(sand.charges, 0);
assert.deepEqual(events.map((event) => event.type), ['debuff', 'activate']);
assert.equal(events.at(-1).meta.consume, true);

console.log('OK Pocket Sand source and consume lifecycle regression');
