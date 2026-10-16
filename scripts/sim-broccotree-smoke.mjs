import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const canAffect = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Broccotree.gd', 'utf8');

assert.match(source, /extends Food/);
assert.match(source, /staminaPerRegen = getP\("stamina"\) \* baseStaminaRegen \/ 100\.0/);
assert.match(
  source,
  /giveLucky\(luck\)[\s\S]*?if character\(\)\.getLucky\(\) >= luckNeeded:[\s\S]*?giveRegeneration\(regen\)[\s\S]*?activate\(\)/,
);

const handler = getScriptHandler('broccotree');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const placements = [{ id: 'broccotree', key: 'broccotree', x: 0, y: 0, r: 0 }];
const graph = buildBoardGraph(placements, itemsById);
const pieces = buildCombatPieces(placements, itemsById);
const tree = pieces.find((piece) => piece.itemId === 'broccotree');
assert.ok(tree, 'Broccotree fixture piece should build');

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

handler.onPrepare(tree, ctx);
assert.equal(tree.speedScale, 0, 'Broccotree overrides Food preparation speed');
grantStacks(ctx.player, 'regeneration', 3, { rng: () => 0 });
assert.equal(ctx.player.staminaRegen, 1.03, 'Regeneration grants source stamina regeneration');

ctx.events.length = 0;
handler.onCooldownEffect(tree, ctx);
const lowEvents = ctx.events.filter((event) => event.itemId === 'broccotree');
const lowLucky = lowEvents.findIndex((event) => event.meta?.stack === 'lucky');
const lowActivate = lowEvents.findIndex((event) => event.type === 'activate');
assert.equal(ctx.player.stacks.lucky, 3);
assert.equal(ctx.player.stacks.regeneration, 3);
assert.ok(lowLucky >= 0 && lowActivate > lowLucky, 'Broccotree activates after its Lucky grant');

ctx.events.length = 0;
ctx.player.stacks.lucky = 4;
ctx.player.stacks.regeneration = 0;
handler.onCooldownEffect(tree, ctx);
const highEvents = ctx.events.filter((event) => event.itemId === 'broccotree');
const highRegen = highEvents.findIndex((event) => event.meta?.stack === 'regeneration');
const highActivate = highEvents.findIndex((event) => event.type === 'activate');
assert.equal(ctx.player.stacks.lucky, 7);
assert.equal(ctx.player.stacks.regeneration, 3);
assert.ok(highRegen >= 0 && highActivate > highRegen, 'Broccotree activates after Regeneration');

console.log('Broccotree simulator parity smoke passed.');
