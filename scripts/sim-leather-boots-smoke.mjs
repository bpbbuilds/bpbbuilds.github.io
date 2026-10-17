import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { PRIORITY } from '../js/pages/sim/engine/combat-start-priority.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/LeatherBoots.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const data = byId.get('leather_boots');

assert.equal(inventory.byId.leather_boots?.file, 'LeatherBoots.gd');
assert.match(source, /onready var healthThreshold:[\s\S]*getP1\(\) \/ 100\.0 - 0\.0001/);
assert.match(source, /func onPrepare\(\):[\s\S]*hasActivated = false[\s\S]*character_damaged[\s\S]*onDamaged/);
assert.match(source, /func onDamaged\(_damage, event\):[\s\S]*getRelativeHealth\(\)[\s\S]*giveLucky\(getP2\(\), event\)[\s\S]*giveEmpower\(getP3\(\), event\)[\s\S]*giveBlock\(getBlock\(\), true, event\)[\s\S]*consume\(\)/);
assert.match(source, /func getTriggerPriority\(\) -> int:[\s\S]*Priority\.High \+ 2/);
assert.equal(getScriptHandler('leather_boots')?.handlerId, 'leather_boots');

function makeContext(params = data.params, blockGrant = data.block) {
  const piece = {
    ...data,
    itemId: 'leather_boots',
    placementKey: 'leather-boots',
    name: 'Leather Boots',
    kind: 'shoes',
    side: 'you',
    alive: true,
    blockGrant,
    params: { ...params },
  };
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = [];
  return {
    piece,
    player,
    dummy,
    bus,
    events,
    t: 2,
    rng: () => 0,
    pieces: [piece],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
  };
}

const ctx = makeContext();
let normalListenerSawAlive = null;
ctx.bus.on('character_damaged', () => {
  normalListenerSawAlive = ctx.piece.alive;
});
getScriptHandler('leather_boots').onPrepare(ctx.piece, ctx);
ctx.player.hp = 69.99;
ctx.bus.emit('character_damaged', { actor: ctx.player, t: 1, hit: true });
assert.equal(normalListenerSawAlive, true, 'Leather Boots uses a strict below-threshold trigger');
assert.equal(ctx.piece.alive, true);

ctx.player.hp = 69.98;
ctx.bus.emit('character_damaged', { actor: ctx.player, t: 2, hit: true });
assert.equal(normalListenerSawAlive, false, 'Leather Boots High+2 trigger priority runs before normal damage listeners');
assert.equal(ctx.player.stacks.lucky, 1);
assert.equal(ctx.player.stacks.empower, 1);
assert.equal(ctx.player.block, 15, 'Leather Boots grants its exact catalog Block');
assert.equal(ctx.piece.alive, false, 'Leather Boots consumes after the first qualifying damage');

ctx.player.hp = 10;
ctx.bus.emit('character_damaged', { actor: ctx.player, t: 3, hit: true });
assert.equal(ctx.player.stacks.lucky, 1, 'Leather Boots cannot trigger twice after consumption');

const zero = makeContext({ p1: 70, p2: 0, p3: 0 }, 0);
getScriptHandler('leather_boots').onPrepare(zero.piece, zero);
zero.player.hp = 1;
zero.bus.emit('character_damaged', { actor: zero.player, t: 2, hit: true });
assert.equal(zero.player.stacks.lucky, 0, 'Leather Boots honors explicit zero Lucky');
assert.equal(zero.player.stacks.empower, 0, 'Leather Boots honors explicit zero Empower');
assert.equal(zero.player.block, 0, 'Leather Boots honors explicit zero Block');
assert.equal(zero.piece.alive, false, 'Leather Boots still consumes when the source trigger succeeds');

assert.equal(PRIORITY.High + 2, 1002);
console.log('OK Leather Boots source-backed strict low-health threshold, High+2 damage priority, exact Lucky/Empower/Block grants, one-shot consumption, and zero parameters');
