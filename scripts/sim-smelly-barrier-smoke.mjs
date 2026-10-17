import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { notifyPeerActivations } from '../js/pages/sim/engine/combat-activate.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SmellyBarrier.gd', 'utf8');
const handler = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-skills.js', 'utf8');
const row = inventory.byId.smelly_barrier;
const portBlock = handler.slice(
  handler.indexOf('const smellyBarrierPort'),
  handler.indexOf('void giveRandomBuffs', handler.indexOf('const smellyBarrierPort') + 1),
);

assert.equal(row?.file, 'Exclusive/SmellyBarrier.gd', 'Smelly Barrier extracted source path');
assert.deepEqual(row?.overrides, ['onPrepare'], 'Smelly Barrier inventory override');
assert.match(source, /func canAffect\(item\):[\s\S]*isA\(garlicDescriptor\)[\s\S]*item\.canBlock\(\)/);
assert.match(source, /func onBought\(\):[\s\S]*boostedGarlic = 3/);
assert.match(source, /func getData\(\):[\s\S]*return boostedGarlic/);
assert.match(source, /func setData\(data\):[\s\S]*boostedGarlic = data/);
assert.match(source, /func onPrepare\(\):[\s\S]*blockAcc = 0[\s\S]*addBonusBlock\(garlicBlockBonus\)[\s\S]*gave_block/);
assert.match(source, /func onItemGaveBlock\(amount, event\):[\s\S]*blockAcc \+= amount[\s\S]*blockAcc %= blockForPoison[\s\S]*inflictPoison\(poison \* poisonForBlock, event\)[\s\S]*activate\(\)/);
assert.match(portBlock, /onPrepare\(piece, ctx\)/);
assert.match(portBlock, /originKey/);
assert.match(portBlock, /modifiedParamValue/);
assert.match(portBlock, /piece\._blk \/ need/);
assert.doesNotMatch(portBlock, /Math\.floor\(/);
assert.match(portBlock, /pushActivate/);
assert.doesNotMatch(portBlock, /onCombatStart\(piece, ctx\)/);

const smelly = {
  itemId: 'smelly_barrier',
  placementKey: 'smelly',
  name: 'Smelly Barrier',
  side: 'you',
  params: { blockbonus: 5, p1: 5, blockt: 13, p2: 13, poison: 1, p3: 1 },
};
const garlic = { itemId: 'garlic', placementKey: 'garlic', name: 'Garlic', side: 'you', blockGrant: 0 };
const blocker = { itemId: 'wooden_buckler', placementKey: 'blocker', name: 'Wooden Buckler', side: 'you' };
const unrelated = { itemId: 'wooden_buckler', placementKey: 'unrelated', name: 'Wooden Buckler', side: 'you' };
const graph = {
  pieces: new Map([
    ['smelly', { key: 'smelly', id: 'smelly_barrier', cells: [], affectCells: [
      { cell: 'garlic-link', color: 'primary' },
      { cell: 'blocker-link', color: 'primary' },
    ] }],
    ['garlic', { key: 'garlic', id: 'garlic', cells: [], affectCells: [] }],
    ['blocker', { key: 'blocker', id: 'wooden_buckler', cells: [], affectCells: [] }],
    ['unrelated', { key: 'unrelated', id: 'wooden_buckler', cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['garlic-link', 'garlic'],
    ['blocker-link', 'blocker'],
  ]),
};
const itemsById = new Map([
  ['smelly_barrier', { id: 'smelly_barrier' }],
  ['garlic', { id: 'garlic' }],
  ['wooden_buckler', { id: 'wooden_buckler' }],
  ['goobert', { id: 'goobert' }],
]);
const goobert = {
  itemId: 'goobert',
  placementKey: 'goobert',
  name: 'Goobert',
  side: 'you',
  params: { p1: 1, p2: 10 },
  alive: true,
};
graph.pieces.set('goobert', {
  key: 'goobert',
  id: 'goobert',
  cells: ['goobert-cell'],
  affectCells: [{ cell: 'smelly-cell', color: 'primary' }],
});
graph.filled.set('smelly-cell', 'smelly');
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
let peerNotifications = 0;
const runtime = getScriptHandler('smelly_barrier');
assert.equal(runtime?.handlerId, 'smelly_barrier', 'Smelly Barrier runtime handler');
const ctx = {
  player,
  dummy,
  pieces: [smelly, garlic, blocker, unrelated, goobert],
  graph,
  itemsById,
  events,
  t: 3,
  notifyPeerActivations(piece, activationCtx) {
    peerNotifications += 1;
    notifyPeerActivations(piece, activationCtx);
  },
};
runtime.onPrepare(smelly, ctx);
assert.equal(garlic.blockGrant, 5, 'Smelly Barrier adds source Garlic block bonus');

grantStacks(player, 'block', 20, { originKey: 'blocker', originId: 'wooden_buckler' });
assert.equal(dummy.stacks.poison, 2, 'Smelly Barrier rounds fractional threshold poison at the target');
assert.equal(smelly._blk, 7, 'Smelly Barrier preserves threshold remainder');
assert.equal(events.at(-1)?.type, 'activate', 'Smelly Barrier activates after poison');
assert.equal(peerNotifications, 1, 'Smelly Barrier activation notifies linked activation listeners');
assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'goobert'),
  'Smelly Barrier activation procs linked Goobert');

grantStacks(player, 'block', 6, { originKey: 'unrelated', originId: 'wooden_buckler' });
assert.equal(dummy.stacks.poison, 2, 'unlinked blocker does not feed Smelly Barrier');
grantStacks(player, 'block', 6, { originKey: 'blocker', originId: 'wooden_buckler' });
assert.equal(dummy.stacks.poison, 3, 'linked blocker carry-over reaches the next threshold');
assert.equal(smelly._blk, 0, 'threshold remainder resets exactly');
assert.equal(events.filter((event) => event.type === 'activate' && event.itemId === 'smelly_barrier').length, 2,
  'Smelly Barrier activates once per crossed threshold');
assert.equal(peerNotifications, 2, 'each Smelly Barrier activation notifies listeners once');
assert.equal(events.filter((event) => event.type === 'activate' && event.itemId === 'goobert').length, 2,
  'each Smelly Barrier activation procs Goobert once');

console.log('OK Smelly Barrier source, inventory, linked blocker filtering, Garlic bonus, threshold carry-over, poison, and activation regression');
