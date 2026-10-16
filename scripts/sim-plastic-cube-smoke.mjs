import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const cubeBase = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Cube.gd', 'utf8');
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/PlasticCube.gd', 'utf8');
const game = fs.readFileSync('tools/game-extract-full/Core/Game.gd', 'utf8');

assert.equal(inventory.byId.plastic_cube?.file, 'Exclusive/PlasticCube.gd');
assert.match(source, /extends Cube/);
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasCooldown\(\)/);
assert.match(source, /deactivateCooldown\(\)[\s\S]*advanceCooldownPercent\(cdAdvance\)[\s\S]*giveSpikes\(spikes\)[\s\S]*onAfterEffectFinished\(\)/);
assert.match(cubeBase, /onready var cdAdvance: = getP\("cdadvance"\)/);
assert.match(cubeBase, /penaltyFactor: = 1\.0 - getP\("penalty"\) \/ 100\.0/);
assert.match(game, /var cubeAdvanced: Dictionary/);

const item = (id, placementKey, overrides = {}) => ({
  ...byId.get(id),
  itemId: id,
  placementKey,
  name: byId.get(id)?.name || id,
  params: byId.get(id)?.params || {},
  alive: true,
  kind: id === 'plastic_cube' ? 'gadget' : 'weapon',
  cooldown: byId.get(id)?.cooldown ?? 8,
  baseCooldown: byId.get(id)?.cooldown ?? 8,
  triggerTime: 7,
  _iterationCd: 8,
  ...overrides,
});

const cubeOne = item('plastic_cube', 'cube-one');
const cubeTwo = item('plastic_cube', 'cube-two');
const target = item('wooden_sword', 'target', {
  cooldown: 8,
  baseCooldown: 8,
  triggerTime: 8.5,
  _iterationCd: 8,
});
const unrelated = item('wooden_sword', 'unrelated', {
  cooldown: 8,
  baseCooldown: 8,
  triggerTime: 7,
  _iterationCd: 8,
});
const graph = {
  pieces: new Map([
    ['cube-one', { key: 'cube-one', id: 'plastic_cube', cells: [], affectCells: [
      { cell: 'target-link', color: 'primary' },
    ] }],
    ['cube-two', { key: 'cube-two', id: 'plastic_cube', cells: [], affectCells: [
      { cell: 'target-link', color: 'primary' },
    ] }],
    ['target', { key: 'target', id: 'wooden_sword', cells: [], affectCells: [] }],
    ['unrelated', { key: 'unrelated', id: 'wooden_sword', cells: [], affectCells: [] }],
  ]),
  filled: new Map([['target-link', 'target']]),
};
const player = createActor('player', { maxHp: 100 });
const events = [];
const activations = [];
const ctx = {
  player,
  dummy: createActor('dummy', { maxHp: 100 }),
  pieces: [cubeOne, cubeTwo, target, unrelated],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  t: 5,
  rng: () => 0.5,
  activatePiece: (piece) => {
    activations.push(piece.placementKey);
    return true;
  },
};
const handler = getScriptHandler('plastic_cube');

assert.equal(handler?.handlerId, 'plastic_cube');
handler.onCooldownEffect(cubeOne, ctx);
assert.equal(target.triggerTime, 2.5, 'first cube advances 75% of target iteration cooldown');
assert.equal(player.stacks.spikes, 10, 'first cube grants catalog Spikes');
assert.equal(cubeOne.alive, false, 'first cube is consumed after its effects');
assert.equal(events.at(-1)?.type, 'activate', 'cube activation follows target and Spikes effects');

cubeTwo.triggerTime = 7;
handler.onCooldownEffect(cubeTwo, ctx);
assert.ok(Math.abs(target.triggerTime - 1.3) < 1e-9, 'second cube applies penalty to the same target');
assert.equal(player.stacks.spikes, 20);
assert.equal(cubeTwo.alive, false);
assert.deepEqual(activations, [], 'test target stays below activation threshold until second advance');

console.log('OK Plastic Cube source and cooldown lifecycle regression');
