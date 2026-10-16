import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { gainStacks, loseStacks } from '../js/pages/sim/engine/stacks.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DraconicOrb.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.equal(inventory.byId.draconic_orb?.file, 'Exclusive/DraconicOrb.gd');
assert.equal(getScriptHandler('draconic_orb')?.handlerId, 'draconic_orb');
assert.match(source, /onready var heatThreshold: int = getP1\(\)/);
assert.match(source, /onready var spikeRemoval: int = getP3\(\)/);
assert.match(source, /onready var heatPerSpike: int = getP4\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*counter = 0[\s\S]*character_heat_changed/);
assert.match(source, /func onHeatChanged\(amount, event\):[\s\S]*if counter < heatThreshold:[\s\S]*counter \+= amount[\s\S]*giveCritTokens\(getP2\(\)\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*oppoSpikes > 0[\s\S]*loseSpikes\(spikeRemoval, self\)[\s\S]*giveHeat\(min\(oppoSpikes, spikeRemoval\) \* heatPerSpike, event\)[\s\S]*activate\(\)/);

function piece(overrides = {}) {
  const item = byId.get('draconic_orb');
  return {
    ...item,
    itemId: 'draconic_orb',
    placementKey: 'you:orb',
    name: item.name,
    params: { ...(item.params || {}) },
    side: 'you',
    alive: true,
    cooldown: item.cooldown,
    baseCooldown: item.cooldown,
    triggerTime: item.cooldown,
    ...overrides,
  };
}

function context(orb, params = orb.params) {
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = events;
  orb.params = params;
  return {
    player,
    dummy,
    pieces: [orb],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: null,
    events,
    bus,
    rng: () => 0,
    t: 5,
  };
}

{
  const orb = piece();
  const ctx = context(orb);
  const handler = getScriptHandler('draconic_orb');
  handler.onPrepare(orb, ctx);
  gainStacks(ctx.dummy, 'heat', 20);
  assert.equal(orb._orbHeat, 0, 'opponent Heat is ignored');
  gainStacks(ctx.player, 'heat', 10);
  loseStacks(ctx.player, 'heat', 2);
  assert.equal(orb._orbHeat, 10, 'negative Heat does not advance the source counter');
  gainStacks(ctx.player, 'heat', 5);
  assert.equal(orb._orbHeat, 15, 'direct Heat signal reaches the source listener');
  assert.equal(ctx.player.critStacks, 3, 'source P2 crit tokens granted once');
  gainStacks(ctx.player, 'heat', 10);
  assert.equal(ctx.player.critStacks, 3, 'threshold does not grant repeated tokens');
}

{
  const orb = piece();
  const ctx = context(orb);
  getScriptHandler('draconic_orb').onPrepare(orb, ctx);
  ctx.dummy.stacks.spikes = 5;
  getScriptHandler('draconic_orb').onCooldownEffect(orb, ctx);
  assert.equal(ctx.dummy.stacks.spikes, 4, 'source P3 removes one Spike');
  assert.equal(ctx.player.stacks.heat, 1, 'source P4 converts removed Spike to Heat');
  assert.equal(ctx.events.at(-1)?.type, 'activate', 'activation follows Spike removal and Heat');
}

{
  const orb = piece({ params: { p1: 2.9, crits: 0, p2: 0, p3: 0, p4: 0 } });
  const ctx = context(orb);
  getScriptHandler('draconic_orb').onPrepare(orb, ctx);
  gainStacks(ctx.player, 'heat', 2);
  assert.equal(ctx.player.critStacks, 0, 'zero source P2 remains zero');
  ctx.dummy.stacks.spikes = 5;
  getScriptHandler('draconic_orb').onCooldownEffect(orb, ctx);
  assert.equal(ctx.dummy.stacks.spikes, 5, 'zero source P3 removes no Spikes');
  assert.equal(ctx.player.stacks.heat, 2, 'zero source P4 grants no Heat');
}

console.log('OK Draconic Orb source port');
