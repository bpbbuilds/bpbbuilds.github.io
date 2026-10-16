import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor, giveStamina } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DeathLotus.gd', 'utf8');
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

const row = inventory.byId.death_lotus;
assert.ok(row, 'Death Lotus has a source inventory row');
assert.equal(row.file, 'Exclusive/DeathLotus.gd');
assert.equal(row.extends, 'Item');
assert.deepEqual(row.overrides, ['doCooldownEffect', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Dark\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(getNumAffectedItems\(\) \* darkSpeed\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveMana\(mana\)[\s\S]*removeRandomBuffs\(buffs\)[\s\S]*useLucky\(luckNeeded\)[\s\S]*giveStamina\(stamina, event\)[\s\S]*activate\(\)/);

const handler = getScriptHandler('death_lotus');
assert.equal(handler?.handlerId, 'death_lotus');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const data = byId.get('death_lotus');
assert.ok(data);
const piece = {
  itemId: 'death_lotus',
  placementKey: 'lotus',
  name: 'Death Lotus',
  kind: 'consumable',
  side: 'you',
  alive: true,
  params: data.params,
  cooldown: data.cooldown,
  baseCooldown: data.cooldown,
  speedScale: 0,
};
const darkOne = { itemId: 'dark_lantern', placementKey: 'dark-one', side: 'you' };
const darkTwo = { itemId: 'darksaber', placementKey: 'dark-two', side: 'you' };
const nonDark = { itemId: 'banana', placementKey: 'food', side: 'you' };
const graph = {
  pieces: new Map([
    ['lotus', { key: 'lotus', id: 'death_lotus', affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
      { cell: '3,0', color: 'primary' },
    ] }],
    ['dark-one', { key: 'dark-one', id: 'dark_lantern', affectCells: [] }],
    ['dark-two', { key: 'dark-two', id: 'darksaber', affectCells: [] }],
    ['food', { key: 'food', id: 'banana', affectCells: [] }],
  ]),
  filled: new Map([
    ['1,0', 'dark-one'],
    ['2,0', 'dark-two'],
    ['3,0', 'food'],
  ]),
};
const itemsById = new Map([
  ['death_lotus', data],
  ['dark_lantern', byId.get('dark_lantern')],
  ['darksaber', byId.get('darksaber')],
  ['banana', byId.get('banana')],
]);
const player = createActor('player');
const dummy = createActor('dummy');
player.stamina = 3;
const events = [];
const ctx = {
  player,
  dummy,
  events,
  t: 5,
  rng: () => 0,
  graph,
  itemsById,
  pieces: [piece, darkOne, darkTwo, nonDark],
};
ctx.canAffect = canAffect;

handler.onPrepare(piece, ctx);
assert.equal(piece.speedScale, data.params.speed / 100 * 2, 'only linked Dark items receive the source speed bonus');

grantStacks(player, 'lucky', 2);
grantStacks(dummy, 'lucky', 2);
grantStacks(dummy, 'heat', 2);
const staminaBefore = player.stamina;
const handled = handler.onCooldownEffect(piece, ctx);
assert.equal(handled, true);
assert.equal(player.stacks.mana, data.params.mana, 'the source Mana grant is preserved');
assert.equal(player.stacks.lucky, 1, 'the source Lucky spend occurs when the threshold is met');
assert.equal(dummy.stacks.lucky + dummy.stacks.heat, 1, 'the source removes exactly the requested opponent buffs');
assert.equal(player.stamina, staminaBefore + data.params.stamina, 'the source grants fractional Stamina after spending Lucky');
assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'death_lotus'));

const zeroPiece = { ...piece, params: { ...data.params, mana: 0, p1: 0, buffs: 0, p2: 0, luckt: 0, p3: 0 } };
const manaBeforeZero = player.stacks.mana;
const luckyBeforeZero = player.stacks.lucky;
const dummyBuffsBeforeZero = dummy.stacks.lucky + dummy.stacks.heat;
handler.onCooldownEffect(zeroPiece, { ...ctx, t: 6 });
assert.equal(player.stacks.mana, manaBeforeZero, 'zero source Mana does not invent a grant');
assert.equal(player.stacks.lucky, luckyBeforeZero, 'zero source Lucky threshold does not spend a stack');
assert.equal(dummy.stacks.lucky + dummy.stacks.heat, dummyBuffsBeforeZero, 'zero source buff removal does nothing');

console.log('OK Death Lotus source port');
