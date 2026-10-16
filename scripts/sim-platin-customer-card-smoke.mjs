import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const source = fs.readFileSync('tools/game-extract-full/Items/PlatinCustomerCard.gd', 'utf8');

assert.equal(inventory.byId.platin_customer_card?.file, 'PlatinCustomerCard.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.getRarity\(\) >= Rarity\.Legendary/);
assert.match(source, /func onPreCombatStart\(\):[\s\S]*giveReflectStacks\(getNumAffectedItems\(\) \* getP2\(\)\)[\s\S]*activate\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*pass/);

const item = (id, placementKey) => ({
  ...byId.get(id),
  itemId: id,
  placementKey,
  name: byId.get(id)?.name || id,
  params: byId.get(id)?.params || {},
  alive: true,
  kind: id === 'platin_customer_card' ? 'passive' : 'weapon',
});

const card = item('platin_customer_card', 'card');
const legendary = item('pine_protector', 'legendary');
const common = item('wooden_sword', 'common');
const graph = {
  pieces: new Map([
    ['card', { key: 'card', id: 'platin_customer_card', cells: [], affectCells: [
      { cell: 'legendary-link', color: 'primary' },
      { cell: 'common-link', color: 'primary' },
    ] }],
    ['legendary', { key: 'legendary', id: 'pine_protector', cells: [], affectCells: [] }],
    ['common', { key: 'common', id: 'wooden_sword', cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['legendary-link', 'legendary'],
    ['common-link', 'common'],
  ]),
};
const player = createActor('player', { maxHp: 100 });
const events = [];
const ctx = {
  player,
  dummy: createActor('dummy', { maxHp: 100 }),
  pieces: [card, legendary, common],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  t: 2.5,
};
const handler = getScriptHandler('platin_customer_card');

assert.equal(handler?.handlerId, 'platin_customer_card');
assert.equal(typeof handler?.onPreCombatStart, 'function');
assert.equal(typeof handler?.onCombatStart, 'function');
handler.onPreCombatStart(card, ctx);
assert.equal(player.debuffReflectStacks, 2, 'one affected Legendary item grants catalog p2 reflect stacks');
assert.deepEqual(events.map((event) => event.type), ['stat', 'activate']);

handler.onCombatStart(card, ctx);
assert.equal(events.length, 2, 'source onCombatStart remains a no-op');

console.log('OK Platin Customer Card source and pre-combat lifecycle regression');
