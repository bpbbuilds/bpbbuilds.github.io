import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { affectedTargets } from '../js/pages/sim/engine/board-graph.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MagicRing.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ring.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'magic_ring');

assert.ok(sourceItem, 'Magic Ring: extracted catalog row');
assert.match(source, /onready var numEffects: = int\(getP\("effects"\)\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*playerLowTriggered = false[\s\S]*oppoLowTriggered = false/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveStacksFromEffect/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveStacksFromEffect/);
assert.match(source, /func onDamaged\(_healthChange, event\):[\s\S]*relHealth < healthThreshold/);
assert.match(source, /func onOppoDamaged\(_healthChange, event\):[\s\S]*relHealth < opponentHealthThreshold/);
assert.match(source, /getScaledParam\(stackName, paramScale\)/);
assert.match(source, /Game\.EventType\.Lucky: Type\.Nature/);
assert.match(port, /ringEffectsFromPersistent\(configured, piece\.itemId\)/);
assert.match(port, /on\?\.\('character_damaged'/);
assert.match(port, /rel < getPName\(piece\.params, 'healtht', 50\) \/ 100/);
assert.match(port, /rel < getPName\(piece\.params, 'healtht_opp', 70\) \/ 100/);

function context(piece, rng = () => 0) {
  return {
    t: 0,
    player: createActor('player'),
    dummy: createActor('dummy'),
    events: [],
    rng,
    bus: createCombatBus(),
    pieces: [piece],
    itemsById: new Map([['magic_ring', sourceItem]]),
  };
}

const handler = getScriptHandler('magic_ring');
assert.equal(handler?.handlerId, 'magic_ring');

const configured = {
  itemId: 'magic_ring',
  placementKey: 'ring',
  name: 'Magic Ring',
  params: sourceItem.params,
  persistent: {
    effects: [
      { trigger: 0, stack: 'lucky' },
      { trigger: 1, stack: 'poison' },
    ],
  },
};
const configuredCtx = context(configured, () => 0.99);
handler.onPrepare(configured, configuredCtx);
assert.deepEqual(configured._dynamicTypes, ['nature'],
  'Magic Ring: rolled Lucky/Poison effects expose one deduplicated Nature runtime type');
handler.onCombatStart(configured, configuredCtx);
assert.equal(configuredCtx.player.stacks.lucky, 3,
  'Magic Ring: persistent start effect grants scaled Lucky');
handler.onCooldownEffect(configured, configuredCtx);
assert.equal(configuredCtx.dummy.stacks.poison, 3,
  'Magic Ring: persistent cooldown effect grants scaled Poison');
assert.equal(configuredCtx.events.filter((event) => event.type === 'activate').length, 2,
  'Magic Ring: each source giveStacks call activates once');

const encodedZero = {
  itemId: 'magic_ring',
  placementKey: 'encoded-zero',
  name: 'Magic Ring',
  params: sourceItem.params,
  persistent: { magicRing: 0 },
};
const encodedZeroCtx = context(encodedZero, () => 0.99);
handler.onPrepare(encodedZero, encodedZeroCtx);
assert.deepEqual(encodedZero._dynamicTypes, ['nature'],
  'Magic Ring: encoded effects expose their runtime item type');
handler.onCombatStart(encodedZero, encodedZeroCtx);
assert.equal(encodedZeroCtx.player.stacks.lucky, 6,
  'Magic Ring: encoded zero preserves two start Lucky effects');
assert.equal(encodedZeroCtx.events.filter((event) => event.type === 'activate').length, 2,
  'Magic Ring: encoded zero preserves both effects');

const empty = {
  itemId: 'magic_ring',
  placementKey: 'empty',
  name: 'Empty Magic Ring',
  params: { ...sourceItem.params, effects: 0 },
};
const emptyCtx = context(empty, () => 0);
handler.onPrepare(empty, emptyCtx);
handler.onCombatStart(empty, emptyCtx);
assert.equal(emptyCtx.player.stacks.lucky || 0, 0,
  'Magic Ring: zero source effects grant nothing');
assert.equal(emptyCtx.events.filter((event) => event.type === 'activate').length, 0,
  'Magic Ring: zero source effects do not invent an activation');

const low = {
  itemId: 'magic_ring',
  placementKey: 'low',
  name: 'Low Health Ring',
  params: { ...sourceItem.params, effects: 2, healtht: 50 },
  persistent: { effects: [
    { trigger: 2, stack: 'lucky' },
    { trigger: 1, stack: 'poison' },
  ] },
};
const lowCtx = context(low, () => 0.99);
handler.onPrepare(low, lowCtx);
lowCtx.player.hp = lowCtx.player.maxHp * 0.5;
lowCtx.bus.emit('character_damaged', { actor: lowCtx.player });
assert.equal(lowCtx.player.stacks.lucky || 0, 0,
  'Magic Ring: exact health threshold is not low');
lowCtx.player.hp -= 1;
lowCtx.bus.emit('character_damaged', { actor: lowCtx.player });
assert.equal(lowCtx.player.stacks.lucky, 5,
  'Magic Ring: below-threshold damage triggers once');
lowCtx.player.hp -= 1;
lowCtx.bus.emit('character_damaged', { actor: lowCtx.player });
assert.equal(lowCtx.player.stacks.lucky, 5,
  'Magic Ring: low-health trigger is one-shot per preparation');

const dynamicSource = { id: 'nature-source', type: 'Bag' };
const dynamicGraph = {
  pieces: new Map([
    ['source', { key: 'source', id: dynamicSource.id, cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
    ] }],
    ['encoded-zero', {
      key: 'encoded-zero',
      id: 'magic_ring',
      cells: ['1,0'],
      affectCells: [],
      _dynamicTypes: encodedZero._dynamicTypes,
    }],
  ]),
  filled: new Map([['0,0', 'source'], ['1,0', 'encoded-zero']]),
};
const dynamicLinks = affectedTargets(
  dynamicGraph,
  'source',
  new Map([
    [dynamicSource.id, dynamicSource],
    ['magic_ring', { ...sourceItem, id: 'magic_ring' }],
  ]),
  { rulesById: { [dynamicSource.id]: { primary: { op: 'hasType', type: 'Nature' } } } },
);
assert.equal(dynamicLinks.length, 1,
  'Magic Ring: runtime Nature type participates in board target checks');

console.log('Magic Ring source/parity smoke passed.');
