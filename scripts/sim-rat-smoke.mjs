import assert from 'node:assert/strict';
import fs from 'node:fs';

import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Rat.gd', 'utf8');
const baseSource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ForestFriend.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-am-pets.js', 'utf8');
const ratPort = port.slice(
  port.indexOf('export const ratPort'),
  port.indexOf('/** PoisonFrog.gd', port.indexOf('export const ratPort')),
);

assert.equal(canAffectRules.byId.rat?.file, 'Exclusive/Rat.gd');
assert.match(baseSource, /func combatStart\(\):[\s\S]*getNumAffectedItems\(\)[\s\S]*addSpeed\(numAffected \* getP1\(\) \/ 100\.0\)/);
assert.match(source, /descriptor\.minDam[\s\S]*dealEffectDamage\(dam\)[\s\S]*rollChance\(\)[\s\S]*inflictPoison\(poison[\s\S]*rollChance2\(\)[\s\S]*inflictBlind\(blind[\s\S]*activate\(res\)/);
assert.match(ratPort, /onCombatStart\(piece, ctx\)/);
assert.match(ratPort, /getPName\(piece\.params, 'petspeed', getP1\(piece\.params, 0\)\)/);
assert.match(ratPort, /const raw = Number\.isFinite\(Number\(catalog\?\.damageMin\)\)/);
assert.match(ratPort, /rollItemChance2\(piece, ctx\.rng\)/);
assert.match(ratPort, /petActivate\(piece, ctx, 'rat'\);\n    return true/);
assert(
  ratPort.indexOf('petActivate(piece, ctx, \'rat\')') >
    ratPort.indexOf('rollItemChance2(piece, ctx.rng)'),
  'Rat activation follows both conditional effects',
);

function probe(id, type, placementKey, cell) {
  const item = { id, name: id, type, shape: [[1]] };
  byId.set(id, item);
  return {
    ...item,
    itemId: id,
    placementKey,
    cells: [cell],
    alive: true,
  };
}

const rat = {
  ...structuredClone(byId.get('rat')),
  itemId: 'rat',
  placementKey: 'rat',
  cells: ['rat-cell'],
  alive: true,
  damageMin: 5,
  chance: 75,
  chance2: 10,
};
const pet = probe('probe-pet', 'Pet', 'pet', 'pet-cell');
const food = probe('probe-food', 'Food', 'food', 'food-cell');
const unrelated = probe('probe-accessory', 'Accessory', 'unrelated', 'unrelated-cell');
const graph = {
  pieces: new Map([
    ['rat', {
      key: 'rat',
      id: 'rat',
      cells: rat.cells,
      affectCells: [
        { cell: 'pet-cell', color: 'primary' },
        { cell: 'food-cell', color: 'primary' },
        { cell: 'unrelated-cell', color: 'primary' },
      ],
    }],
    ...[pet, food, unrelated].map((piece) => [piece.placementKey, {
      key: piece.placementKey,
      id: piece.itemId,
      cells: piece.cells,
      affectCells: [],
    }]),
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
const ctx = {
  player,
  dummy,
  pieces: [rat, pet, food, unrelated],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  t: 4,
  rng: () => 0,
};
const handler = getScriptHandler('rat');
assert.equal(handler?.handlerId, 'rat');

handler.onCombatStart(rat, ctx);
assert.equal(rat.speedScale, 0.3, 'Forest Friend speed counts affected Pet and Food only');

handler.onCooldownEffect(rat, ctx);
assert.equal(dummy.hp, 1195, 'Rat deals descriptor minimum effect damage');
assert.equal(dummy.stacks.poison, 1, 'chance roll applies named poison amount');
assert.equal(dummy.stacks.blind, 1, 'chance2 roll applies named blind amount');
assert.equal(events.at(-1)?.type, 'activate', 'Rat activates after damage and debuffs');
assert.equal(events.at(-1)?.itemId, 'rat');
const damageIndex = events.findIndex((event) => event.type === 'damage' && event.itemId === 'rat');
const activationIndex = events.findIndex((event) => event.type === 'activate' && event.itemId === 'rat');
assert(damageIndex >= 0 && damageIndex < activationIndex, 'damage precedes activation');

const sparse = {
  ...rat,
  params: {},
  placementKey: 'rat-sparse',
  chance: 100,
  chance2: 100,
};
const sparsePlayer = createActor('player');
const sparseDummy = createActor('dummy');
const sparseEvents = [];
const sparseCtx = { ...ctx, player: sparsePlayer, dummy: sparseDummy, events: sparseEvents };
handler.onCooldownEffect(sparse, sparseCtx);
assert.equal(sparseDummy.hp, 1195, 'sparse parameters retain source descriptor damage');
assert.equal(Number(sparseDummy.stacks.poison) || 0, 0, 'missing poison parameter does not invent a stack');
assert.equal(Number(sparseDummy.stacks.blind) || 0, 0, 'missing blind parameter does not invent a stack');

console.log('OK Rat source and handler regression');
