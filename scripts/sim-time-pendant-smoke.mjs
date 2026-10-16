import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/TimePendant.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-accessories.js', 'utf8');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));

assert.equal(inventory.byId.time_pendant?.file, 'Exclusive/TimePendant.gd');
assert.deepEqual(inventory.byId.time_pendant?.overrides, ['doCooldownEffect']);
assert.match(source, /onready var cdAdvance: = getP\("cdadvance"\)/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasCooldown\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getFirstAffectedItem\(\)[\s\S]*isCooldownActive\(\)[\s\S]*advanceCooldownSeconds\(cdAdvance\)[\s\S]*activate\(\)/);
assert.match(portSource, /handlerId: 'time_pendant'/);
assert.match(portSource, /affectedTargets\(/);
assert.match(portSource, /advanceCooldownSeconds\(/);
assert.match(portSource, /miniActivate: true/);

const handler = getScriptHandler('time_pendant');
assert.equal(handler?.handlerId, 'time_pendant');

const pendant = {
  ...byId.get('time_pendant'),
  itemId: 'time_pendant',
  placementKey: 'pendant',
  name: 'Time Pendant',
  kind: 'accessory',
  params: { p1: 0.75 },
  side: 'them',
};
const targetA = {
  ...byId.get('hammer'),
  itemId: 'hammer',
  placementKey: 'target-a',
  name: 'Target A',
  kind: 'weapon',
  side: 'them',
  alive: true,
  cooldown: 3,
  baseCooldown: 3,
  triggerTime: 3,
};
const targetB = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'target-b',
  name: 'Target B',
  kind: 'weapon',
  side: 'them',
  alive: true,
  cooldown: 5,
  baseCooldown: 5,
  triggerTime: 5,
};
const itemsById = new Map([
  ['time_pendant', pendant],
  ['hammer', targetA],
  ['wooden_sword', targetB],
]);
const graph = {
  pieces: new Map([
    ['pendant', { id: 'time_pendant', affectCells: [{ cell: 'b-cell', color: 'primary' }, { cell: 'a-cell', color: 'primary' }] }],
    ['target-a', { id: 'hammer', affectCells: [] }],
    ['target-b', { id: 'wooden_sword', affectCells: [] }],
  ]),
  filled: new Map([['b-cell', 'target-b'], ['a-cell', 'target-a']]),
};
const events = [];
const ctx = {
  t: 4,
  player: createActor('dummy'),
  dummy: createActor('player'),
  pieces: [pendant, targetA, targetB],
  graph,
  itemsById,
  canAffect: { rulesById: rules.byId },
  events,
};
assert.equal(handler.onCooldownEffect(pendant, ctx), true, 'Time Pendant returns a handled cooldown activation');
assert.equal(targetA.triggerTime, 3, 'Time Pendant does not skip the source first affected item for array order');
assert.equal(targetB.triggerTime, 4.25, 'Time Pendant advances the first affected star target by p1');
assert.equal(events.at(-1)?.actor, 'dummy', 'opponent-side Time Pendant logs on the opponent side');
assert.equal(events.at(-1)?.meta?.targetKey, 'target-b', 'Time Pendant records the source first affected target');
assert.equal(events.at(-1)?.meta?.miniActivate, true, 'Time Pendant projects the source visual mini activation');

const inactiveFirst = { ...targetB, placementKey: 'inactive-first', triggerTime: 5, alive: false };
const activeSecond = { ...targetA, placementKey: 'active-second', triggerTime: 3, alive: true };
const inactiveCtx = {
  ...ctx,
  pieces: [pendant, inactiveFirst, activeSecond],
  graph: {
    pieces: new Map([
      ['pendant', { id: 'time_pendant', affectCells: [{ cell: 'inactive-cell', color: 'primary' }, { cell: 'active-cell', color: 'primary' }] }],
      ['inactive-first', { id: 'wooden_sword', affectCells: [] }],
      ['active-second', { id: 'hammer', affectCells: [] }],
    ]),
    filled: new Map([['inactive-cell', 'inactive-first'], ['active-cell', 'active-second']]),
  },
  events: [],
};
handler.onCooldownEffect(pendant, inactiveCtx);
assert.equal(activeSecond.triggerTime, 3, 'an inactive first target prevents searching later affected items');
assert.equal(inactiveCtx.events.length, 0, 'inactive first target produces no advance event');

const zero = { ...pendant, params: { p1: 0 }, placementKey: 'zero-pendant' };
const zeroEvents = [];
const zeroCtx = { ...ctx, events: zeroEvents };
assert.equal(handler.onCooldownEffect(zero, zeroCtx), true, 'zero advance remains a source activation');
assert.equal(zeroEvents.length, 0, 'zero advance does not emit a phantom cooldown event');

console.log('OK Time Pendant source, first affected-star order, inactive-first gate, p1 advance, opponent actor mapping, mini activation, and zero-safe regression');
