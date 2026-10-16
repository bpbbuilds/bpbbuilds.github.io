import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/CursedDagger.gd', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const canAffectRules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = {
  rulesById: canAffectRules.byId,
  craftedIds: new Set(canAffectRules.craftedIds),
  classMasks: canAffectRules.classMasks,
  classBits: canAffectRules.classBits,
  rarityRank: canAffectRules.rarityRank,
};

const row = inventory.byId.cursed_dagger;
assert.ok(row, 'Cursed Dagger has a source inventory row');
assert.equal(row.file, 'CursedDagger.gd');
assert.equal(row.extends, 'Dagger');
assert.deepEqual(row.overrides, ['onPreDealDamage_early', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canDamage\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectToOpponentDebuffs\("onOpponentDebuffsChanged"\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)/);
assert.match(source, /func onOpponentDebuffsChanged\(amount, _event\):[\s\S]*addCritChancePercent\(extraCritChance\)/);
assert.match(source, /for item in getAffectedItems\(\):[\s\S]*item\.addCritChancePercent\(extraCritChance\)/);
assert.equal(getScriptHandler('cursed_dagger')?.handlerId, 'cursed_dagger');

const dagger = {
  itemId: 'cursed_dagger',
  placementKey: 'cursed',
  name: 'Cursed Dagger',
  kind: 'weapon',
  side: 'you',
  alive: true,
  params: byId.get('cursed_dagger').params,
  chance: 2,
  critChance: 0,
  bonusAccuracy: 0,
};
const linkedWeapon = {
  itemId: 'dagger',
  placementKey: 'weapon',
  name: 'Dagger',
  kind: 'weapon',
  side: 'you',
  alive: true,
  critChance: 0,
  bonusAccuracy: 0,
};
const linkedPet = {
  itemId: 'rat',
  placementKey: 'pet',
  name: 'Rat',
  kind: 'pet',
  side: 'you',
  alive: true,
  damageMax: 5,
  critChance: 0,
  bonusAccuracy: 0,
};
const graph = {
  pieces: new Map([
    ['cursed', { key: 'cursed', id: 'cursed_dagger', affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
    ] }],
    ['weapon', { key: 'weapon', id: 'dagger', affectCells: [] }],
    ['pet', { key: 'pet', id: 'rat', affectCells: [] }],
  ]),
  filled: new Map([
    ['1,0', 'weapon'],
    ['2,0', 'pet'],
  ]),
};

const player = createActor('player');
const dummy = createActor('dummy');
const ctx = {
  player,
  dummy,
  events: [],
  t: 2,
  rng: () => 0,
  graph,
  itemsById: new Map([
    ['cursed_dagger', byId.get('cursed_dagger')],
    ['dagger', byId.get('dagger')],
    ['rat', byId.get('rat')],
  ]),
  canAffect,
  pieces: [dagger, linkedWeapon, linkedPet],
};
const handler = getScriptHandler('cursed_dagger');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onPreDealDamageEarly, 'function');

handler.onPrepare(dagger, ctx);
grantStacks(dummy, 'poison', 2, { originKey: 'other', originId: 'other' });
assert.equal(dagger.critChance, 4, 'each opponent debuff stack adds source crit chance');
assert.equal(dagger.bonusAccuracy, 2, 'each opponent debuff stack adds source accuracy');
assert.equal(linkedWeapon.critChance, 4, 'linked damage weapon receives source crit chance');
assert.equal(linkedWeapon.bonusAccuracy, 2, 'linked weapon receives source accuracy');
assert.equal(linkedPet.critChance, 4, 'linked damage item receives source crit chance');
assert.equal(linkedPet.bonusAccuracy, 0, 'non-weapon damage items do not receive source accuracy');

spendStacks(dummy, 'poison', 1, { originKey: 'other', originId: 'other' });
assert.equal(dagger.critChance, 2, 'debuff removal reverses the same crit delta');
assert.equal(dagger.bonusAccuracy, 1, 'debuff removal reverses the same accuracy delta');

handler.onPreDealDamageEarly(dagger, ctx, { hit: false });
assert.equal(dummy.stacks.poison, 1, 'misses do not inflict random debuffs');
handler.onPreDealDamageEarly(dagger, ctx, { hit: true });
assert.equal(dummy.stacks.poison, 3, 'successful early hits inflict the source debuff count');

console.log('OK Cursed Dagger source port');
