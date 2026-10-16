import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Chainsaw.gd', 'utf8');

assert.match(source, /func\s+onPrepare\(\):[\s\S]*?setState\(false\)/);
assert.match(source, /func\s+onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*?if numCharges > 0:[\s\S]*?stealBuffsFraction[\s\S]*?else:[\s\S]*?removeBuffsFraction[\s\S]*?reduceSpeed\(slowdown\)/);
assert.match(source, /func\s+onChargeReceived\(_charge\):[\s\S]*?if numCharges == 1:[\s\S]*?setState\(true\)/);
assert.match(source, /func\s+onChargeLeft\(_charge\):[\s\S]*?if numCharges == 0:[\s\S]*?setState\(false\)/);

const handler = getScriptHandler('chainsaw');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onPreDealDamageEarly, 'function');
assert.equal(typeof handler?.onChargeReceived, 'function');
assert.equal(typeof handler?.onChargeLeft, 'function');

const pieces = buildCombatPieces([{ id: 'chainsaw', key: 'chainsaw', x: 0, y: 0, r: 0 }], itemsById);
const chainsaw = pieces.find((piece) => piece.itemId === 'chainsaw');
assert.ok(chainsaw, 'Chainsaw fixture piece should build');
const ctx = {
  t: 2,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  rng: () => 0,
};

handler.onPrepare(chainsaw, ctx);
assert.equal(chainsaw._chainsawCharged, false, 'Chainsaw starts uncharged');
chainsaw.numCharges = 1;
handler.onChargeReceived(chainsaw, ctx);
assert.equal(chainsaw._chainsawCharged, true, 'Chainsaw becomes charged at its first charge');
chainsaw.numCharges = 2;
handler.onChargeReceived(chainsaw, ctx);
assert.equal(chainsaw._chainsawCharged, true, 'Additional Chainsaw charges keep it charged');
chainsaw.numCharges = 1;
handler.onChargeLeft(chainsaw, ctx);
assert.equal(chainsaw._chainsawCharged, true, 'Leaving one of multiple Chainsaw charges keeps it charged');
chainsaw.numCharges = 0;
handler.onChargeLeft(chainsaw, ctx);
assert.equal(chainsaw._chainsawCharged, false, 'Chainsaw clears its state at zero charges');

grantStacks(ctx.dummy, 'lucky', 20, { rng: () => 0 });
handler.onPreDealDamageEarly(chainsaw, ctx, { hit: true });
assert.equal(ctx.dummy.stacks.lucky, 19, 'Uncharged Chainsaw removes five percent of a buff');
assert.equal(chainsaw.speedScale, -0.05, 'Chainsaw slows itself after a successful hit');

ctx.dummy.stacks.lucky = 0;
ctx.dummy.stacks.mana = 20;
chainsaw.numCharges = 1;
handler.onPreDealDamageEarly(chainsaw, ctx, { hit: true });
assert.equal(ctx.dummy.stacks.mana, 19, 'Charged Chainsaw removes five percent of a buff');
assert.equal(ctx.player.stacks.mana, 1, 'Charged Chainsaw steals the removed buff');
assert.equal(chainsaw.speedScale, -0.1, 'Each successful Chainsaw hit applies its slowdown');

ctx.dummy.stacks.mana = 20;
const beforeMissSpeed = chainsaw.speedScale;
handler.onPreDealDamageEarly(chainsaw, ctx, { hit: false });
assert.equal(ctx.dummy.stacks.mana, 20, 'Chainsaw does not remove buffs on a miss');
assert.equal(chainsaw.speedScale, beforeMissSpeed, 'Chainsaw does not slow itself on a miss');

console.log('Chainsaw simulator parity smoke passed.');
