import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Goobert.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*return item\.canActivate\(\)/);
assert.match(source, /func prepare\(\):[\s\S]*activations = 0[\s\S]*for item in getAffectedItems\(\):[\s\S]*connectForCombat\(item, "activated", "onItemActivated"\)/);
assert.match(source, /func onItemActivated\(event\):[\s\S]*activations \+= 1[\s\S]*if activations == getP1\(\):[\s\S]*doCooldownEffect\(\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.goobert?.file, 'Goobert.gd');
assert.equal(getScriptHandler('goobert')?.handlerId, 'goobert');

function piece(overrides = {}) {
  const item = byId.get('goobert');
  return {
    ...item,
    itemId: 'goobert',
    placementKey: 'you:goobert',
    name: item.name,
    params: item.params,
    side: 'you',
    alive: true,
    kind: 'pet',
    ...overrides,
  };
}

function context(owner) {
  const foe = createActor('dummy', { maxHp: 200 });
  const bus = createCombatBus();
  owner._combatBus = bus;
  foe._combatBus = bus;
  return {
    player: owner,
    dummy: foe,
    events: [],
    itemsById: byId,
    pieces: [],
    graph: { pieces: new Map(), filled: new Map() },
    canAffect: { rulesById: {} },
    bus,
    t: 5,
  };
}

const handler = getScriptHandler('goobert');
const activated = { itemId: 'wooden_sword', placementKey: 'you:sword', name: 'Wooden Sword' };

{
  const owner = createActor('player', { maxHp: 200 });
  owner.hp = 100;
  const goobert = piece({ params: { p1: 5, heal: 9, p2: 9 }, paramMult: { heal: 2 } });
  const ctx = context(owner);
  handler.onPrepare(goobert, ctx);
  for (let i = 0; i < 4; i += 1) handler.onPeerActivated(goobert, activated, ctx);
  assert.equal(owner.hp, 100, 'Goobert waits for the exact fifth activation');
  handler.onPeerActivated(goobert, activated, ctx);
  assert.equal(owner.hp, 118, 'Goobert uses the source modified heal parameter on its threshold activation');
  const healEvent = ctx.events.find((event) => event.type === 'heal');
  assert.equal(healEvent?.amount, 18, 'Goobert logs the source heal amount after healing efficiency');
  assert.equal(healEvent?.meta?.handler, 'goobert', 'Goobert heal event keeps its handler identity');
  assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 1, 'Goobert activates once at the threshold');
}

{
  const owner = createActor('player', { maxHp: 200 });
  const goobert = piece({ params: { p1: 5, heal: 9, p2: 9 } });
  const ctx = context(owner);
  handler.onPrepare(goobert, ctx);
  for (let i = 0; i < 5; i += 1) handler.onPeerActivated(goobert, activated, ctx);
  assert.equal(owner.hp, owner.maxHp, 'Goobert does not exceed max health');
  assert.equal(ctx.events.at(-1)?.type, 'activate', 'Goobert activates after a full-health heal attempt');
  assert.equal(ctx.events.find((event) => event.type === 'heal')?.amount, 9, 'Goobert preserves the game heal log at full health');
}

{
  const owner = createActor('player', { maxHp: 200 });
  owner.hp = 100;
  const zero = piece({ params: { p1: 0, heal: 0, p2: 0 } });
  const ctx = context(owner);
  handler.onPrepare(zero, ctx);
  handler.onPeerActivated(zero, activated, ctx);
  assert.equal(owner.hp, 100, 'Goobert honors an explicit zero activation threshold');
  assert.equal(ctx.events.length, 0, 'Goobert emits no effect for the source zero threshold');
}

console.log('OK Goobert source-backed canActivate peer targeting, exact activation count, modified/full-health healing, and zero parameters');
