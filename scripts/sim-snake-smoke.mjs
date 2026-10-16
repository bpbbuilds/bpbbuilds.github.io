import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Snake.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-am-pets.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const snakePort'),
  handlerSource.indexOf('/** FireShelly.gd', handlerSource.indexOf('export const snakePort') + 1),
);

assert.equal(inventory.byId.snake?.file, 'Exclusive/Snake.gd');
assert.deepEqual(inventory.byId.snake?.overrides, ['doCooldownEffect', 'onCombatStart', 'onPrepare']);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Pet\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*character_lucky_changed/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveLucky\(numPets \* luckPerPet\)[\s\S]*giveMaxHealth\(numPets \* getP_m\("maxhealth"\)\)[\s\S]*activate\(\)/);
assert.match(source, /func onLuckyChanged\(amount, event\):[\s\S]*amount \* getChance\(\)[\s\S]*changeProtectionChance\(Game\.EventType\.Poison/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*inflictPoison\(poison\)[\s\S]*activate\(\)/);
assert.match(portBlock, /modifiedParamValue/);
assert.match(portBlock, /character_lucky_changed/);
assert.match(portBlock, /stackResist\.poison/);
assert.match(portBlock, /giveTempMaxHp/);
assert.match(portBlock, /petActivate/);
assert.doesNotMatch(portBlock, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'poison'/);

const snakeItem = byId.get('snake');
const snake = {
  ...snakeItem,
  itemId: 'snake',
  placementKey: 'snake',
  name: 'Snake',
  params: snakeItem.params,
  paramAdd: { maxhealth: 2 },
  kind: 'pet',
  side: 'you',
  alive: true,
};
const petA = {
  ...byId.get('courage_puppy'),
  itemId: 'courage_puppy',
  placementKey: 'pet-a',
  kind: 'pet',
  side: 'you',
};
const petB = {
  ...byId.get('wisdom_puppy'),
  itemId: 'wisdom_puppy',
  placementKey: 'pet-b',
  kind: 'pet',
  side: 'you',
};
const weapon = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'weapon',
  kind: 'weapon',
  side: 'you',
};
const graph = {
  pieces: new Map([
    ['snake', { key: 'snake', id: 'snake', cells: [], affectCells: [
      { cell: 'pet-a-link', color: 'primary' },
      { cell: 'pet-b-link', color: 'primary' },
      { cell: 'weapon-link', color: 'primary' },
    ] }],
    ['pet-a', { key: 'pet-a', id: 'courage_puppy', cells: [], affectCells: [] }],
    ['pet-b', { key: 'pet-b', id: 'wisdom_puppy', cells: [], affectCells: [] }],
    ['weapon', { key: 'weapon', id: 'wooden_sword', cells: [], affectCells: [] }],
  ]),
  filled: new Map([
    ['pet-a-link', 'pet-a'],
    ['pet-b-link', 'pet-b'],
    ['weapon-link', 'weapon'],
  ]),
};
const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
player._combatBus = bus;
dummy._combatBus = bus;
const events = [];
const ctx = {
  player,
  dummy,
  pieces: [snake, petA, petB, weapon],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  bus,
  t: 2,
};
const handler = getScriptHandler('snake');

assert.equal(handler?.handlerId, 'snake');
handler.onPrepare(snake, ctx);
handler.onCombatStart(snake, ctx);
assert.equal(player.stacks.lucky, 8, 'two linked pets grant source Lucky per pet');
assert.equal(player.maxHp, 280, 'getP_m max health includes placement add and fills temporary HP');
assert.equal(player.hp, 280, 'temporary max health gain fills current health');
assert.equal(dummy.stackResist.poison, 32, 'Lucky listener protects opponent Poison per Lucky');
assert.equal(events.at(-1)?.type, 'activate', 'combat-start activation follows Lucky and max-health effects');

const beforeDummyPoison = dummy.stacks.poison;
handler.onCooldownEffect(snake, ctx);
assert.equal(dummy.stacks.poison, beforeDummyPoison + 2, 'cooldown applies the source Poison amount');
assert.equal(events.at(-1)?.type, 'activate', 'Poison is applied before cooldown activation');

bus.emit('character_lucky_changed', { actor: dummy, amount: 5 });
assert.equal(dummy.stackResist.poison, 32, 'Snake ignores Lucky changes from the wrong character');

console.log('OK Snake source, Pet filtering, modified max health, Lucky poison protection, cooldown poison, and activation ordering regression');
