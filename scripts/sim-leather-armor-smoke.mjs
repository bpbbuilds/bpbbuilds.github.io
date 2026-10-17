import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/LeatherArmor.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const data = byId.get('leather_armor');

assert.equal(inventory.byId.leather_armor?.file, 'LeatherArmor.gd');
assert.match(source, /func onPreCombatStart\(\):[\s\S]*changeDebuffResistStacks\(getP1\(\)\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveBlock\(\)[\s\S]*activate\(\)/);
assert.equal(getScriptHandler('leather_armor')?.handlerId, 'leather_armor');

const piece = {
  ...data,
  itemId: 'leather_armor',
  placementKey: 'leather-armor',
  name: 'Leather Armor',
  kind: 'armor',
  side: 'you',
  alive: true,
  blockGrant: data.block,
  params: { ...data.params },
};
const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
const events = [];
player._combatBus = bus;
dummy._combatBus = bus;
player._eventLog = events;
dummy._eventLog = [];
const ctx = {
  player,
  dummy,
  bus,
  events,
  t: 5,
  pieces: [piece],
  graph: { pieces: new Map(), filled: new Map() },
  itemsById: byId,
};
const handler = getScriptHandler('leather_armor');

handler.onPreCombatStart(piece, ctx);
assert.equal(player.debuffResistStacks, 3, 'Leather Armor applies source p1 Debuff Resist before combat');
assert.equal(player.block ?? 0, 0, 'Leather Armor does not grant Block during pre-combat setup');

handler.onCombatStart(piece, ctx);
assert.equal(player.block, 45, 'Leather Armor grants the catalog Block amount at combat start');
const blockIndex = events.findIndex((event) => event.type === 'buff' && event.meta?.stack === 'block');
const activationIndex = events.findIndex((event) => event.type === 'activate' && event.itemId === 'leather_armor');
assert.ok(blockIndex >= 0, 'Leather Armor records its Block grant');
assert.ok(activationIndex > blockIndex, 'Leather Armor activates after granting Block');

const zero = {
  ...piece,
  placementKey: 'zero-leather-armor',
  params: { resist: 0, p1: 0 },
};
const zeroCtx = {
  ...ctx,
  player: createActor('player'),
  events: [],
  pieces: [zero],
};
zeroCtx.player._combatBus = bus;
zeroCtx.player._eventLog = zeroCtx.events;
handler.onPreCombatStart(zero, zeroCtx);
assert.equal(zeroCtx.player.debuffResistStacks ?? 0, 0, 'Leather Armor honors explicit zero Debuff Resist');

console.log('OK Leather Armor source-backed pre-combat resistance timing, exact catalog Block, activation ordering, and zero resistance');
