import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Shelly.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b-heal.js', 'utf8');
const shellyPort = port.slice(
  port.indexOf('export const shellyPort'),
  port.indexOf('/** ShinyShell.gd', port.indexOf('export const shellyPort')),
);

assert.match(source, /extends Item/);
assert.match(source, /onready var cleanses: = int\(getP\("debuffs"\)\)/);
assert.match(source, /onready var potionSpeed: = getP\("speed"\) \/ 100\.0/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Potion\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*cleanseRandomDebuffs\(cleanses\)[\s\S]*heal\(\)[\s\S]*activate\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*changeDebuffProtectionChance\( - getChance\(\)\)[\s\S]*addSpeed\(potionSpeed \* getNumAffectedItems\(\)/);
assert.match(shellyPort, /onPrepare\(piece, ctx\)/);
assert.match(shellyPort, /countLinkedType\(ctx, piece, 'potion'\)/);
assert.match(shellyPort, /Math\.trunc\(getPName\(piece\.params, 'debuffs', getP1\(/);
assert.match(shellyPort, /getPName\(piece\.params, 'speed', getP3\(/);
assert.match(shellyPort, /cleanseRandomDebuffs/);
assert.match(shellyPort, /pushActivate/);
assert.doesNotMatch(shellyPort, /onCombatStart\(piece, ctx\)/);

const itemsById = new Map([
  ['shelly', { id: 'shelly', type: 'Pet', chance: 25 }],
  ['health_potion', { id: 'health_potion', type: 'Potion' }],
  ['wooden_sword', { id: 'wooden_sword', type: 'Weapon' }],
]);
const piece = {
  itemId: 'shelly',
  placementKey: 'shelly',
  name: 'Shelly',
  kind: 'pet',
  chance: 25,
  params: { debuffs: 2.9, p1: 7, heal: 7, p2: 4, speed: 18, p3: 3 },
  speedScale: 0,
};
const potion = { itemId: 'health_potion', placementKey: 'potion', name: 'Health Potion' };
const nonPotion = { itemId: 'wooden_sword', placementKey: 'sword', name: 'Wooden Sword' };
const player = createActor('player', { maxHp: 100 });
player.hp = 50;
grantStacks(player, 'poison', 2);
grantStacks(player, 'blind', 1);
const ctx = {
  t: 13,
  player,
  dummy: createActor('dummy'),
  events: [],
  pieces: [piece, potion, nonPotion],
  itemsById,
  graph: {
    pieces: new Map([
      [piece.placementKey, {
        key: piece.placementKey,
        id: 'shelly',
        cells: ['0,0'],
        affectCells: [
          { cell: '1,0', color: 'primary' },
          { cell: '2,0', color: 'primary' },
        ],
      }],
      ['potion', { key: 'potion', id: 'health_potion', cells: ['1,0'], affectCells: [] }],
      ['sword', { key: 'sword', id: 'wooden_sword', cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([
      ['1,0', 'potion'],
      ['2,0', 'sword'],
    ]),
  },
  canAffect: {
    rulesById: {
      shelly: { primary: { op: 'hasType', type: 'Potion' } },
    },
  },
  rng: () => 0,
};

const handler = getScriptHandler('shelly');
assert.equal(handler?.handlerId, 'shelly');
handler.onPrepare(piece, ctx);
assert.equal(piece.speedScale, 0.18, 'only the linked Potion receives the named speed bonus');
assert.equal(player.debuffCleanseProtectChance, -25, 'Shelly applies the source cleanse-protection change');

handler.onCooldownEffect(piece, ctx);
assert.equal(player.stacks.poison, 0, 'the integer-truncated cleanse count removes two debuffs');
assert.equal(player.stacks.blind, 0, 'negative cleanse protection can remove the second debuff as the source does');
assert.equal(player.hp, 57, 'Shelly heals with the named heal parameter');
const healIndex = ctx.events.findIndex((event) => event.type === 'heal');
const activationIndex = ctx.events.findIndex((event) => event.type === 'activate');
assert.ok(healIndex >= 0 && activationIndex > healIndex, 'Shelly activates after cleansing and healing');

console.log('OK Shelly source and handler regression');
