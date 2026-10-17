import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Squirrel.gd', 'utf8');
const parentSource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ForestFriend.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-pet.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const sourceItem = catalog.find((item) => item.id === 'squirrel');
const petItem = catalog.find((item) => item.id === 'cat_spirit');
const foodItem = catalog.find((item) => item.id === 'banana');
const unrelatedItem = catalog.find((item) => item.id === 'stone');

assert.ok(sourceItem && petItem && foodItem && unrelatedItem, 'Squirrel: extracted catalog rows');
assert.match(source, /extends "res:\/\/Items\/Exclusive\/ForestFriend\.gd"/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*stealRandomBuff\(1\)[\s\S]*activate\(\)/);
assert.match(parentSource, /func canAffect\(item\):[\s\S]*Type\.Pet[\s\S]*Type\.Food/);
assert.match(parentSource, /func combatStart\(\):[\s\S]*getNumAffectedItems\(\)[\s\S]*addSpeed\(numAffected \* getP1\(\) \/ 100\.0\)/);

const port = portSource.match(/export const squirrelPort = \{[\s\S]*?\n\};/u)?.[0] || '';
assert.match(port, /onCombatStart\(piece, ctx\)/);
assert.match(port, /addSpeed\(piece/);
assert.ok(
  port.indexOf('stealRandomBuff(') < port.indexOf('pushActivate('),
  'Squirrel activates after the source buff steal',
);

const handler = getScriptHandler('squirrel');
assert.equal(handler?.handlerId, 'squirrel');

const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
};
const piece = {
  itemId: 'squirrel',
  placementKey: 'squirrel',
  name: 'Squirrel',
  kind: 'pet',
  side: 'you',
  alive: true,
  params: { ...sourceItem.params },
  speedScale: 0,
};
const pet = { itemId: 'cat_spirit', placementKey: 'pet', kind: 'pet', side: 'you' };
const food = { itemId: 'banana', placementKey: 'food', kind: 'consumable', side: 'you' };
const unrelated = { itemId: 'stone', placementKey: 'unrelated', kind: 'passive', side: 'you' };
const graph = {
  pieces: new Map([
    ['squirrel', {
      key: 'squirrel',
      id: 'squirrel',
      affectCells: [
        { cell: 'pet-cell', color: 'primary' },
        { cell: 'food-cell', color: 'primary' },
        { cell: 'unrelated-cell', color: 'primary' },
      ],
      cells: [],
    }],
    ['pet', { key: 'pet', id: 'cat_spirit', affectCells: [], cells: ['pet-cell'] }],
    ['food', { key: 'food', id: 'banana', affectCells: [], cells: ['food-cell'] }],
    ['unrelated', { key: 'unrelated', id: 'stone', affectCells: [], cells: ['unrelated-cell'] }],
  ]),
  filled: new Map([
    ['pet-cell', 'pet'],
    ['food-cell', 'food'],
    ['unrelated-cell', 'unrelated'],
  ]),
};
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
grantStacks(dummy, 'lucky', 3, { originKey: 'dummy', originId: 'dummy' });
const ctx = {
  t: 1,
  player,
  dummy,
  events,
  graph,
  pieces: [piece, pet, food, unrelated],
  itemsById: new Map([
    ['squirrel', sourceItem],
    ['cat_spirit', petItem],
    ['banana', foodItem],
    ['stone', unrelatedItem],
  ]),
  canAffect,
  rng: () => 0,
};

handler.onCombatStart(piece, ctx);
assert.equal(piece.speedScale, 0.3, 'Forest Friend speed scales per linked Pet and Food');

handler.onCooldownEffect(piece, ctx);
assert.equal(dummy.stacks.lucky, 2, 'Squirrel steals one buff stack from the opponent');
assert.equal(player.stacks.lucky, 1, 'Squirrel gives the stolen buff to the player');
assert.equal(events.at(-1)?.type, 'activate', 'Squirrel activates after stealing');

console.log('OK Squirrel source/parity smoke');
