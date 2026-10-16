import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/PoisonSpear.gd', 'utf8');

assert.equal(inventory.byId.poison_spear?.file, 'Exclusive/PoisonSpear.gd');
assert.equal(inventory.byId.poison_spear?.extends, 'Weapon');
assert.match(source, /func affectsEmpty\(color\):[\s\S]*return true/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Nature\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*blockRemoval = getP\("blockremoval"\) \* \(getNumEmptyAffectedCells\(\) \+ getNumAffectedItems\(\)\)/);
assert.match(source, /func onPreDealDamage_late\(damageRes[^)]*\):[\s\S]*inflictPoison\(poison\)[\s\S]*selfInflictPoison\(selfPoison\)[\s\S]*removeBlock\(blockRemoval\)/);
assert.equal(byId.get('poison_spear')?.params.p1, 6);
assert.equal(byId.get('poison_spear')?.params.p2, 3);
assert.equal(byId.get('poison_spear')?.params.p3, 2);

const spearItem = byId.get('poison_spear');
const spear = {
  ...spearItem,
  itemId: 'poison_spear',
  placementKey: 'spear',
  name: 'Poison Spear',
  params: spearItem.params,
  kind: 'weapon',
  alive: true,
};
const nature = { ...byId.get('banana'), itemId: 'banana', placementKey: 'nature', name: 'Banana', kind: 'consumable', alive: true };
const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 100 });
dummy.block = 20;
const events = [];
const graph = {
  pieces: new Map([
    ['spear', { key: 'spear', id: 'poison_spear', cells: [], affectCells: [
      { cell: 'nature-link', color: 'primary' },
      { cell: 'empty-link', color: 'primary' },
    ] }],
    ['nature', { key: 'nature', id: 'banana', cells: [], affectCells: [] }],
  ]),
  filled: new Map([['nature-link', 'nature']]),
};
const ctx = {
  player,
  dummy,
  pieces: [spear, nature],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  t: 2,
  rng: () => 0,
};
const handler = getScriptHandler('poison_spear');

assert.equal(handler?.handlerId, 'poison_spear');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onPreDealDamageLate, 'function');
assert.equal(handler?.onCombatStart, undefined);
assert.equal(handler?.onDealtDamage, undefined);
handler.onPrepare(spear, ctx);
assert.equal(spear._blockStrip, 12, 'block removal is p1 × (empty cells + linked Nature items)');

handler.onPreDealDamageLate(spear, ctx, { hit: true });
assert.equal(dummy.stacks.poison, 3, 'source poison amount targets the opponent');
assert.equal(player.stacks.poison, 2, 'source selfPoison amount targets the owner');
assert.equal(dummy.block, 8, 'source blockRemoval strips the prepared amount');
assert.equal(events.at(-1)?.meta.handler, 'poison_spear');

console.log('OK Poison Spear source and late-hit regression');
