import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Eggscalibur.gd', 'utf8');
assert.match(source, /extends \"res:\/\/Items\/Pan\.gd\"/);
assert.match(source, /func onDealtDamage\(damageRes: DamageResult\):[\s\S]*tryUseMana\(getP2\(\), damageRes\.event\)/);
assert.match(source, /var affected = getAffectedItems\(\)[\s\S]*affected\.shuffle\(\)[\s\S]*for food in affected:[\s\S]*food\.doCooldownEffect\(\)/);

const handler = getScriptHandler('eggscalibur');
assert.equal(typeof handler?.onDealtDamage, 'function', 'Eggscalibur exposes the source onDealtDamage hook');

const egg = {
  itemId: 'eggscalibur',
  placementKey: 'you:egg',
  name: 'Eggscalibur',
  params: { p2: 2 },
  kind: 'weapon',
  staminaCost: 1,
};
const berries = {
  itemId: 'blueberries',
  placementKey: 'you:berries',
  name: 'Blueberries',
  params: { p1: 0, p2: 10, p3: 1 },
  kind: 'food',
};
const banana = {
  itemId: 'banana',
  placementKey: 'you:banana',
  name: 'Banana',
  params: { p1: 1, p2: 1 },
  kind: 'food',
};
const armor = {
  itemId: 'leather_armor',
  placementKey: 'you:armor',
  name: 'Leather Armor',
  kind: 'armor',
};

const itemsById = new Map([
  [egg.itemId, { id: egg.itemId, type: 'Melee Weapon' }],
  [berries.itemId, { id: berries.itemId, type: 'Food' }],
  [banana.itemId, { id: banana.itemId, type: 'Food' }],
  [armor.itemId, { id: armor.itemId, type: 'Armor' }],
]);
const graph = {
  pieces: new Map([
    [egg.placementKey, { key: egg.placementKey, id: egg.itemId, cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
      { cell: '3,0', color: 'primary' },
    ] }],
    [berries.placementKey, { key: berries.placementKey, id: berries.itemId, cells: ['1,0'], affectCells: [] }],
    [banana.placementKey, { key: banana.placementKey, id: banana.itemId, cells: ['2,0'], affectCells: [] }],
    [armor.placementKey, { key: armor.placementKey, id: armor.itemId, cells: ['3,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', egg.placementKey],
    ['1,0', berries.placementKey],
    ['2,0', banana.placementKey],
    ['3,0', armor.placementKey],
  ]),
};
const canAffect = {
  rulesById: { eggscalibur: { primary: { op: 'hasType', type: 'Food' } } },
};

function makeContext(piece = egg, mana = 3) {
  return {
    t: 1,
    rng: () => 0,
    graph,
    itemsById,
    canAffect,
    pieces: [piece, berries, banana, armor],
    player: {
      id: 'you',
      hp: 8,
      maxHp: 20,
      stamina: 4,
      maxStamina: 10,
      stacks: { mana, lucky: 0, poison: 0, blind: 0 },
    },
    dummy: { id: 'them', hp: 20, maxHp: 20, stacks: {} },
    events: [],
  };
}

const ctx = makeContext();
handler.onDealtDamage(egg, ctx, { hit: true });
assert.equal(ctx.player.stacks.mana, 1, 'a hit spends exactly the source P2 mana cost');
assert.deepEqual(
  ctx.events.filter((event) => event.type === 'activate').map((event) => event.itemId).sort(),
  ['banana', 'blueberries'],
  'a successful mana spend cooldowns every linked Food and no non-Food item',
);

const missCtx = makeContext();
handler.onDealtDamage(egg, missCtx, { hit: false });
assert.equal(missCtx.player.stacks.mana, 3, 'a miss does not spend mana');
assert.equal(missCtx.events.some((event) => event.type === 'activate'), false, 'a miss does not cooldown linked food');

const shortCtx = makeContext(egg, 1);
handler.onDealtDamage(egg, shortCtx, { hit: true });
assert.equal(shortCtx.player.stacks.mana, 1, 'insufficient mana is not spent');
assert.equal(shortCtx.events.some((event) => event.type === 'activate'), false, 'insufficient mana does not cooldown linked food');

const zeroEgg = { ...egg, params: { p2: 0 }, placementKey: 'you:egg-zero' };
const zeroCtx = makeContext(zeroEgg, 1);
zeroCtx.graph = {
  ...graph,
  pieces: new Map([
    [zeroEgg.placementKey, { ...graph.pieces.get(egg.placementKey), key: zeroEgg.placementKey, id: zeroEgg.itemId }],
    [berries.placementKey, graph.pieces.get(berries.placementKey)],
    [banana.placementKey, graph.pieces.get(banana.placementKey)],
    [armor.placementKey, graph.pieces.get(armor.placementKey)],
  ]),
  filled: new Map([
    ['0,0', zeroEgg.placementKey],
    ['1,0', berries.placementKey],
    ['2,0', banana.placementKey],
    ['3,0', armor.placementKey],
  ]),
};
handler.onDealtDamage(zeroEgg, zeroCtx, { hit: true });
assert.equal(zeroCtx.player.stacks.mana, 1, 'a typed zero P2 remains zero');
assert.equal(zeroCtx.events.some((event) => event.type === 'activate'), false, 'a zero mana spend has no source spend event');

console.log('OK Eggscalibur source port');
