import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const itemsById = new Map(catalog.map((item) => [item.id, item]));
const canAffect = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DragonNest.gd', 'utf8');

assert.match(source, /func\s+canAffect\(item\):[\s\S]*?item is DragonEgg or item\.hasTag\(Tag\.Dragon\)/);
assert.match(source, /func\s+onPrepare\(\):[\s\S]*?item\.hasTag\(Tag\.Dragon\)[\s\S]*?connectForCombat\(item, "attacked", "onDragonAttacked"\)/);
assert.match(source, /func\s+onDragonAttacked\(damageRes\):[\s\S]*?heal\(getP_m\("heal"\), damageRes\.event\)[\s\S]*?miniActivate\(\)/);
assert.match(source, /func\s+onCombatStart\(\):[\s\S]*?giveLucky\(getP2\(\)\)[\s\S]*?giveRegeneration\(getP3\(\)\)[\s\S]*?giveMana\(getP4\(\)\)[\s\S]*?giveHeat\(getP5\(\)\)[\s\S]*?activate\(\)/);

const handler = getScriptHandler('dragon_nest');
assert.equal(typeof handler?.onCombatStart, 'function');

const placements = [
  { id: 'dragon_nest', key: 'nest', x: 0, y: 0, r: 0 },
  { id: 'ice_dragon', key: 'dragon', x: 2, y: 0, r: 0 },
  { id: 'wooden_sword', key: 'sword', x: -1, y: 0, r: 0 },
];
const graph = buildBoardGraph(placements, itemsById);
const pieces = buildCombatPieces(placements, itemsById);
const nest = pieces.find((piece) => piece.itemId === 'dragon_nest');
const dragon = pieces.find((piece) => piece.itemId === 'ice_dragon');
const sword = pieces.find((piece) => piece.itemId === 'wooden_sword');
assert.ok(nest && dragon && sword, 'Dragon Nest fixture should include dragon and non-dragon targets');

const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
const events = [];
const ctx = {
  t: 3,
  player,
  dummy,
  bus,
  events,
  graph,
  pieces,
  itemsById,
  canAffect,
  rng: () => 0,
};

handler.onCombatStart(nest, ctx);
assert.equal(player.stacks.lucky, 4);
assert.equal(player.stacks.regeneration, 4);
assert.equal(player.stacks.mana, 8);
assert.equal(player.stacks.heat, 4);
assert.ok(events.some((event) => event.type === 'buff' && event.meta?.handler === 'dragon_nest'));

player.hp = 60;
bus.emit('piece_dealt_damage', { piece: sword, hit: { hit: true, damage: 10 }, t: 4 });
assert.equal(player.hp, 60, 'Dragon Nest ignores non-dragon attackers');

bus.emit('piece_dealt_damage', { piece: dragon, hit: { hit: true, damage: 10 }, t: 5 });
assert.equal(player.hp, 68, 'Dragon Nest heals after a dragon attack');
assert.ok(events.some((event) => event.type === 'heal' && event.meta?.handler === 'dragon_nest'));
assert.equal(events.filter((event) => event.meta?.handler === 'dragon_nest' && event.meta?.miniActivate).length, 1);

bus.emit('piece_dealt_damage', { piece: dragon, hit: { hit: false, damage: 0 }, t: 6 });
assert.equal(player.hp, 76, 'Dragon Nest reacts to the source attacked signal even on a miss');
assert.equal(events.filter((event) => event.meta?.handler === 'dragon_nest' && event.meta?.miniActivate).length, 2);

console.log('Dragon Nest simulator parity smoke passed.');
