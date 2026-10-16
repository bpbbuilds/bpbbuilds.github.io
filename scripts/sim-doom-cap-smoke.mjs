import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor, healActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DoomCap.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.equal(inventory.byId.doom_cap?.file, 'Exclusive/DoomCap.gd');
assert.equal(getScriptHandler('doom_cap')?.handlerId, 'doom_cap');
assert.match(source, /^extends Food/m);
assert.match(source, /onready var poison: = int\(getP\("poison"\)\)/);
assert.match(source, /onready var healingDebuff = getP\("healreduction"\) \/ 100\.0/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*inflictPoison\(poison\)[\s\S]*reduceHealingEfficiency\(healingDebuff\)[\s\S]*activate\(\)/);

function piece(id, key, side, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: { ...(item?.params || {}) },
    side,
    alive: true,
    cooldown: item?.cooldown ?? 4,
    baseCooldown: item?.cooldown ?? 4,
    triggerTime: item?.cooldown ?? 4,
    damageMin: item?.damageMin || 0,
    damageMax: item?.damageMax || 0,
    kind: 'passive',
    ...overrides,
  };
}

function fakeGraph(sourcePiece, target) {
  return {
    pieces: new Map([
      [sourcePiece.placementKey, {
        key: sourcePiece.placementKey,
        id: sourcePiece.itemId,
        cells: [],
        affectCells: [{ cell: 'food-link', color: 'primary' }],
      }],
      [target.placementKey, { key: target.placementKey, id: target.itemId, cells: [], affectCells: [] }],
    ]),
    filled: new Map([['food-link', target.placementKey]]),
  };
}

function context(owner, dummy, doom, food, events = []) {
  const bus = createCombatBus();
  owner._combatBus = bus;
  dummy._combatBus = bus;
  owner._eventLog = events;
  dummy._eventLog = events;
  return {
    player: owner,
    dummy,
    pieces: [doom, food],
    graph: fakeGraph(doom, food),
    itemsById: byId,
    canAffect: null,
    events,
    bus,
    rng: () => 0,
    t: 5,
    activatePiece: () => true,
  };
}

{
  const owner = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const doom = piece('doom_cap', 'you:doom');
  const food = piece('banana', 'you:food', 'you');
  const events = [];
  const ctx = context(owner, dummy, doom, food, events);
  getScriptHandler('doom_cap').onPrepare(doom, ctx);
  assert.equal(doom.speedScale, 0.1, 'inherited Food.prepare linked-food speed');

  getScriptHandler('doom_cap').onCooldownEffect(doom, ctx);
  assert.equal(dummy.stacks.poison, 3, 'source poison parameter');
  assert.equal(dummy._healAmp, -0.1, 'source healing reduction');
  assert.equal(events.at(-1)?.type, 'activate', 'activation follows poison and stat effects');
  dummy.hp = 50;
  assert.equal(healActor(dummy, 10), 9, 'healing efficiency affects subsequent healing');
}

{
  const owner = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const doom = piece('doom_cap', 'you:fractional-doom', 'you', {
    params: { poison: 3.9, p1: 3.9, healreduction: 12.5, p2: 12.5 },
  });
  const food = piece('banana', 'you:fractional-food', 'you');
  const ctx = context(owner, dummy, doom, food);
  getScriptHandler('doom_cap').onCooldownEffect(doom, ctx);
  assert.equal(dummy.stacks.poison, 3, 'source int() truncates fractional poison');
  assert.equal(dummy._healAmp, -0.125, 'fractional healing reduction is preserved');
}

{
  const owner = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const doom = piece('doom_cap', 'you:zero-doom', 'you', {
    params: { poison: 0, p1: 0, healreduction: 0, p2: 0 },
  });
  const food = piece('banana', 'you:zero-food', 'you');
  const events = [];
  const ctx = context(owner, dummy, doom, food, events);
  getScriptHandler('doom_cap').onCooldownEffect(doom, ctx);
  assert.equal(dummy.stacks.poison, 0, 'zero poison remains zero');
  assert.equal(dummy._healAmp || 0, 0, 'zero healing reduction remains zero');
  assert.equal(events.at(-1)?.type, 'activate', 'zero-valued source effects still activate');
}

console.log('OK Doom Cap source port');
