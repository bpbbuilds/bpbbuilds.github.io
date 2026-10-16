import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/BroccoliGoobert.gd', 'utf8');
const base = fs.readFileSync('tools/game-extract-full/Items/Goobert.gd', 'utf8');

assert.match(source, /func\s+doCooldownEffect\(\):/);
assert.match(source, /if character\(\)\.getLucky\(\) >= luckNeeded:/);
assert.match(source, /giveRegeneration\(regen\)[\s\S]*?else:[\s\S]*?giveLucky\(luck\)/);
assert.match(base, /if activations == getP1\(\):[\s\S]*?doCooldownEffect\(\)[\s\S]*?activate\(\)/);

const handler = getScriptHandler('broccoli_goobert');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onPeerActivated, 'function');

const pieces = buildCombatPieces([{ id: 'broccoli_goobert', key: 'broccoli_goobert', x: 0, y: 0, r: 0 }], itemsById);
const broccoliGoobert = pieces.find((piece) => piece.itemId === 'broccoli_goobert');
assert.ok(broccoliGoobert, 'Broccoli Goobert fixture piece should build');
const ctx = {
  t: 3,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  pieces,
  itemsById,
  rng: () => 0,
};

handler.onPrepare(broccoliGoobert, ctx);
for (let i = 0; i < 6; i += 1) handler.onPeerActivated(broccoliGoobert, null, ctx);
const lowBranch = ctx.events.filter((event) => event.itemId === 'broccoli_goobert');
assert.equal(ctx.player.stacks.lucky, 3);
assert.equal(ctx.player.stacks.regeneration, 0);
assert.equal(lowBranch.at(-1)?.type, 'activate', 'Goobert should activate after granting Lucky');

ctx.events.length = 0;
ctx.player.stacks.lucky = 5;
for (let i = 0; i < 6; i += 1) handler.onPeerActivated(broccoliGoobert, null, ctx);
const highBranch = ctx.events.filter((event) => event.itemId === 'broccoli_goobert');
assert.equal(ctx.player.stacks.lucky, 5);
assert.equal(ctx.player.stacks.regeneration, 3);
assert.equal(highBranch.at(-1)?.type, 'activate', 'Goobert should activate after granting Regeneration');

console.log('Broccoli Goobert simulator parity smoke passed.');
