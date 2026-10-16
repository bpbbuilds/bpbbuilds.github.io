/**
 * Piggy Piñata fidelity — prepare-time canDamage target filter and crit chance.
 *   node scripts/sim-piggy-pinata-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
assert.equal(inventory.byId.piggy_pinata?.file, 'Exclusive/PiggyPinata.gd');
assert.equal(inventory.byId.piggy_pinata?.extends, 'Item');

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/PiggyPinata.gd', 'utf8');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canDamage\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getAffectedItems\(\)[\s\S]*addCritChancePercent\(getChance\(\)/);

const pinataItem = byId.get('piggy_pinata');
const swordItem = byId.get('wooden_sword');
const armorItem = byId.get('leather_armor');
const pinata = {
  ...pinataItem,
  itemId: 'piggy_pinata', placementKey: 'pinata', name: 'Piggy Piñata',
  params: pinataItem.params, chance: pinataItem.chance, alive: true,
};
const sword = {
  ...swordItem,
  itemId: 'wooden_sword', placementKey: 'sword', name: 'Wooden Sword',
  kind: 'weapon', damageMin: swordItem.damageMin, damageMax: swordItem.damageMax,
  critChance: 0, alive: true,
};
const armor = {
  ...armorItem,
  itemId: 'leather_armor', placementKey: 'armor', name: 'Leather Armor',
  kind: 'armor', damageMin: 0, damageMax: 0, critChance: 0, alive: true,
};
const ctx = {
  t: 0,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  rng: () => 0,
  pieces: [pinata, sword, armor],
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  graph: {
    pieces: new Map([
      ['pinata', { key: 'pinata', id: 'piggy_pinata', affectCells: [
        { cell: '0,0', color: 'primary' },
        { cell: '1,0', color: 'primary' },
      ] }],
      ['sword', { key: 'sword', id: 'wooden_sword', affectCells: [] }],
      ['armor', { key: 'armor', id: 'leather_armor', affectCells: [] }],
    ]),
    filled: new Map([
      ['0,0', 'sword'],
      ['1,0', 'armor'],
    ]),
  },
};

const handler = getScriptHandler('piggy_pinata');
assert.equal(handler?.handlerId, 'piggy_pinata');
handler.onPrepare(pinata, ctx);
assert.equal(sword.critChance, 5, 'Piggy Piñata applies source chance to damaging linked item');
assert.equal(armor.critChance, 0, 'Piggy Piñata excludes non-damaging linked item');

console.log('OK Piggy Piñata source and prepare regression');
