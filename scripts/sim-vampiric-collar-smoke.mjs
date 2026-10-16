import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { emitBuffChanged } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/VampiricCollar.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-accessories.js', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const rawRules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = { ...rawRules, rulesById: rawRules.byId };

assert.equal(inventory.byId.vampiric_collar?.file, 'Exclusive/VampiricCollar.gd');
assert.deepEqual(inventory.byId.vampiric_collar?.overrides, ['onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canDamage\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_vampirism_changed", "onVampirismChanged"\)/);
assert.match(source, /connectForCombat\(opponent\(\), "character_attacked", "onOpponentAttacked"\)/);
assert.match(source, /damageRes\.getDamage\(\) > 0/);
assert.match(source, /damageRes\.damage \* lifestealFactor/);
assert.match(portSource, /handlerId: 'vampiric_collar'/);
assert.match(portSource, /onPrepare\(piece, ctx\)/);

const handler = getScriptHandler('vampiric_collar');
assert.equal(handler?.handlerId, 'vampiric_collar');
assert.equal(typeof handler?.onPrepare, 'function');

const collarCatalog = byId.get('vampiric_collar');
const swordCatalog = byId.get('wooden_sword');
const nonDamageCatalog = byId.get('lucky_clover');
assert.ok(collarCatalog && swordCatalog && nonDamageCatalog);

const collar = {
  ...collarCatalog,
  itemId: 'vampiric_collar', placementKey: 'collar', name: 'Vampiric Collar',
  kind: 'passive', side: 'you', alive: true,
  params: { p1: 3, p2: 50 },
};
const sword = {
  ...swordCatalog,
  itemId: 'wooden_sword', placementKey: 'sword', name: 'Wooden Sword',
  kind: 'weapon', side: 'you', alive: true, critChance: 0,
};
const nonDamage = {
  ...nonDamageCatalog,
  itemId: 'lucky_clover', placementKey: 'non-damage', name: 'Lucky Clover',
  kind: 'passive', side: 'you', alive: true, critChance: 0,
};
const graph = {
  pieces: new Map([
    ['collar', { key: 'collar', id: 'vampiric_collar', affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
    ] }],
    ['sword', { key: 'sword', id: 'wooden_sword', affectCells: [] }],
    ['non-damage', { key: 'non-damage', id: 'lucky_clover', affectCells: [] }],
  ]),
  filled: new Map([
    ['1,0', 'sword'],
    ['2,0', 'non-damage'],
  ]),
};
const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 100 });
const bus = createCombatBus();
player._combatBus = bus;
dummy._combatBus = bus;
const ctx = {
  player,
  dummy,
  bus,
  events: [],
  t: 2,
  graph,
  pieces: [collar, sword, nonDamage],
  itemsById: new Map([
    ['vampiric_collar', collarCatalog],
    ['wooden_sword', swordCatalog],
    ['lucky_clover', nonDamageCatalog],
  ]),
  canAffect,
};

handler.onPrepare(collar, ctx);
emitBuffChanged(player, { stack: 'vampirism', amount: 2 });
assert.equal(sword.critChance, 8, 'Vampirism adds amount × source crit chance to linked damage items');
assert.equal(nonDamage.critChance, 0, 'canAffect(canDamage) excludes non-damaging links');

player.hp = 50;
bus.emit('piece_dealt_damage', {
  piece: sword,
  hit: { hit: true, damage: 20, healthDamage: 0 },
  t: 2,
});
assert.equal(player.hp, 51, 'lifesteal uses source damage even when Block absorbs health damage');

player.stacks.lucky = 2;
bus.emit('piece_dealt_damage', {
  piece: sword,
  hit: { hit: true, damage: 20, healthDamage: 0 },
  t: 2.1,
});
assert.equal(player.hp, 52, 'lifesteal scales by Lucky, rounds through healing, and uses p1/p2 parameters');

bus.emit('piece_dealt_damage', {
  piece: nonDamage,
  hit: { hit: true, damage: 100, healthDamage: 100 },
  t: 2.2,
});
assert.equal(player.hp, 52, 'unlinked non-damaging items do not trigger lifesteal');

console.log('OK Vampiric Collar source preparation, canDamage links, pre-Block damage lifesteal, Lucky scaling, and p1/p2 regression');
