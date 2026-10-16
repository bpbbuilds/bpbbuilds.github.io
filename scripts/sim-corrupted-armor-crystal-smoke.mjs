import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import {
  cleanseRandomDebuffs,
  grantStacks,
} from '../js/pages/sim/engine/buff-economy.js';
import { createFatigueState } from '../js/pages/sim/engine/fatigue.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
};

function source(id, file, extendsName, overrides) {
  const row = inventory.byId[id];
  assert.ok(row, `${id} has a source inventory row`);
  assert.equal(row.file, file);
  assert.equal(row.extends, extendsName);
  assert.deepEqual(row.overrides, overrides);
  return row;
}

const armor = source('corrupted_armor', 'CorruptedArmor.gd', 'Item', [
  'doCooldownEffect',
  'onCombatStart',
]);
const crystal = source('corrupted_crystal', 'Gems/CorruptedCrystal.gd', 'Gem', [
  'doCooldownEffect',
]);
const armorSource = fs.readFileSync('tools/game-extract-full/Items/CorruptedArmor.gd', 'utf8');
const crystalSource = fs.readFileSync(
  'tools/game-extract-full/Items/Gems/CorruptedCrystal.gd',
  'utf8',
);
assert.match(armorSource, /opponent\(\)\.changeDebuffProtectionChance/);
assert.match(armorSource, /pickRandomStacks\(Game\.getDebuffs\(\), movedDebuffs/);
assert.match(crystalSource, /connectForCombat\(opponent\(\), "character_damaged"/);
assert.match(crystalSource, /connectToOpponentDebuffs\("onOpponentDebuffsChanged"\)/);
assert.match(crystalSource, /opponent\(\)\.addFatigueDamage\(1\)/);
assert.equal(getScriptHandler('corrupted_armor')?.handlerId, 'corrupted_armor');
assert.equal(getScriptHandler('corrupted_crystal')?.handlerId, 'corrupted_crystal');

// CorruptedArmor.gd tags pure Holy links as Dark, grants starting Block, and
// makes the opponent's debuff cleanse protection scale with every link.
{
  const items = new Map([
    [byId.get('corrupted_armor').id, byId.get('corrupted_armor')],
    [byId.get('holy_armor').id, byId.get('holy_armor')],
  ]);
  const armorPiece = {
    itemId: 'corrupted_armor',
    placementKey: 'armor',
    name: 'Corrupted Armor',
    kind: 'armor',
    side: 'you',
    alive: true,
    params: { p1: 2 },
    chance: 8,
    blockGrant: 100,
  };
  const holyPiece = {
    itemId: 'holy_armor',
    placementKey: 'holy',
    name: 'Holy Armor',
    kind: 'armor',
    side: 'you',
    alive: true,
  };
  const graph = {
    pieces: new Map([
      ['armor', { key: 'armor', id: 'corrupted_armor', affectCells: [{ cell: '1,0', color: 'primary' }] }],
      ['holy', { key: 'holy', id: 'holy_armor', affectCells: [] }],
    ]),
    filled: new Map([['1,0', 'holy']]),
  };
  const player = createActor('player');
  const dummy = createActor('dummy');
  const events = [];
  const ctx = {
    player,
    dummy,
    events,
    t: 2.5,
    graph,
    itemsById: items,
    canAffect,
    pieces: [armorPiece, holyPiece],
    rng: () => 0,
  };
  const handler = getScriptHandler('corrupted_armor');
  handler.onCombatStart(armorPiece, ctx);
  assert.equal(player.block, 100);
  assert.deepEqual(holyPiece._dynamicTypes, ['dark']);
  assert.equal(dummy.debuffCleanseProtectChance, 8);

  dummy.stacks.poison = 1;
  const protectedCleanse = cleanseRandomDebuffs(dummy, 1, () => 0, {
    cleanse: true,
    rng: () => 0,
  });
  assert.deepEqual(protectedCleanse, {});
  assert.equal(dummy.stacks.poison, 1);

  grantStacks(player, 'poison', 2, { originKey: 'test', originId: 'test' });
  handler.onCooldownEffect(armorPiece, ctx);
  assert.equal(player.stacks.poison, 0);
  assert.equal(dummy.stacks.poison, 3);
  assert.ok(events.some((event) => event.meta?.handler === 'corrupted_armor'));
}

// CorruptedCrystal.gd weapon mode follows the opponent's damage signal and
// toggles the host damage factor below/above the exact source threshold.
{
  const host = {
    id: 'crystal_test_weapon',
    name: 'Crystal Test Weapon',
    displayName: 'Crystal Test Weapon',
    type: 'Melee Weapon',
    cooldown: 1,
    damageMin: 1,
    damageMax: 1,
    accuracy: 100,
    params: {},
    shape: [[1]],
  };
  const items = new Map([
    [host.id, host],
    [byId.get('corrupted_crystal').id, byId.get('corrupted_crystal')],
  ]);
  const placements = [{ id: host.id, key: 'weapon', x: 0, y: 0, r: 0, gems: ['corrupted_crystal'] }];
  const [weapon] = buildCombatPieces(placements, items);
  const player = createActor('player');
  const dummy = createActor('dummy', { maxHp: 100 });
  dummy.hp = 29;
  const bus = createCombatBus();
  const ctx = {
    player,
    dummy,
    bus,
    t: 3,
    events: [],
    graph: buildBoardGraph(placements, items),
    itemsById: items,
    pieces: [weapon],
    rng: () => 0,
  };
  prepareGemSockets(weapon, ctx);
  bus.emit('character_damaged', { actor: dummy, hit: true, t: 3 });
  assert.equal(weapon.bonusDamageFactor, 1.5);
  dummy.hp = 40;
  bus.emit('character_damaged', { actor: dummy, hit: true, t: 3.1 });
  assert.equal(weapon.bonusDamageFactor, 1);
}

// Armor mode counts only Item-origin debuffs from the owner's side and grants
// p4 Block for every p3 debuffs, leaving the remainder banked.
{
  const host = byId.get('leather_armor');
  const gem = byId.get('corrupted_crystal');
  const items = new Map([[host.id, host], [gem.id, gem]]);
  const placements = [{ id: host.id, key: 'armor', x: 0, y: 0, r: 0, gems: [gem.id] }];
  const [armorPiece] = buildCombatPieces(placements, items);
  const player = createActor('player');
  const dummy = createActor('dummy');
  const ctx = {
    player,
    dummy,
    bus: createCombatBus(),
    t: 3,
    events: [],
    graph: buildBoardGraph(placements, items),
    itemsById: items,
    pieces: [armorPiece],
    rng: () => 0,
  };
  prepareGemSockets(armorPiece, ctx);
  grantStacks(dummy, 'poison', 7, {
    originKey: 'armor:gem:0',
    originId: 'corrupted_crystal',
  });
  assert.equal(player.block, 6);
}

// Loose CorruptedCrystal advances the source fatigue damage by one, applies
// the current counter plus that bonus immediately, then activates.
{
  const items = new Map([[byId.get('corrupted_crystal').id, byId.get('corrupted_crystal')]]);
  const placements = [{ id: 'corrupted_crystal', key: 'gem', x: 0, y: 0, r: 0 }];
  const [piece] = buildCombatPieces(placements, items);
  const player = createActor('player');
  const dummy = createActor('dummy');
  const events = [];
  const fatigue = createFatigueState();
  fatigue.counter = 4;
  const ctx = {
    player,
    dummy,
    fatigue,
    events,
    t: 4,
    bus: createCombatBus(),
    rng: () => 0,
  };
  getScriptHandler('corrupted_crystal').onCooldownEffect(piece, ctx);
  assert.equal(dummy.bonusFatigueDamage, 1);
  assert.equal(dummy.hp, dummy.maxHp - 5);
  const damageIndex = events.findIndex((event) => event.type === 'damage');
  const activateIndex = events.findIndex((event) => event.type === 'activate');
  assert.ok(damageIndex >= 0 && damageIndex < activateIndex);
  assert.equal(events[damageIndex].meta?.fatigue, true);
}

console.log('OK Corrupted Armor and Corrupted Crystal source ports');
