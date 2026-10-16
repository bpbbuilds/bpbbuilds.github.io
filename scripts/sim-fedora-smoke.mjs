/**
 * Fedora fidelity — prepare chance, treasure/nature Lucky, and Lucky theft.
 *   node scripts/sim-fedora-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { getStackAmount } from '../js/pages/sim/engine/stacks.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const ids = ['fedora', 'lucky_clover', 'pumpkin', 'carrot', 'wooden_sword'];
const byId = new Map(ids.map((id) => [id, catalog.find((item) => item.id === id)]));

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Fedora.gd', 'utf8');
assert.match(source, /onready var luckPerNature:\s*=\s*int\(getP\("luck"\)\)/);
assert.match(source, /onready var luckPerTreasure:\s*=\s*int\(getP\("luck2"\)\)/);
assert.match(source, /onready var luckNeeded:\s*=\s*int\(getP\("luckt"\)\)/);
assert.match(source, /onready var numBuffs:\s*=\s*int\(getP\("buffs"\)\)/);
assert.match(source, /onready var bonusChance:\s*=\s*getP\("chance"\)/);
assert.match(source, /func canAffect\(item\):[\s\S]*isTreasure\(\) or item\.hasType\(Type\.Nature\)/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*item\.canModifyChance\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*Affected\.Secondary[\s\S]*addBonusChance\(bonusChance\)/);
assert.match(source, /giveLucky\(numNature \* luckPerNature \+ numTreasure \* luckPerTreasure\)/);
assert.match(source, /if character\(\)\.getLucky\(\) >= luckNeeded:/);
assert.match(source, /useLucky\(luckNeeded\)[\s\S]*stealRandomBuff\(numBuffs/);
assert.match(source, /stealRandomBuff\(numBuffs, event, buffs\)/);
assert.match(source, /\n\s*activate\(\)\s*\n/);

const handler = getScriptHandler('fedora');
assert.equal(handler?.handlerId, 'fedora');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCombatStart, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const placements = [
  { id: 'fedora', key: 'fedora', x: 0, y: 0, r: 0 },
  { id: 'lucky_clover', key: 'nature', x: -2, y: 1, r: 0 },
  { id: 'pumpkin', key: 'treasure', x: 3, y: 1, r: 0 },
  { id: 'carrot', key: 'nature2', x: 4, y: 2, r: 0 },
];
const pieces = buildCombatPieces(placements, byId);
const graph = buildBoardGraph(placements, byId);
const fedora = pieces.find((piece) => piece.itemId === 'fedora');
assert.ok(fedora);
const player = createActor('player');
const events = [];
const ctx = { t: 2.5, player, dummy: createActor('dummy'), events, graph, pieces, itemsById: byId };

handler.onPrepare(fedora, { ...ctx, t: 0 });
assert.equal(
  pieces.find((piece) => piece.placementKey === 'nature2')?.bonusChanceMult,
  20,
  'secondary canModifyChance target receives Fedora chance before combat starts',
);
assert.equal(
  pieces.find((piece) => piece.placementKey === 'treasure')?.bonusChanceMult || 0,
  0,
  'primary target is not treated as a secondary chance target',
);
assert.equal(
  pieces.find((piece) => piece.placementKey === 'nature')?.bonusChanceMult || 0,
  0,
  'primary-only Nature target is not treated as a secondary chance target',
);

handler.onCombatStart(fedora, ctx);
assert.equal(getStackAmount(player, 'lucky'), 5, 'two primary Nature plus one Treasure target grants 5 Lucky');
assert.ok(events.some((event) => event.itemId === 'fedora' && event.type === 'activate'));

// Source int() truncates toward zero and permits typed zero thresholds/counts.
const fractional = { ...fedora, params: { luck: 1.9, luck2: 2.9, luckt: 0, buffs: 0, chance: 0 } };
const fractionalPlayer = createActor('player');
const fractionalDummy = createActor('dummy');
fractionalDummy.stacks.heat = 3;
const fractionalEvents = [];
handler.onCombatStart(fractional, {
  ...ctx,
  player: fractionalPlayer,
  dummy: fractionalDummy,
  pieces,
  events: fractionalEvents,
});
assert.equal(getStackAmount(fractionalPlayer, 'lucky'), 4, 'int parameters truncate, not round');

const zeroEvents = [];
const zeroPlayer = createActor('player');
const zeroDummy = createActor('dummy');
zeroDummy.stacks.heat = 3;
const zeroResult = handler.onCooldownEffect(
  { ...fedora, params: { luckt: 0, buffs: 0 } },
  { ...ctx, t: 4, player: zeroPlayer, dummy: zeroDummy, events: zeroEvents, rng: () => 0 },
);
assert.equal(zeroResult, true);
assert.equal(getStackAmount(zeroPlayer, 'lucky'), 0);
assert.equal(getStackAmount(zeroDummy, 'heat'), 3, 'zero buff count steals nothing while still satisfying threshold');
assert.ok(zeroEvents.find((event) => event.type === 'activate')?.t > 4, 'activation follows the source effect phase');

const run = simulateEngine({ placements, itemsById: byId, durationSec: 4, seed: 9, dummyAttacks: false });
const start = run.pieceSnapshots.find((snapshot) => snapshot.t === 0)?.byKey?.nature2;
assert.equal(start?.chance, 66, 'engine snapshot includes Fedora prepare-time chance bonus');

console.log('OK Fedora source and lifecycle/parameter regression');
