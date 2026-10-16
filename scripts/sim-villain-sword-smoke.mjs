import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/VillainSword.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b-aura.js', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const rawRules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = { ...rawRules, rulesById: rawRules.byId };

assert.equal(inventory.byId.villain_sword?.file, 'VillainSword.gd');
assert.deepEqual(inventory.byId.villain_sword?.overrides, ['onPreCombatStart']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canBeEmpowered\(\) and item\.descriptor\.isMeleeWeapon/);
assert.match(source, /func onPreCombatStart\(\):[\s\S]*reduceBonusDamage\(getP1\(\)[\s\S]*addBonusDamage\(getP2\(\)/);
assert.match(portSource, /handlerId: 'villain_sword'/);
assert.match(portSource, /onPreCombatStart\(piece, ctx\)/);

const handler = getScriptHandler('villain_sword');
assert.equal(handler?.handlerId, 'villain_sword');
assert.equal(typeof handler?.onPreCombatStart, 'function');

const villainCatalog = byId.get('villain_sword');
const swordCatalog = byId.get('wooden_sword');
const bowCatalog = byId.get('shortbow');
assert.ok(villainCatalog && swordCatalog && bowCatalog);

const villain = {
  ...villainCatalog,
  itemId: 'villain_sword', placementKey: 'villain', name: 'Villain Sword',
  kind: 'weapon', side: 'you', alive: true, bonusDamage: 1, removableBonusDamage: 1,
  params: { p1: 2, p2: 4 },
};
const melee = {
  ...swordCatalog,
  itemId: 'wooden_sword', placementKey: 'melee', name: 'Wooden Sword',
  kind: 'weapon', side: 'you', alive: true, bonusDamage: 5, removableBonusDamage: 5,
};
const ranged = {
  ...bowCatalog,
  itemId: 'shortbow', placementKey: 'ranged', name: 'Shortbow',
  kind: 'weapon', side: 'you', alive: true, bonusDamage: 5, removableBonusDamage: 5,
};
const graph = {
  pieces: new Map([
    ['villain', { key: 'villain', id: 'villain_sword', affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
    ] }],
    ['melee', { key: 'melee', id: 'wooden_sword', affectCells: [] }],
    ['ranged', { key: 'ranged', id: 'shortbow', affectCells: [] }],
  ]),
  filled: new Map([
    ['1,0', 'melee'],
    ['2,0', 'ranged'],
  ]),
};
const ctx = {
  player: createActor('player', { maxHp: 100 }),
  dummy: createActor('dummy', { maxHp: 100 }),
  events: [],
  t: 0,
  graph,
  pieces: [villain, melee, ranged],
  itemsById: new Map([
    ['villain_sword', villainCatalog],
    ['wooden_sword', swordCatalog],
    ['shortbow', bowCatalog],
  ]),
  canAffect,
};

handler.onPreCombatStart(villain, ctx);
assert.equal(melee.bonusDamage, 3, 'p1 reduces only linked melee bonus damage');
assert.equal(villain.bonusDamage, 5, 'p2 adds exact bonus damage to Villain Sword');
assert.equal(ranged.bonusDamage, 5, 'ranged weapons are excluded by source canAffect');

const zero = {
  ...villain,
  placementKey: 'zero-villain',
  params: { p1: 0, p2: 0 },
  bonusDamage: 0,
  removableBonusDamage: 0,
};
handler.onPreCombatStart(zero, { ...ctx, pieces: [zero, melee, ranged] });
assert.equal(melee.bonusDamage, 3, 'zero p1 does not remove additional target damage');
assert.equal(zero.bonusDamage, 0, 'zero p2 does not add damage');

console.log('OK Villain Sword source pre-combat timing, melee-only targeting, exact p1/p2 bonus damage, and zero-safe regression');
