import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/DancingDragon.gd', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
};

const row = inventory.byId.dancing_dragon;
assert.ok(row, 'Dancing Dragon has a source inventory row');
assert.equal(row.file, 'DancingDragon.gd');
assert.equal(row.extends, 'Weapon');
assert.deepEqual(row.overrides, ['onCombatStart', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Magic\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*character_heat_changed[\s\S]*character_lucky_changed/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveHeat\(getP2\(\) \* numAffected\)[\s\S]*giveLucky\(getP3\(\) \* numAffected\)/);
assert.match(source, /func onHeatChanged\(amount, _event\):[\s\S]*changeVaryingDamage\(getP1\(\) \* amount\)/);
assert.match(source, /func onLuckyChanged\(amount, event\):[\s\S]*changeDebuffResistChances\(getChance\(\) \* amount\)/);
assert.equal(getScriptHandler('dancing_dragon')?.handlerId, 'dancing_dragon');

const piece = {
  itemId: 'dancing_dragon', placementKey: 'dragon', name: 'Dancing Dragon',
  kind: 'weapon', side: 'you', alive: true, params: byId.get('dancing_dragon').params,
  chance: 2, bonusDamage: 0, removableBonusDamage: 0,
};
const magic = {
  itemId: 'magic_staff', placementKey: 'magic', name: 'Magic Staff',
  kind: 'weapon', side: 'you', alive: true,
};
const graph = {
  pieces: new Map([
    ['dragon', { key: 'dragon', id: 'dancing_dragon', affectCells: [{ cell: '1,0', color: 'primary' }] }],
    ['magic', { key: 'magic', id: 'magic_staff', affectCells: [] }],
  ]),
  filled: new Map([['1,0', 'magic']]),
};
const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
player._combatBus = bus;
dummy._combatBus = bus;
const events = [];
const ctx = {
  player,
  dummy,
  events,
  bus,
  t: 1,
  rng: () => 0,
  graph,
  pieces: [piece, magic],
  itemsById: new Map([
    ['dancing_dragon', byId.get('dancing_dragon')],
    ['magic_staff', byId.get('magic_staff')],
  ]),
  canAffect,
};
const handler = getScriptHandler('dancing_dragon');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCombatStart, 'function');

bindBuffCombatLog({ events, getT: () => ctx.t, dummy });
try {
  handler.onPrepare(piece, ctx);
  handler.onCombatStart(piece, ctx);
  assert.equal(player.stacks.heat, 2, 'one affected Magic item grants source Heat');
  assert.equal(player.stacks.lucky, 2, 'one affected Magic item grants source Lucky');
  assert.equal(piece.bonusDamage, 1, 'source Heat grants varying damage per stack');
  assert.equal(player.stackResist.poison, 4, 'source Lucky grants poison resistance');
  assert.equal(player.stackResist.blind, 4, 'source Lucky grants blind resistance');
  assert.equal(player.stackResist.cold, 4, 'source Lucky grants cold resistance');

  const startBuffs = events.filter((event) => event.type === 'buff' && event.itemId === 'dancing_dragon');
  assert.deepEqual(startBuffs.map((event) => event.meta?.stack), ['heat', 'lucky']);

  spendStacks(player, 'heat', 1, { originKey: 'test', originId: 'test' });
  spendStacks(player, 'lucky', 1, { originKey: 'test', originId: 'test' });
  assert.equal(piece.bonusDamage, 0.5, 'Heat removal reverses varying damage');
  assert.equal(player.stackResist.poison, 2, 'Lucky removal reverses debuff resistance');
} finally {
  unbindBuffCombatLog();
}

console.log('OK Dancing Dragon source port');
