/**
 * Piggy of Riches fidelity — Box of Riches inheritance, two-gem source
 * override, socketed-gem max-health calculation, and consume ordering.
 *   node scripts/sim-piggy-of-riches-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const item = catalog.find((entry) => entry.id === 'piggy_of_riches');
assert.ok(item);

const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
const row = inventory.byId.piggy_of_riches;
assert.equal(row?.file, 'Exclusive/PiggyofRiches.gd');
assert.equal(row?.extends, 'BoxofRiches');
assert.equal(fs.existsSync('tools/game-extract-full/Items/BoxofRiches.gd'), true);

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/PiggyofRiches.gd', 'utf8');
assert.match(source, /extends "res:\/\/Items\/BoxofRiches\.gd"/);
assert.match(source, /func _ready\(\):[\s\S]*numGems = 2/);
assert.match(source, /giveMaxHealth\(inventory\.countSocketedGems\(\) \* getP_m\("maxhealth"\)\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveMaxHealth[\s\S]*consume\(\)/);

const piece = {
  itemId: 'piggy_of_riches',
  placementKey: 'riches',
  name: 'Piggy of Riches',
  params: item.params,
  gemIds: ['chipped_emerald', 'chipped_ruby'],
  alive: true,
  charges: null,
};
const owner = createActor('player', { maxHp: 100 });
const foe = createActor('dummy');
const events = [];
const handler = getScriptHandler('piggy_of_riches');
assert.equal(handler?.handlerId, 'piggy_of_riches');
handler.onCombatStart(piece, {
  t: 2.5,
  player: owner,
  dummy: foe,
  pieces: [piece, { itemId: 'wooden_sword', placementKey: 'sword', gemIds: [] }],
  events,
  itemsById: new Map(catalog.map((entry) => [entry.id, entry])),
  graph: { pieces: new Map(), filled: new Map() },
});
assert.equal(owner.maxHp, 106, 'Piggy of Riches grants p1 max health per socketed gem');
assert.equal(owner.hp, 106, 'Piggy of Riches fills the temporary max-health gain');
assert.equal(piece.alive, false, 'Piggy of Riches consumes after granting max health');
assert.equal(piece.charges, 0);
assert.equal(events.at(-1)?.type, 'activate', 'Piggy of Riches activates after max-health grant');

console.log('OK Piggy of Riches source and start-lifecycle regression');
