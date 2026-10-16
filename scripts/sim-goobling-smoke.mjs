import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const inheritedSource = fs.readFileSync('tools/game-extract-full/Items/Goobert.gd', 'utf8');
const scene = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Goobling.tscn', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const item = catalog.find((entry) => entry.id === 'goobling');

assert.match(scene, /ext_resource path="res:\/\/Items\/Goobert\.gd" type="Script"/);
assert.match(inheritedSource, /func onItemActivated\(event\):[\s\S]*if activations == getP1\(\):[\s\S]*doCooldownEffect\(\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.goobling?.file, 'Goobert.gd');
assert.equal(getScriptHandler('goobling')?.handlerId, 'goobling');

const owner = createActor('player', { maxHp: 100 });
owner.hp = 50;
const foe = createActor('dummy', { maxHp: 100 });
const bus = createCombatBus();
owner._combatBus = bus;
foe._combatBus = bus;
const goobling = {
  ...item,
  itemId: 'goobling',
  placementKey: 'you:goobling',
  name: item.name,
  params: item.params,
  side: 'you',
  alive: true,
  kind: 'pet',
};
const ctx = {
  player: owner,
  dummy: foe,
  events: [],
  itemsById: new Map(catalog.map((entry) => [entry.id, entry])),
  pieces: [],
  graph: { pieces: new Map(), filled: new Map() },
  canAffect: { rulesById: {} },
  bus,
  t: 3,
};
const handler = getScriptHandler('goobling');
const activated = { itemId: 'wooden_sword', placementKey: 'you:sword', name: 'Wooden Sword' };
handler.onPrepare(goobling, ctx);
handler.onPeerActivated(goobling, activated, ctx);
handler.onPeerActivated(goobling, activated, ctx);
assert.equal(owner.hp, 50, 'Goobling waits for its source three-activation threshold');
handler.onPeerActivated(goobling, activated, ctx);
assert.equal(owner.hp, 54, 'Goobling uses the inherited Goobert script and exact heal parameter');
assert.equal(ctx.events.at(-1)?.meta?.handler, 'goobling', 'Goobling retains its own simulator handler identity');

console.log('OK Goobling inherited Goobert source, exact threshold, heal value, and handler identity');
