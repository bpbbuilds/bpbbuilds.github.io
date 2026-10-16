import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/DeathScythe.gd', 'utf8');
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
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
};

const row = inventory.byId.death_scythe;
assert.ok(row, 'Death Scythe has a source inventory row');
assert.equal(row.file, 'DeathScythe.gd');
assert.equal(row.extends, 'Weapon');
assert.deepEqual(row.overrides, ['onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.gainsStack\(Stack\.Poison\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*setState\(false\)[\s\S]*connectForCombat\(opponent\(\), "character_poison_changed", "onOpponentPoisonChanged"\)[\s\S]*giveBuffPower\(Game\.EventType\.Poison, 1\)/);
assert.match(source, /func onOpponentPoisonChanged\(_amount, _event\):[\s\S]*curPoison = opponent\(\)\.getPoison\(\)[\s\S]*curPoison >= poisonThreshold[\s\S]*changeCritChancePercent\(getChance\(\)\)/);
assert.match(source, /func onShopEntered\(\):[\s\S]*onStateChanged\(false\)/);

const handler = getScriptHandler('death_scythe');
assert.equal(handler?.handlerId, 'death_scythe');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const data = byId.get('death_scythe');
assert.ok(data);
const piece = {
  itemId: 'death_scythe',
  placementKey: 'scythe',
  name: 'Death Scythe',
  kind: 'weapon',
  side: 'you',
  alive: true,
  params: data.params,
  chance: data.chance,
  chanceTag: data.chanceTag,
  critChance: 0,
  damageMin: data.damageMin,
  damageMax: data.damageMax,
  staminaCost: data.staminaCost,
  accuracy: data.accuracy,
  damageKind: 'melee',
  cooldown: data.cooldown,
  baseCooldown: data.cooldown,
  bonusDamage: 0,
  removableBonusDamage: 0,
};
const poisonTarget = { itemId: 'poison_dagger', placementKey: 'poison-target', kind: 'weapon', side: 'you' };
const unrelated = { itemId: 'banana', placementKey: 'unrelated', kind: 'consumable', side: 'you' };
const graph = {
  pieces: new Map([
    ['scythe', { key: 'scythe', id: 'death_scythe', affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
    ] }],
    ['poison-target', { key: 'poison-target', id: 'poison_dagger', affectCells: [] }],
    ['unrelated', { key: 'unrelated', id: 'banana', affectCells: [] }],
  ]),
  filled: new Map([
    ['1,0', 'poison-target'],
    ['2,0', 'unrelated'],
  ]),
};
const scytheData = byId.get('death_scythe');
const itemsById = new Map([
  ['death_scythe', scytheData],
  ['poison_dagger', byId.get('poison_dagger')],
  ['banana', byId.get('banana')],
]);
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const ctx = {
  player,
  dummy,
  events,
  t: 2,
  rng: () => 0,
  graph,
  itemsById,
  pieces: [piece, poisonTarget, unrelated],
  canAffect,
};

grantStacks(dummy, 'poison', data.params.p1);
handler.onPrepare(piece, ctx);
assert.equal(poisonTarget.buffPowers.poison, 2, 'source preparation gives linked poison-producing items +1 Poison power');
assert.equal(unrelated.buffPowers?.poison, undefined, 'unrelated items are not empowered');
assert.equal(piece._dsCrit, false, 'pre-existing Poison does not trigger before a source poison-change event');
assert.equal(piece.critChance, 0);

spendStacks(dummy, 'poison', data.params.p1);
grantStacks(dummy, 'poison', data.params.p1);
assert.equal(piece._dsCrit, true, 'the threshold activates on the later opponent Poison change');
assert.equal(piece.critChance, data.chance, 'the source item chance becomes the crit bonus');

const before = events.length;
const handled = handler.onCooldownEffect(piece, ctx);
assert.equal(handled, true, 'Death Scythe retains inherited Weapon cooldown behavior');
assert.ok(events.slice(before).some((event) => event.type === 'activate' && event.itemId === 'death_scythe'));

console.log('OK Death Scythe source port');
