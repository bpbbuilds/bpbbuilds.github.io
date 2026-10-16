import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/PineProtector.gd', 'utf8');
const parent = fs.readFileSync('tools/game-extract-full/Items/SpikedShield.gd', 'utf8');

assert.equal(inventory.byId.pine_protector?.file, 'Exclusive/PineProtector.gd');
assert.match(source, /extends "res:\/\/Items\/SpikedShield\.gd"/);
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasType\(Type\.Food\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*\.onPrepare\(\)[\s\S]*connectForCombat\(item, "activated", "onItemActivated"\)/);
assert.match(source, /maxSpikes = getP\("maxspikes"\) \+ getP\("maxspikes_food"\) \* getNumAffectedItems\(\)/);
assert.match(source, /damblockIncrease \+= min\(damblock2, maxblock - damblockIncrease\)/);
assert.match(source, /heal\(\)/);
assert.match(parent, /func beforeBlock\(\):[\s\S]*giveSpikes\(spikesToGive\)/);
assert.match(parent, /func afterBlock\(\):[\s\S]*drainStamina\(getP2\(\)[\s\S]*activate\(\)/);

const piece = (id, placementKey, overrides = {}) => ({
  ...byId.get(id),
  itemId: id,
  placementKey,
  name: byId.get(id)?.name || id,
  params: byId.get(id)?.params || {},
  alive: true,
  kind: id === 'pine_protector' ? 'armor' : 'food',
  chance: byId.get(id)?.chance ?? 30,
  ...overrides,
});

const pine = piece('pine_protector', 'pine');
const food = piece('banana', 'food');
const graph = {
  pieces: new Map([
    ['pine', { key: 'pine', id: 'pine_protector', cells: [], affectCells: [
      { cell: 'food-link', color: 'primary' },
    ] }],
    ['food', { key: 'food', id: 'banana', cells: [], affectCells: [] }],
  ]),
  filled: new Map([['food-link', 'food']]),
};
const player = createActor('player', { maxHp: 100 });
player.hp = 60;
player._simT = 2.5;
const events = [];
const ctx = {
  player,
  dummy: createActor('dummy', { maxHp: 100 }),
  pieces: [pine, food],
  graph,
  itemsById: byId,
  canAffect: {
    rulesById: canAffectRules.byId,
    startOfBattleIds: new Set(['just_stats']),
  },
  events,
  t: 0,
  rng: () => 0,
};

const handler = getScriptHandler('pine_protector');
assert.equal(handler?.handlerId, 'pine_protector');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler?.onCombatStart, undefined, 'Pine Protector uses source onPrepare lifecycle');

handler.onPrepare(pine, ctx);
assert.equal(pine._maxSpikes, 6, 'max spikes includes one affected Food');
assert.equal(player._shields.length, 1, 'prepared Pine Protector registers one shield');
assert.equal(pine._damblockIncrease, 0);

handler.onPeerActivated(pine, food, { ...ctx, t: 2.5 });
assert.equal(pine._damblockIncrease, 1, 'food activation raises damage block by damblock2');
assert.equal(player.hp, 68, 'food activation heals with source heal parameter');

const shield = player._shields[0];
shield.beforeBlock({});
assert.equal(player.stacks.spikes, 1, 'beforeBlock grants one Spikes stack');
assert.equal(pine._spikesGiven, 1);
player._simT = 4.25;
shield.afterBlock({});
assert.equal(player.stamina, 4.7, 'afterBlock drains source stamina parameter');
assert.equal(events.at(-1)?.type, 'activate');
assert.equal(events.at(-1)?.t, 4.25, 'shield activation uses current combat time');

console.log('OK Pine Protector source and shield lifecycle regression');
