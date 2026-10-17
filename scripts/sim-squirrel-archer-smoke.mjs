import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/SquirrelArcher.gd',
  'utf8',
);
const parentSource = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/ForestFriend.gd',
  'utf8',
);
const portSource = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-ap-basic.js',
  'utf8',
);
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const sourceItem = catalog.find((item) => item.id === 'squirrel_archer');
const petItem = catalog.find((item) => item.id === 'cat_spirit');
const foodItem = catalog.find((item) => item.id === 'banana');

assert.ok(sourceItem && petItem && foodItem, 'Squirrel Archer: extracted catalog rows');
assert.match(source, /extends "res:\/\/Items\/Exclusive\/Squirrel\.gd"/);
assert.match(source, /func onPreDealDamage_early\(damageRes[^)]*\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*stealRandomBuff\(1\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*useStamina\(\)[\s\S]*dealDamage\(\)[\s\S]*activate\(res\)/);
assert.match(parentSource, /func combatStart\(\):[\s\S]*getNumAffectedItems\(\)[\s\S]*addSpeed\(numAffected \* getP1\(\) \/ 100\.0\)/);

const port = portSource.match(/const squirrelArcherPort = \{[\s\S]*?\n\};/u)?.[0] || '';
assert.match(port, /onCombatStart\(piece, ctx\)/);
assert.match(port, /onPreDealDamageEarly\(res\)/);
assert.doesNotMatch(port, /afterHit\(hit\)/);
assert.ok(getScriptHandler('squirrel_archer'), 'Squirrel Archer handler is registered');

const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  rarityRank: rules.rarityRank,
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
};
const graph = {
  pieces: new Map([
    ['archer', {
      key: 'archer',
      id: 'squirrel_archer',
      affectCells: [
        { cell: 'pet-cell', color: 'primary' },
        { cell: 'food-cell', color: 'primary' },
      ],
      cells: [],
    }],
    ['pet', { key: 'pet', id: 'cat_spirit', affectCells: [], cells: ['pet-cell'] }],
    ['food', { key: 'food', id: 'banana', affectCells: [], cells: ['food-cell'] }],
  ]),
  filled: new Map([
    ['pet-cell', 'pet'],
    ['food-cell', 'food'],
  ]),
};
const piece = {
  itemId: 'squirrel_archer',
  placementKey: 'archer',
  name: 'Squirrel Archer',
  kind: 'weapon',
  side: 'you',
  alive: true,
  params: { ...sourceItem.params },
  speedScale: 0,
  damageMin: sourceItem.damageMin,
  damageMax: sourceItem.damageMax,
  damageKind: 'ranged',
  accuracy: 100,
  staminaCost: 0,
  chance: 0,
  chanceTag: null,
  bonusDamage: 0,
  damageBonus: 0,
  bonusDamageFactor: 1,
  vampiric: false,
};
const player = createActor('player');
const dummy = createActor('dummy');
dummy.stacks.lucky = 2;
const events = [];
const pet = { itemId: 'cat_spirit', placementKey: 'pet', kind: 'pet', side: 'you' };
const food = { itemId: 'banana', placementKey: 'food', kind: 'consumable', side: 'you' };
let lateLucky = null;
const ctx = {
  t: 2,
  player,
  dummy,
  events,
  graph,
  pieces: [piece, pet, food],
  itemsById: new Map([
    ['squirrel_archer', sourceItem],
    ['cat_spirit', petItem],
    ['banana', foodItem],
  ]),
  canAffect,
  rng: () => 0,
  bus: { emit() {} },
  notifyPreDealDamageLate() {
    lateLucky = dummy.stacks.lucky;
  },
};
const handler = getScriptHandler('squirrel_archer');

handler.onCombatStart(piece, ctx);
assert.equal(piece.speedScale, 0.3, 'inherited Forest Friend speed scales per linked Pet and Food');

handler.onCooldownEffect(piece, ctx);
assert.equal(dummy.stacks.lucky, 1, 'hit steals one buff stack from the opponent');
assert.equal(player.stacks.lucky, 1, 'hit gives the stolen buff to the player');
assert.equal(lateLucky, 1, 'early hit hook steals before the late damage hook');
assert.equal(events.at(-1)?.type, 'activate', 'weapon activates after its damage result');

console.log('OK Squirrel Archer source/parity smoke');
