import assert from 'node:assert/strict';
import fs from 'node:fs';

import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/RatChef.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-pet.js', 'utf8');
const ratChefPort = port.slice(
  port.indexOf('export const ratChefPort'),
  port.indexOf('/** @type {ScriptHandler} */', port.indexOf('export const ratChefPort') + 1),
);

assert.equal(canAffectRules.byId.rat_chef?.file, 'Exclusive/RatChef.gd');
assert.match(source, /func initRat\(\):\n\s+pass/);
assert.match(source, /getAffectedItems\(\)[\s\S]*hasType\(Type\.Food\)[\s\S]*giveRegeneration\(numAffectedFood\)/);
assert.match(source, /giveStamina\(stamina\)[\s\S]*giveEmpower\(empower\)[\s\S]*activate\(\)/);
assert.match(ratChefPort, /getPName\(piece\.params, 'stamina', getP2\(piece\.params, 0\)\)/);
assert.match(ratChefPort, /getPName\(piece\.params, 'empower', getP3\(piece\.params, 0\)\)/);
assert.match(ratChefPort, /giveStamina\(player, stam\)/);
assert.match(ratChefPort, /pushBuffGrants\(events, piece, player, t, 'rat_chef'/);
assert(
  ratChefPort.indexOf("pushActivate(piece, ctx, 'rat_chef'") >
    ratChefPort.indexOf("pushBuffGrants(events, piece, player, t, 'rat_chef'"),
  'Rat Chef activation follows stamina and Empower',
);

function probe(id, type, placementKey, cell) {
  const item = { id, name: id, type, shape: [[1]] };
  byId.set(id, item);
  return { ...item, itemId: id, placementKey, cells: [cell], alive: true };
}

const chef = {
  ...structuredClone(byId.get('rat_chef')),
  itemId: 'rat_chef',
  placementKey: 'chef',
  cells: ['chef-cell'],
  alive: true,
};
const food = probe('probe-food', 'Food', 'food', 'food-cell');
const pet = probe('probe-pet', 'Pet', 'pet', 'pet-cell');
const unrelated = probe('probe-accessory', 'Accessory', 'unrelated', 'unrelated-cell');
const graph = {
  pieces: new Map([
    ['chef', {
      key: 'chef',
      id: 'rat_chef',
      cells: chef.cells,
      affectCells: [
        { cell: 'food-cell', color: 'primary' },
        { cell: 'pet-cell', color: 'primary' },
        { cell: 'unrelated-cell', color: 'primary' },
      ],
    }],
    ...[food, pet, unrelated].map((piece) => [piece.placementKey, {
      key: piece.placementKey,
      id: piece.itemId,
      cells: piece.cells,
      affectCells: [],
    }]),
  ]),
  filled: new Map([
    ['food-cell', 'food'],
    ['pet-cell', 'pet'],
    ['unrelated-cell', 'unrelated'],
  ]),
};

const player = createActor('player');
player.stamina = 3;
const dummy = createActor('dummy');
const events = [];
const ctx = {
  player,
  dummy,
  pieces: [chef, food, pet, unrelated],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  t: 6,
  rng: () => 0,
};
const handler = getScriptHandler('rat_chef');
assert.equal(handler?.handlerId, 'rat_chef');

handler.onCombatStart(chef, ctx);
assert.equal(player.stacks.regeneration, 1, 'combat start grants one Regeneration per affected Food');
assert.equal(Number(chef.speedScale) || 0, 0, 'Rat Chef override does not inherit Rat speed scaling');

handler.onCooldownEffect(chef, ctx);
assert.equal(player.stamina, 5, 'source stamina parameter uses p2 and clamps to base maximum');
assert.equal(player.stacks.empower, 1, 'source Empower parameter uses p3');
assert.equal(events.at(-1)?.type, 'activate', 'Rat Chef activates after stamina and Empower');
assert.equal(events.at(-1)?.itemId, 'rat_chef');
assert(events.some((event) => event.type === 'stamina' && event.amount === 2));
assert(events.some((event) => event.type === 'buff' && event.meta?.stack === 'empower'));

const sparse = { ...chef, params: {}, placementKey: 'chef-sparse' };
const sparsePlayer = createActor('player');
const sparseEvents = [];
const sparseCtx = { ...ctx, player: sparsePlayer, events: sparseEvents };
handler.onCooldownEffect(sparse, sparseCtx);
assert.equal(sparsePlayer.stamina, 5, 'missing stamina parameter does not fabricate a grant');
assert.equal(Number(sparsePlayer.stacks.empower) || 0, 0, 'missing Empower parameter does not fabricate a grant');
assert.equal(sparseEvents.at(-1)?.type, 'activate');

console.log('OK Rat Chef source and handler regression');
