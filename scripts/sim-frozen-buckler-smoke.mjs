import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/FrozenBuckler.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onPrepare\(\):[\s\S]*coldInflicted = 0/);
assert.match(source, /func afterBlock\(\):[\s\S]*drainStamina\(getP2\(\), blockedDamageRes\.event\)[\s\S]*if coldInflicted < getP4\(\)[\s\S]*coldInflicted \+= 1[\s\S]*inflictCold\(getP3\(\), blockedDamageRes\.event\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.frozen_buckler?.file, 'Exclusive/FrozenBuckler.gd');
assert.equal(getScriptHandler('frozen_buckler')?.handlerId, 'frozen_buckler');

function piece(overrides = {}) {
  const item = byId.get('frozen_buckler');
  return {
    ...item,
    itemId: 'frozen_buckler',
    placementKey: 'you:frozen-buckler',
    name: item.name,
    params: item.params,
    side: 'you',
    alive: true,
    kind: 'armor',
    ...overrides,
  };
}

function context(owner, foe) {
  const bus = createCombatBus();
  owner._combatBus = bus;
  foe._combatBus = bus;
  return {
    player: owner,
    dummy: foe,
    pieces: [],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: { rulesById: null },
    events: [],
    bus,
    rng: () => 0,
    t: 5,
  };
}

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  const buckler = piece({
    placementKey: `${side}:frozen-buckler`,
    side,
    params: { damblock: 12, p1: 12, stamina: 0.9, p2: 0.9, p3: 2, p4: 2 },
  });
  const ctx = context(owner, foe);
  const handler = getScriptHandler('frozen_buckler');

  buckler._coldN = 99;
  handler.onPrepare(buckler, ctx);
  assert.equal(buckler._coldN, 0, `Frozen Buckler resets its cold counter during preparation on ${side}`);
  handler.onCombatStart(buckler, ctx);
  owner.stamina = 5;

  const shield = owner._shields?.[0];
  assert.ok(shield, `Frozen Buckler registers its shield after combat start on ${side}`);
  shield.afterBlock({});
  shield.afterBlock({});
  shield.afterBlock({});
  assert.equal(owner.stacks.cold || 0, 0, `Frozen Buckler does not chill its owner on ${side}`);
  assert.equal(foe.stacks.cold, 4, `Frozen Buckler inflicts P3 Cold only through its P4 block cap on ${side}`);
  assert.equal(owner.stamina, 2.3, `Frozen Buckler drains the exact P2 stamina per block on ${side}`);
  assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 3, `Frozen Buckler activates once per blocked hit on ${side}`);

  const zero = piece({
    placementKey: `${side}:frozen-buckler-zero`,
    side,
    params: { damblock: 0, p1: 0, stamina: 0, p2: 0, p3: 0, p4: 0 },
  });
  const zeroCtx = context(owner, foe);
  handler.onPrepare(zero, zeroCtx);
  handler.onCombatStart(zero, zeroCtx);
  const coldBefore = foe.stacks.cold || 0;
  owner.stamina = 1;
  owner._shields.at(-1).afterBlock({});
  assert.equal(foe.stacks.cold || 0, coldBefore, `Frozen Buckler zero parameters do not invent Cold on ${side}`);
  assert.equal(owner.stamina, 1, `Frozen Buckler zero stamina parameter does not drain on ${side}`);
}

console.log('OK Frozen Buckler source-backed preparation reset, exact block Cold cap, stamina drain, activation, both sides, and zero parameters');
