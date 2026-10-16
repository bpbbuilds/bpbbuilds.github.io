import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Coil.gd', 'utf8');

assert.match(source, /func\s+onPrepare\(\):[\s\S]*?numActivations = 0/);
assert.match(source, /func\s+onChargeReceived\(_charge\):[\s\S]*?numActivations < maxActivations:[\s\S]*?stealRandomBuff\(numBuffs\)[\s\S]*?miniActivate\(\)/);
assert.match(source, /if numActivations == maxActivations:[\s\S]*?consumed = true/);

const handler = getScriptHandler('coil');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onChargeReceived, 'function');

const pieces = buildCombatPieces([{ id: 'coil', key: 'coil', x: 0, y: 0, r: 0 }], itemsById);
const coil = pieces.find((piece) => piece.itemId === 'coil');
assert.ok(coil, 'Coil fixture piece should build');
const ctx = {
  t: 2,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  rng: () => 0,
};

handler.onPrepare(coil, ctx);
assert.equal(coil._coilN, 0, 'Coil resets its source charge counter during preparation');
grantStacks(ctx.dummy, 'heat', 5, { rng: () => 0 });
handler.onChargeReceived(coil, ctx);
assert.equal(coil._coilN, 1);
assert.equal(ctx.dummy.stacks.heat, 3, 'Coil steals the source number of random buff stacks');
assert.equal(ctx.player.stacks.heat, 2, 'Coil grants the stolen buff stacks to its owner');
assert.equal(ctx.events.filter((event) => event.meta?.miniActivate).length, 1, 'Coil mini-activates after each charge');
assert.equal(Boolean(coil.consumed), false);

for (let i = 1; i < 10; i += 1) handler.onChargeReceived(coil, ctx);
assert.equal(coil._coilN, 10, 'Coil accepts charges through its source cap');
assert.equal(coil.consumed, true, 'Coil is consumed at its source activation cap');
assert.equal(coil.alive, false, 'Consumed Coil leaves combat');
const eventCountAtCap = ctx.events.length;
handler.onChargeReceived(coil, ctx);
assert.equal(ctx.events.length, eventCountAtCap, 'Coil ignores charges after its source cap');

console.log('Coil simulator parity smoke passed.');
