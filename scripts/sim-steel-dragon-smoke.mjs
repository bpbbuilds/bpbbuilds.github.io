import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SteelDragon.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b-aura.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const steelDragonPort'),
  handlerSource.indexOf('/** VillainSword.gd', handlerSource.indexOf('export const steelDragonPort')),
);

assert.equal(inventory.byId.steel_dragon?.file, 'Exclusive/SteelDragon.gd');
assert.equal(inventory.byId.steel_dragon?.extends, 'Weapon');
assert.deepEqual(
  inventory.byId.steel_dragon?.overrides,
  ['onCombatStart', 'onPreCombatStart', 'onPrepare'],
);
assert.match(source, /^extends Weapon/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canBeEmpowered\(\) or item\.canBlock\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*giveBuffPower\(Game\.EventType\.Block, blockFactor\)/);
assert.match(source, /func onPreCombatStart\(\):[\s\S]*giveReflectStacks\(reflectStacks\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*item\.addBonusDamage\(dam\)[\s\S]*activate\(null, false\)/);
assert.match(portBlock, /onPrepare\(piece, ctx\)/);
assert.match(portBlock, /giveBuffPower\(o, 'block'/);
assert.match(portBlock, /onPreCombatStart\(piece, ctx\)/);
assert.match(portBlock, /changeReflectStacks\(ctx\.player/);
assert.match(portBlock, /onCombatStart\(piece, ctx\)/);
assert.match(portBlock, /pushActivate\(piece, ctx, 'steel_dragon'/);
assert.doesNotMatch(portBlock, /o\.blockGrant =/);

const piece = (id, placementKey, overrides = {}) => ({
  ...byId.get(id),
  itemId: id,
  placementKey,
  name: byId.get(id)?.name || id,
  params: byId.get(id)?.params || {},
  alive: true,
  kind: id === 'steel_dragon' ? 'weapon' : id === 'wooden_sword' ? 'weapon' : 'passive',
  damageMin: Number(byId.get(id)?.damageMin) || 0,
  damageMax: Number(byId.get(id)?.damageMax) || 0,
  blockGrant: Number(byId.get(id)?.block) || 0,
  ...overrides,
});

const steel = piece('steel_dragon', 'steel', {
  params: { reflect: 8, p1: 8, dam: 6, p2: 6, blockfactor: 40, p3: 40 },
});
const sword = piece('wooden_sword', 'sword', { kind: 'weapon' });
const garlic = piece('garlic', 'garlic', { kind: 'passive' });
const pet = piece('squirrel', 'pet', { kind: 'pet', damageMax: 10 });
const graph = {
  pieces: new Map([
    ['steel', { key: 'steel', id: 'steel_dragon', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
      { cell: '3,0', color: 'primary' },
    ] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
    ['garlic', { key: 'garlic', id: 'garlic', cells: ['2,0'], affectCells: [] }],
    ['pet', { key: 'pet', id: 'squirrel', cells: ['3,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['1,0', 'sword'],
    ['2,0', 'garlic'],
    ['3,0', 'pet'],
  ]),
};
const player = createActor('player');
const events = [];
const ctx = {
  player,
  pieces: [steel, sword, garlic, pet],
  graph,
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  t: 2,
  combatStartSeq: 0,
};

const handler = getScriptHandler('steel_dragon');
assert.equal(handler?.handlerId, 'steel_dragon');
handler.onPrepare(steel, ctx);
assert.equal(garlic.buffPowers.block, 1.4, 'blockfactor is a Block buff-power increase');
assert.equal(sword.buffPowers, undefined, 'prepare does not add Block power to weapons');
assert.equal(garlic.blockGrant, 3, 'prepare does not mutate static block');

handler.onPreCombatStart(steel, ctx);
assert.equal(player.debuffReflectStacks, 8, 'reflect stacks are granted before combat start');
assert.ok(events.some((event) => event.meta?.stat === 'reflect_stacks'));

handler.onCombatStart(steel, ctx);
assert.equal(sword.bonusDamage, 6, 'weapon targets receive the start damage bonus');
assert.equal(garlic.bonusDamage, 6, 'all source-accepted affected items receive addBonusDamage');
assert.equal(pet.bonusDamage || 0, 0, 'pets are not canBeEmpowered targets');
assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'steel_dragon'));

console.log('OK Steel Dragon source, canAffect predicates, Block power, pre-combat reflect, start damage aura, and activation regression');
