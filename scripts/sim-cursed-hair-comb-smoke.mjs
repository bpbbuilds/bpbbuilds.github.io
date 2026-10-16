import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/CursedHairComb.gd', 'utf8');
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

const row = inventory.byId.cursed_hair_comb;
assert.ok(row, 'Cursed Hair Comb has a source inventory row');
assert.equal(row.file, 'CursedHairComb.gd');
assert.equal(row.extends, 'Item');
assert.deepEqual(row.overrides, ['onCombatStart', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canBeEmpowered\(\)/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*item\.hasType\(Type\.Vampiric\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addHealingEfficiency\(getP3\(\) \/ 100\.0\)/);
assert.match(source, /connectForCombat\(weapon, "attacked", "onAffectedAttacked"\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveVampirism\(getP1\(\)\)[\s\S]*activate\(\)/);
assert.match(source, /func onAffectedAttacked\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)/);
assert.equal(getScriptHandler('cursed_hair_comb')?.handlerId, 'cursed_hair_comb');

const comb = {
  itemId: 'cursed_hair_comb', placementKey: 'comb', name: 'Cursed Hair Comb',
  kind: 'passive', side: 'you', alive: true, params: byId.get('cursed_hair_comb').params,
};
const weapon = {
  itemId: 'wooden_sword', placementKey: 'weapon', name: 'Wooden Sword',
  kind: 'weapon', side: 'you', alive: true, damageMin: 2, damageMax: 5,
};
const pet = {
  itemId: 'rat', placementKey: 'pet', name: 'Rat',
  kind: 'pet', side: 'you', alive: true, damageMin: 5, damageMax: 5,
};
const vamp = {
  itemId: 'vampiric_collar', placementKey: 'vamp', name: 'Vampiric Collar',
  kind: 'passive', side: 'you', alive: true,
};
const graph = {
  pieces: new Map([
    ['comb', { key: 'comb', id: 'cursed_hair_comb', affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
      { cell: '3,0', color: 'secondary' },
    ] }],
    ['weapon', { key: 'weapon', id: 'wooden_sword', affectCells: [] }],
    ['pet', { key: 'pet', id: 'rat', affectCells: [] }],
    ['vamp', { key: 'vamp', id: 'vampiric_collar', affectCells: [] }],
  ]),
  filled: new Map([
    ['1,0', 'weapon'],
    ['2,0', 'pet'],
    ['3,0', 'vamp'],
  ]),
};
const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy');
const bus = createCombatBus();
player._combatBus = bus;
dummy._combatBus = bus;
player._eventLog = [];
dummy._eventLog = [];
const events = [];
const ctx = {
  player,
  dummy,
  events,
  bus,
  t: 4,
  rng: () => 0,
  graph,
  itemsById: new Map([
    ['cursed_hair_comb', byId.get('cursed_hair_comb')],
    ['wooden_sword', byId.get('wooden_sword')],
    ['rat', byId.get('rat')],
    ['vampiric_collar', byId.get('vampiric_collar')],
  ]),
  canAffect,
  pieces: [comb, weapon, pet, vamp],
};
const handler = getScriptHandler('cursed_hair_comb');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCombatStart, 'function');

handler.onPrepare(comb, ctx);
assert.equal(player._healAmp, 0.3, 'source preparation applies healing efficiency');
player.hp = 50;
bus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true, damage: 20 }, t: 4 });
assert.equal(player.hp, 50, 'broader damage signal does not replace the source attacked signal');
bus.emit('item_attacked', { piece: weapon, hit: { hit: true, damage: 20 }, t: 4 });
assert.equal(player.hp, 59, 'empowered weapon hit heals with secondary Vampiric scaling and efficiency');

bus.emit('item_attacked', { piece: weapon, hit: { hit: false, damage: 20 }, t: 4.1 });
assert.equal(player.hp, 59, 'missed empowered weapon does not lifesteal');
bus.emit('item_attacked', { piece: pet, hit: { hit: true, damage: 20 }, t: 4.2 });
assert.equal(player.hp, 59, 'non-weapon primary target cannot trigger the source attacked listener');

handler.onCombatStart(comb, ctx);
assert.equal(player.stacks.vampirism, 6, 'combat start grants source Vampirism');
assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'cursed_hair_comb'));

console.log('OK Cursed Hair Comb source port');
