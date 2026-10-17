import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { gainStacks } from '../js/pages/sim/engine/stacks.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/HolyArmor.gd', 'utf8');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const data = byId.get('holy_armor');

assert.equal(inventory.byId.holy_armor?.file, 'HolyArmor.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Holy\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveBlock\(\)[\s\S]*getNumAffectedItems\(\)[\s\S]*giveRegeneration\(numAffected \* getP1\(\)[\s\S]*activate\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*cleansePoison\(getP2\(\)\)[\s\S]*activate\(\)/);
assert.equal(getScriptHandler('holy_armor')?.handlerId, 'holy_armor');

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.displayName || item?.name || id,
    params: { ...(item?.params || {}) },
    kind: id === 'holy_armor' ? 'armor' : 'weapon',
    side: 'you',
    alive: true,
    blockGrant: item?.block || 0,
    ...overrides,
  };
}

const armor = piece('holy_armor', 'armor');
const holySpear = piece('holy_spear', 'holy-spear');
const woodenSword = piece('wooden_sword', 'sword');
const graph = {
  pieces: new Map([
    ['armor', { key: 'armor', id: 'holy_armor', cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }] }],
    ['holy-spear', { key: 'holy-spear', id: 'holy_spear', cells: ['1,0'], affectCells: [] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: ['2,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'armor'],
    ['1,0', 'holy-spear'],
    ['2,0', 'sword'],
  ]),
};
const player = createActor('player', { maxHp: 200 });
const dummy = createActor('dummy', { maxHp: 200 });
const events = [];
const ctx = {
  player,
  dummy,
  events,
  t: 5,
  pieces: [armor, holySpear, woodenSword],
  graph,
  itemsById: byId,
  canAffect: { rulesById: rules.byId },
};
const handler = getScriptHandler('holy_armor');
handler.onCombatStart(armor, ctx);
assert.equal(player.block, 65, 'Holy Armor gives source catalog Block');
assert.equal(player.stacks.regeneration, 2, 'Holy Armor gives regen only per affected Holy item');
const startActivation = events.findIndex((event) => event.type === 'activate' && event.itemId === armor.itemId);
assert.ok(startActivation >= 0, 'Holy Armor emits its source activation');

gainStacks(player, 'poison', 5);
ctx.t = 9;
const handled = handler.onCooldownEffect(armor, ctx);
assert.equal(handled, true);
assert.equal(player.stacks.poison, 3, 'Holy Armor cleanses exactly source p2 Poison');
const cleanseIndex = events.findIndex((event) => event.type === 'buff' && event.meta?.stack === 'poison' && event.amount === -2);
const cooldownActivation = events.findIndex((event, index) => index > startActivation && event.type === 'activate' && event.itemId === armor.itemId);
assert.ok(cleanseIndex >= 0 && cooldownActivation > cleanseIndex, 'Holy Armor activates after source cleanse');

const zero = piece('holy_armor', 'zero-armor', {
  blockGrant: 0,
  params: { regen: 0, p1: 0, cleanse: 0, p2: 0 },
});
const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroCtx = {
  ...ctx,
  player: zeroPlayer,
  events: [],
  pieces: [zero, holySpear, woodenSword],
  t: 10,
};
gainStacks(zeroPlayer, 'poison', 3);
handler.onCombatStart(zero, zeroCtx);
assert.equal(zeroPlayer.block, 0, 'Holy Armor honors explicit zero Block');
assert.equal(zeroPlayer.stacks.regeneration, 0, 'Holy Armor honors explicit zero Regeneration');
handler.onCooldownEffect(zero, zeroCtx);
assert.equal(zeroPlayer.stacks.poison, 3, 'Holy Armor honors explicit zero cleanse');

console.log('OK Holy Armor source-backed Holy filtering, Block, Regen, cleanse amount, activation order, and zero parameters');
