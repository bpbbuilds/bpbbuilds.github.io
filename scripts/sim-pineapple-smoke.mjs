import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const foodSource = fs.readFileSync('tools/game-extract-full/Items/Food.gd', 'utf8');
const source = fs.readFileSync('tools/game-extract-full/Items/Pineapple.gd', 'utf8');

assert.equal(inventory.byId.pineapple?.file, 'Pineapple.gd');
assert.match(foodSource, /func prepare\(\):[\s\S]*addSpeed\(getNumAffectedItems\(\) \* 0\.1\)/);
assert.match(source, /extends Food/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*heal\(\)[\s\S]*giveSpikes\(1\)[\s\S]*activate\(\)/);

const item = (id, placementKey, overrides = {}) => ({
  ...byId.get(id),
  itemId: id,
  placementKey,
  name: byId.get(id)?.name || id,
  params: byId.get(id)?.params || {},
  kind: 'consumable',
  alive: true,
  charges: 3,
  cooldown: byId.get(id)?.cooldown ?? 2.9,
  baseCooldown: byId.get(id)?.cooldown ?? 2.9,
  ...overrides,
});

const pineapple = item('pineapple', 'pineapple');
const banana = item('banana', 'banana');
const graph = {
  pieces: new Map([
    ['pineapple', { key: 'pineapple', id: 'pineapple', cells: [], affectCells: [
      { cell: 'food-link', color: 'primary' },
    ] }],
    ['banana', { key: 'banana', id: 'banana', cells: [], affectCells: [] }],
  ]),
  filled: new Map([['food-link', 'banana']]),
};
const player = createActor('player', { maxHp: 100 });
player.hp = 50;
player._simT = 4;
const events = [];
const ctx = {
  player,
  dummy: createActor('dummy', { maxHp: 100 }),
  pieces: [pineapple, banana],
  graph,
  itemsById: byId,
  canAffect: {
    rulesById: canAffectRules.byId,
    startOfBattleIds: new Set(),
  },
  events,
  t: 4,
};
const handler = getScriptHandler('pineapple');

assert.equal(handler?.handlerId, 'pineapple');
handler.onPrepare(pineapple, ctx);
assert.equal(pineapple.speedScale, 0.1, 'Food inheritance adds 10% speed per linked Food');

handler.onCooldownEffect(pineapple, ctx);
assert.equal(player.hp, 54, 'Pineapple heals using catalog heal 4');
assert.equal(player.stacks.spikes, 1, 'Pineapple grants one Spikes stack');
assert.equal(pineapple.alive, true, 'Pineapple remains after activate rather than consume');
assert.deepEqual(events.filter((event) => event.type).map((event) => event.type), ['heal', 'buff', 'activate']);

player._simT = 8;
ctx.t = 8;
handler.onCooldownEffect(pineapple, ctx);
assert.equal(player.hp, 58, 'Pineapple can activate again on its cooldown');
assert.equal(player.stacks.spikes, 2);
assert.equal(events.filter((event) => event.type === 'activate').length, 2);

console.log('OK Pineapple source and repeated-food lifecycle regression');
