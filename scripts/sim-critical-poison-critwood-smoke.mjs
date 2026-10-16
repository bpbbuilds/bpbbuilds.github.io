import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
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

const critical = source('critical_poison', 'Exclusive/CriticalPoison.gd', 'Item', ['onPrepare']);
const critwood = source('critwood_staff', 'CritwoodStaff.gd', 'Weapon', [
  'onPreDealDamage_early',
  'onPrepare',
]);
const criticalSource = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/CriticalPoison.gd',
  'utf8',
);
const critwoodSource = fs.readFileSync('tools/game-extract-full/Items/CritwoodStaff.gd', 'utf8');
assert.match(criticalSource, /func onPrepare\(\):[\s\S]*connectForCombat\(weapon, "attacked"/);
assert.match(criticalSource, /opponent\(\)\.changePoisonCritChancePercent/);
assert.match(critwoodSource, /func onPrepare\(\):[\s\S]*setState\(false\)/);
assert.match(critwoodSource, /func onPreDealDamage_early\(damageRes: DamageResult\)/);
assert.match(critwoodSource, /damageRes\.damage \+= tempDamBonus/);
assert.equal(getScriptHandler('critical_poison')?.handlerId, 'critical_poison');
assert.equal(getScriptHandler('critwood_staff')?.handlerId, 'critwood_staff');

// Critical Poison binds during preparation, accumulates linked weapon damage,
// and routes Lucky into poison crit chance rather than ordinary crit chance.
{
  const skill = {
    ...byId.get('critical_poison'),
    params: { damt: 5, poison: 1 },
    shape: [[1]],
  };
  const weapon = {
    ...byId.get('wooden_sword'),
    id: 'critical_test_weapon',
    shape: [[1]],
  };
  const items = new Map([[skill.id, skill], [weapon.id, weapon]]);
  const pieces = [
    {
      itemId: skill.id,
      placementKey: 'poison',
      name: 'Critical Poison',
      kind: 'gadget',
      side: 'you',
      params: skill.params,
      chance: 5,
      alive: true,
    },
    {
      itemId: weapon.id,
      placementKey: 'weapon',
      name: 'Critical Test Weapon',
      kind: 'weapon',
      side: 'you',
      alive: true,
    },
  ];
  const graph = {
    pieces: new Map([
      ['poison', { key: 'poison', id: skill.id, affectCells: [{ cell: '1,0', color: 'primary' }] }],
      ['weapon', { key: 'weapon', id: weapon.id, affectCells: [] }],
    ]),
    filled: new Map([['1,0', 'weapon']]),
  };
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const ctx = {
    player,
    dummy,
    bus,
    events: [],
    t: 3,
    graph,
    itemsById: items,
    canAffect,
    pieces,
    rng: () => 0,
  };
  const piece = pieces[0];
  getScriptHandler('critical_poison').onPrepare(piece, ctx);
  bus.emit('piece_dealt_damage', { piece: pieces[1], hit: { hit: true, damage: 5, healthDamage: 5 } });
  assert.equal(dummy.stacks.poison, 1);
  grantStacks(player, 'lucky', 1, { originKey: 'test', originId: 'test' });
  assert.equal(dummy.poisonCritChance, 5);
  assert.equal(dummy.critChance || 0, 0);
}

// Critwood Staff prepares an inactive state, then its early damage hook spends
// Mana, adds p2 damage, and adds/removes +100 crit chance for the timed window.
{
  const placements = [
    { id: 'critwood_staff', key: 'staff', x: 0, y: 0, r: 0 },
    { id: 'wooden_sword', key: 'ally', x: 1, y: 0, r: 0 },
  ];
  const items = new Map([
    [byId.get('critwood_staff').id, byId.get('critwood_staff')],
    [byId.get('wooden_sword').id, byId.get('wooden_sword')],
  ]);
  const pieces = buildCombatPieces(placements, items);
  const piece = pieces.find((p) => p.itemId === 'critwood_staff');
  const ally = pieces.find((p) => p.itemId === 'wooden_sword');
  assert.ok(piece && ally);
  const player = createActor('player');
  const dummy = createActor('dummy');
  player.stacks.mana = 3;
  const ctx = {
    player,
    dummy,
    events: [],
    t: 4,
    graph: buildBoardGraph(placements, items),
    itemsById: items,
    pieces,
    bus: createCombatBus(),
    rng: () => 0,
  };
  const handler = getScriptHandler('critwood_staff');
  handler.onPrepare(piece, ctx);
  assert.equal(piece._critBuff, false);
  const damage = { damage: 6 };
  handler.onPreDealDamageEarly(piece, ctx, damage);
  assert.equal(player.stacks.mana, 0);
  assert.equal(damage.damage, 13);
  assert.equal(piece.critChance, 100);
  assert.equal(ally.critChance, 100);
  piece._tryCrownInvuln(5.7);
  assert.equal(piece.critChance, 0);
  assert.equal(ally.critChance, 0);
}

console.log('OK Critical Poison and Critwood Staff source ports');
