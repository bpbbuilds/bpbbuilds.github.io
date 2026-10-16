import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = { rulesById: rules.byId || null };
const handler = getScriptHandler('bismuth_cube');
assert.equal(typeof handler?.onPrepare, 'function', 'Bismuth Cube binds its source listener during preparation');

for (const side of ['you', 'them']) {
  const player = createActor(side === 'you' ? 'player' : 'dummy');
  const dummy = createActor(side === 'you' ? 'dummy' : 'player');
  const cubeKey = `${side}:bismuth_cube`;
  const targetKey = `${side}:axe`;
  const placements = [
    { id: 'bismuth_cube', key: cubeKey, x: 0, y: 0, r: 0 },
    { id: 'axe', key: targetKey, x: 0, y: -1, r: 0 },
  ];
  const graph = buildBoardGraph(placements, itemsById);
  const cube = {
    ...itemsById.get('bismuth_cube'),
    itemId: 'bismuth_cube',
    placementKey: cubeKey,
    side,
    name: 'Bismuth Cube',
    params: { buffs: 7, cdadvance: 0.2, max: 10, penalty: 80 },
    cooldown: 0,
  };
  const target = {
    ...itemsById.get('axe'),
    itemId: 'axe',
    placementKey: targetKey,
    side,
    name: 'Axe',
    cooldown: 5,
    triggerTime: 10,
    alive: true,
  };
  const events = [];
  const ctx = {
    t: 4,
    player,
    dummy,
    events,
    rng: () => 0.5,
    bus: createCombatBus(),
    graph,
    itemsById,
    canAffect,
    pieces: [cube, target],
  };

  handler.onPrepare(cube, ctx);
  assert.equal(cube._bisAcc, 0, `Bismuth Cube resets its buff accumulator during preparation on ${side}`);
  assert.equal(cube._bisUses, 0, `Bismuth Cube resets its use counter during preparation on ${side}`);
  assert.equal(cube._bisTarget?.itemId, 'axe', `Bismuth Cube caches the first affected cooldown item during preparation on ${side}`);

  grantStacks(player, 'lucky', 7);
  assert.equal(target.triggerTime, 10, `the strict source threshold does not proc at exactly seven buffs on ${side}`);
  grantStacks(player, 'lucky', 1);
  assert.equal(cube._bisUses, 1, `the eighth buff triggers one source Bismuth use on ${side}`);
  assert.equal(target.triggerTime, 9.8, `Bismuth Cube advances the first affected cooldown by source cdAdvance on ${side}`);
  assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'bismuth_cube'), `Bismuth Cube mini-activates after a proc on ${side}`);

  for (let i = 0; i < 9; i += 1) grantStacks(player, 'lucky', 8);
  assert.equal(cube._bisUses, 10, `Bismuth Cube stops at the source maximum uses on ${side}`);
  assert.ok(Math.abs(target.triggerTime - 8) < 1e-9, `each remaining source use advances the affected cooldown by 0.2 on ${side}`);
  const activations = events.filter((event) => event.type === 'activate' && event.itemId === 'bismuth_cube');
  assert.equal(activations.length, 10, `Bismuth Cube emits one mini-activation per source proc on ${side}`);
}

console.log('OK Bismuth Cube focused smoke');
