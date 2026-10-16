import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const canAffect = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Broccoli.gd', 'utf8');

assert.match(source, /func\s+doCooldownEffect\(\):/);
assert.match(source, /if character\(\)\.getLucky\(\) >= luckNeeded:/);
assert.match(source, /giveRegeneration\(regen\)[\s\S]*?else:[\s\S]*?giveLucky\(luck\)[\s\S]*?activate\(\)/);

const handler = getScriptHandler('broccoli');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const placements = [
  { id: 'broccoli', key: 'broccoli', x: 0, y: 0, r: 0 },
  { id: 'banana', key: 'food', x: 0, y: -1, r: 0 },
];
const graph = buildBoardGraph(placements, itemsById);
const pieces = buildCombatPieces(placements, itemsById);
const broccoli = pieces.find((piece) => piece.itemId === 'broccoli');
assert.ok(broccoli, 'Broccoli fixture piece should build');
const ctx = {
  t: 2,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  graph,
  itemsById,
  canAffect,
  pieces,
  rng: () => 0,
};

handler.onPrepare(broccoli, ctx);
assert.equal(broccoli.speedScale, 0.1, 'Broccoli should inherit Food linked-food speed');
handler.onCooldownEffect(broccoli, ctx);
const lowBranch = ctx.events.filter((event) => event.itemId === 'broccoli');
assert.equal(ctx.player.stacks.lucky, 2);
assert.equal(ctx.player.stacks.regeneration, 0);
assert.equal(lowBranch.at(-1)?.type, 'activate', 'Broccoli should activate after granting Lucky');

ctx.events.length = 0;
ctx.player.stacks.lucky = 5;
handler.onCooldownEffect(broccoli, ctx);
const highBranch = ctx.events.filter((event) => event.itemId === 'broccoli');
assert.equal(ctx.player.stacks.lucky, 5);
assert.equal(ctx.player.stacks.regeneration, 2);
assert.equal(highBranch.at(-1)?.type, 'activate', 'Broccoli should activate after granting Regeneration');

console.log('Broccoli simulator parity smoke passed.');
