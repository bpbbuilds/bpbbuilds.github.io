import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const cthulhuData = byId.get('cthulhu');
const foodData = byId.get('banana');
const darkData = byId.get('dark_lantern');
assert.ok(cthulhuData && foodData && darkData);

const row = inventory.byId.cthulhu;
assert.ok(row);
assert.equal(row.file, 'Exclusive/Cthulhu.gd');
assert.equal(row.extends, 'Item');
assert.deepEqual(row.overrides, ['doCooldownEffect', 'onPrepare']);

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Cthulhu.gd', 'utf8');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Food\)[\s\S]*item\.hasType\(Type\.Dark\)/);
assert.match(source, /func onAffectedItemAdded\(item, color: int\):[\s\S]*addDynamicType\(Type\.Dark, self\)/);
assert.match(source, /func onAffectedItemRemoved\(item, color: int\):[\s\S]*removeDynamicType\(Type\.Dark, self\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*affectedFood\.clear\(\)[\s\S]*getAffectedItems\(\)/);
assert.match(source, /addSpeed\(foodSpeed \* getNumAffectedItems\(\)\)/);
assert.match(source, /stealLife\(dam, getP_m\("lifesteal"\) \/ 100\.0\)[\s\S]*activate\(\)/);
assert.match(source, /Util\.pickRandomElement\(affectedFood\)\.doCooldownEffect\(\)/);

const handler = getScriptHandler('cthulhu');
assert.equal(handler?.handlerId, 'cthulhu');
assert.equal(typeof handler?.onPrepare, 'function');

const cthulhu = {
  itemId: 'cthulhu',
  placementKey: 'cthulhu',
  name: 'Cthulhu',
  kind: 'pet',
  side: 'you',
  alive: true,
  params: cthulhuData.params,
  speedScale: 0,
  cooldown: cthulhuData.cooldown,
  baseCooldown: cthulhuData.cooldown,
};
const food = {
  itemId: 'banana',
  placementKey: 'food',
  name: 'Banana',
  kind: 'consumable',
  side: 'you',
  alive: true,
  params: foodData.params,
  cooldown: foodData.cooldown,
  baseCooldown: foodData.cooldown,
};
const dark = {
  itemId: 'dark_lantern',
  placementKey: 'dark',
  name: 'Dark Lantern',
  kind: 'gadget',
  side: 'you',
  alive: true,
};
const items = new Map([
  ['cthulhu', cthulhuData],
  ['banana', foodData],
  ['dark_lantern', darkData],
]);
const graph = {
  pieces: new Map([
    ['cthulhu', { key: 'cthulhu', id: 'cthulhu', affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }] }],
    ['food', { key: 'food', id: 'banana', affectCells: [] }],
    ['dark', { key: 'dark', id: 'dark_lantern', affectCells: [] }],
  ]),
  filled: new Map([['1,0', 'food'], ['2,0', 'dark']]),
};
const player = createActor('player');
const dummy = createActor('dummy');
player.hp = 100;
dummy.hp = 100;
const events = [];
const ctx = {
  player,
  dummy,
  events,
  t: 4,
  rng: () => 0,
  graph,
  itemsById: items,
  pieces: [cthulhu, food, dark],
  canAffect: {
    rulesById: rules.byId,
    craftedIds: new Set(rules.craftedIds),
    classMasks: rules.classMasks,
    classBits: rules.classBits,
    rarityRank: rules.rarityRank,
  },
};

handler.onPrepare(cthulhu, ctx);
assert.equal(cthulhu.speedScale, cthulhuData.params.speed / 100 * 2);
assert.deepEqual(cthulhu._cthulhuFoods, ['food']);
assert.deepEqual(food._dynamicTypes, ['dark']);
handler.onAffectedItemRemoved(cthulhu, ctx, food, 0);
assert.deepEqual(food._dynamicTypes, []);
handler.onAffectedItemAdded(cthulhu, ctx, food, 0);
assert.deepEqual(food._dynamicTypes, ['dark']);

const beforeHp = player.hp;
handler.onCooldownEffect(cthulhu, ctx);
assert.equal(dummy.hp, 100 - cthulhuData.params.dam);
assert.equal(player.hp, beforeHp + cthulhuData.params.dam + foodData.params.p1);
const damageIndex = events.findIndex((event) => event.type === 'damage' && event.itemId === 'cthulhu');
const healIndex = events.findIndex((event) => event.type === 'heal' && event.itemId === 'cthulhu');
const activateIndex = events.findIndex((event) => event.type === 'activate' && event.itemId === 'cthulhu');
assert.ok(damageIndex >= 0 && healIndex > damageIndex, 'Cthulhu uses the shared stealLife damage/heal chain');
assert.ok(activateIndex > healIndex, 'Cthulhu activates after stealLife');
assert.ok(events.some((event) => event.itemId === 'banana'), 'Cthulhu triggers one linked Food cooldown');

// A blocked effect still uses the shared source effect path. The simulator's
// stealLife contract heals from rolled effect damage, while the target's HP
// remains unchanged and the block is consumed.
dummy.block = 100;
const hpBeforeBlocked = player.hp;
const eventCountBeforeBlocked = events.length;
handler.onCooldownEffect(cthulhu, { ...ctx, t: 5 });
assert.equal(dummy.hp, 90);
assert.equal(player.hp, hpBeforeBlocked + cthulhuData.params.dam + foodData.params.p1);
assert.ok(events.slice(eventCountBeforeBlocked).some((event) => event.itemId === 'cthulhu'));

console.log('OK Cthulhu source port');
