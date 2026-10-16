import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, useMana } from '../js/pages/sim/engine/buff-economy.js';
import { waterElementalPort } from '../js/pages/sim/engine/scripts/ports-wave-d-weapons.js';

const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const canAffect = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/WaterElemental.gd', 'utf8');

assert.match(source, /func\s+canAffect\(item\):[\s\S]*?hasType\(Type\.Nature\)/);
assert.match(source, /func\s+canAffect_secondary\(item\):[\s\S]*?hasType\(Type\.Ice\)/);
assert.match(source, /func\s+onPrepare\(\):[\s\S]*?getNumAffectedItems\(Affected\.Secondary\)/);
assert.match(source, /getChance\(\)\s*\*\s*getNumAffectedItems\(\)/);
assert.match(source, /event\.getParam\("used", false\)/);
assert.doesNotMatch(source, /useMana\(/);

assert.equal(typeof waterElementalPort.onPrepare, 'function');
assert.equal(typeof waterElementalPort.onDealtDamage, 'function');
assert.equal(waterElementalPort.onCombatStart, undefined);

const placements = [
  { id: 'water_elemental', key: 'water', x: 0, y: 0, r: 0 },
  { id: 'stone', key: 'nature', x: -1, y: 1, r: 0 },
  { id: 'snowball', key: 'ice', x: -1, y: 0, r: 0 },
];
const graph = buildBoardGraph(placements, itemsById);
const pieces = buildCombatPieces(placements, itemsById);
const water = pieces.find((piece) => piece.itemId === 'water_elemental');
assert.ok(water, 'Water Elemental fixture piece should build');
const player = createActor('player');
const dummy = createActor('dummy');
const ctx = {
  t: 1,
  player,
  dummy,
  events: [],
  graph,
  itemsById,
  canAffect,
  pieces,
  rng: () => 0,
};

waterElementalPort.onPrepare(water, ctx);
assert.equal(water.speedScale, 0.1, 'Water Elemental speed should count secondary Ice links only');
assert.equal(water._waterStage, 0);

waterElementalPort.onDealtDamage(water, ctx, { hit: true });
assert.equal(player.stacks.mana, 4, 'on-hit mana should grant base plus the Nature-scaled bonus');
assert.equal(water._waterStage, 0, 'Water Elemental must not spend its own newly granted mana');

player.stacks.mana = 30;
useMana(player, 10, { originKey: 'other_item', originId: 'other_item' });
assert.equal(water._waterStage, 1, 'the first external mana spend should activate stage one');
assert.equal(water.bonusDamage || 0, 0);
useMana(player, 10, { originKey: 'other_item', originId: 'other_item' });
assert.equal(water._waterStage, 2, 'the second external mana spend should activate stage two');
assert.equal(water.bonusDamage, 15);
useMana(player, 10, { originKey: 'other_item', originId: 'other_item' });
assert.equal(water._waterStage, 3, 'the third external mana spend should activate stage three');

player.hp = 150;
waterElementalPort.onDealtDamage(water, ctx, { hit: true });
assert.equal(player.hp, 160, 'stage one-plus hits should heal with the game heal parameter');
assert.equal(dummy.stacks.cold, 3, 'stage three hits should inflict the cold parameter');

console.log('Water Elemental simulator parity smoke passed.');
