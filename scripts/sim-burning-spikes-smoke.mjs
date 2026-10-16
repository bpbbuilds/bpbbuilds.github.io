import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/BurningSpikes.gd', 'utf8');
assert.match(source, /func onPrepare\(\)/);
assert.match(source, /character_spikes_changed/);
assert.match(source, /giveSpikes\(spikes\)/);
assert.match(source, /giveHeat\(heat\)/);
assert.match(source, /miniActivate\(\)/);

const handler = getScriptHandler('burning_spikes');
assert.equal(handler?.handlerId, 'burning_spikes');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCombatStart, 'function');

const player = createActor('player');
const dummy = createActor('dummy');
const piece = {
  itemId: 'burning_spikes',
  name: 'Burning Spikes',
  placementKey: 'spikes',
  side: 'you',
  kind: 'skill',
  params: { spikes: 5, p1: 5, heat: 3, p2: 3, spikest: 5, p3: 5, heat2: 2, p4: 2 },
  alive: true,
};
const target = {
  itemId: 'spiked_shield',
  name: 'Spiked Shield',
  placementKey: 'shield',
  side: 'you',
  kind: 'armor',
  alive: true,
};
const itemsById = new Map([
  ['burning_spikes', { id: 'burning_spikes', type: 'Skill' }],
  ['spiked_shield', { id: 'spiked_shield', type: 'Shield' }],
]);
const graph = {
  pieces: new Map([
    ['spikes', { id: 'burning_spikes', cells: ['0,0'], affectCells: [] }],
    ['shield', { id: 'spiked_shield', cells: ['1,0'], affectCells: [] }],
  ]),
  filled: new Map([['0,0', 'spikes'], ['1,0', 'shield']]),
};
const events = [];
const ctx = {
  player,
  dummy,
  pieces: [piece, target],
  graph,
  itemsById,
  canAffect: null,
  events,
  rng: () => 0,
  t: 1,
};

handler.onPrepare(piece, ctx);
handler.onCombatStart(piece, ctx);
assert.equal(player.stacks.spikes, 5);
assert.equal(player.stacks.heat, 3);
assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'burning_spikes'));

grantStacks(player, 'spikes', 5, { originKey: 'shield', originId: 'spiked_shield' });
assert.equal(player.stacks.heat, 5, 'linked Spikes gains convert at the source threshold');

console.log('OK Burning Spikes focused smoke');
