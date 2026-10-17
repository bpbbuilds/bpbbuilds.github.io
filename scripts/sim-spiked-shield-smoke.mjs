import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { takeDamage } from '../js/pages/sim/engine/damage.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const source = fs.readFileSync('tools/game-extract-full/Items/SpikedShield.gd', 'utf8');
const shieldSource = fs.readFileSync('tools/game-extract-full/Items/Shield.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-shields.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('const spikedShieldPort'),
  handlerSource.indexOf('const spikedWallPort'),
);
const sourceItem = catalog.find((item) => item.id === 'spiked_shield');

assert.ok(sourceItem, 'Spiked Shield: extracted catalog row');
assert.equal(inventory.byId.spiked_shield?.file, 'SpikedShield.gd');
assert.deepEqual(inventory.byId.spiked_shield?.overrides, ['onPrepare', 'afterBlock']);
assert.equal(sourceItem.cost, 8, 'Spiked Shield: catalog cost');
assert.equal(sourceItem.chance, 30, 'Spiked Shield: catalog chance');
assert.deepEqual(sourceItem.params, {
  damblock: 9,
  p1: 9,
  stamina: 0.3,
  p2: 0.3,
  spikes: 1,
  p3: 1,
  maxspikes: 5,
  p4: 5,
});
assert.match(source, /onready var spikes: = int\(getP\("spikes"\)\)/);
assert.match(source, /onready var maxSpikes: = int\(getP\("maxspikes"\)\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*spikesGiven = 0/);
assert.match(source, /func beforeBlock\(\):[\s\S]*\.beforeBlock\(\)[\s\S]*min\(spikesLeft, spikes\)[\s\S]*giveSpikes\(spikesToGive\)/);
assert.match(source, /func afterBlock\(\):[\s\S]*drainStamina\(getP2\(\), blockedDamageRes\.event\)[\s\S]*activate\(\)/);
assert.match(shieldSource, /func getDamageBlock\(\):[\s\S]*getP_m\("damblock"\)/);
assert.match(portBlock, /onPrepare\(piece\)/);
assert.match(portBlock, /onCombatStart\(piece, ctx(?:,|\))/);
assert.match(portBlock, /Math\.trunc/);
assert.match(portBlock, /allowZeroDamblock: true/);
assert.doesNotMatch(portBlock, /Math\.max\(spikes, /);
assert.doesNotMatch(portBlock, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'spikes'/);

function makeContext({ params = sourceItem.params } = {}) {
  const player = createActor('player', { maxHp: 200 });
  const dummy = createActor('dummy', { maxHp: 200 });
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  const events = [];
  player._eventLog = events;
  dummy._eventLog = events;
  const piece = {
    ...sourceItem,
    itemId: 'spiked_shield',
    placementKey: 'shield',
    name: 'Spiked Shield',
    params: { ...params },
    kind: 'shield',
    side: 'you',
    alive: true,
    chance: sourceItem.chance,
  };
  return {
    t: 2,
    player,
    dummy,
    bus,
    events,
    rng: () => 0,
    pieces: [piece],
    itemsById: new Map([['spiked_shield', sourceItem]]),
    graph: null,
    piece,
  };
}

function incomingHit(ctx, nowT = 4) {
  ctx.player._simT = nowT;
  return takeDamage(ctx.player, ctx.dummy, {
    amount: 10,
    originPiece: { itemId: 'dummy_attack', placementKey: 'dummy_attack' },
    accuracy: 100,
    canMiss: false,
    canCrit: false,
    isAttack: true,
    isMelee: true,
    skipSpikes: true,
    nowT,
    events: ctx.events,
    bus: ctx.bus,
    rng: ctx.rng,
  });
}

const handler = getScriptHandler('spiked_shield');
assert.equal(handler?.handlerId, 'spiked_shield');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCombatStart, 'function');

const combat = makeContext();
handler.onPrepare(combat.piece, combat);
assert.equal(combat.piece._spikesGiven, 0,
  'Spiked Shield: prepare resets the source spike counter');
handler.onCombatStart(combat.piece, combat);
assert.equal(combat.player._shields.length, 1,
  'Spiked Shield: combat start registers the inherited Shield hooks');
incomingHit(combat);
assert.equal(combat.player.stacks.spikes, 1,
  'Spiked Shield: a blocked hit grants source Spikes before damage resolves');
assert.equal(combat.player.hp, 199,
  'Spiked Shield: source damblock removes nine damage before the hit lands');
assert.ok(Math.abs(combat.player.stamina - 4.7) < 1e-9,
  'Spiked Shield: afterBlock drains the source stamina amount');
const activation = combat.events.find((event) => event.type === 'activate');
assert.equal(activation?.t, 4,
  'Spiked Shield: activation uses the live incoming-hit timestamp');

for (let i = 0; i < 5; i += 1) incomingHit(combat, 5 + i);
assert.equal(combat.player.stacks.spikes, 5,
  'Spiked Shield: source maxSpikes caps total granted Spikes');
incomingHit(combat, 12);
assert.equal(combat.player.stacks.spikes, 5,
  'Spiked Shield: hits after the cap grant no more Spikes');

const zero = makeContext({
  params: {
    damblock: 0,
    p1: 0,
    stamina: 0,
    p2: 0,
    spikes: 0,
    p3: 0,
    maxspikes: 0,
    p4: 0,
  },
});
handler.onPrepare(zero.piece, zero);
handler.onCombatStart(zero.piece, zero);
incomingHit(zero);
assert.equal(zero.player.hp, 190,
  'Spiked Shield: explicit zero damblock remains zero');
assert.equal(zero.player.stacks.spikes, 0,
  'Spiked Shield: explicit zero Spikes remains zero');
assert.equal(zero.player.stamina, 5,
  'Spiked Shield: explicit zero stamina drain remains zero');
assert.equal(zero.events.filter((event) => event.type === 'activate').length, 1,
  'Spiked Shield: zero values still follow the source afterBlock activation');

console.log('Spiked Shield source/parity smoke passed.');
