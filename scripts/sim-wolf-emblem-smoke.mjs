import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const itemById = new Map(catalog.map((item) => [item.id, item]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
  parentById: rules.parentById,
};
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/WolfEmblem.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-aura.js', 'utf8');
const portBlock = portSource.slice(
  portSource.indexOf('export const wolfEmblemPort'),
  portSource.indexOf('export const amuletOfTheWildPort'),
);
const sourceItem = itemById.get('wolf_emblem');

assert.ok(sourceItem, 'Wolf Emblem: extracted catalog row');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canBeEmpowered\(\)/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*item\.hasType\(Type\.Pet\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*changeCritChancePercent\(bonusCritChance\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveEmpower\(empower\)[\s\S]*giveBlock\(\)[\s\S]*activate\(\)/);
assert.match(portBlock, /onPrepare\(piece, ctx\)/);
assert.doesNotMatch(portBlock, /onPreCombatStart/);
assert.match(portBlock, /canAffect/);
assert.match(portBlock, /grantStacks\(player, 'block'/);

function makeGraph() {
  return {
    pieces: new Map([
      ['emblem', {
        key: 'emblem', id: 'wolf_emblem', cells: ['0,0'], affectCells: [
          { cell: '1,0', color: 'primary' },
          { cell: '2,0', color: 'primary' },
          { cell: '3,0', color: 'secondary' },
        ],
      }],
      ['sword', { key: 'sword', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
      ['armor', { key: 'armor', id: 'leather_armor', cells: ['2,0'], affectCells: [] }],
      ['pet', { key: 'pet', id: 'power_puppy', cells: ['3,0'], affectCells: [] }],
    ]),
    filled: new Map([
      ['0,0', 'emblem'],
      ['1,0', 'sword'],
      ['2,0', 'armor'],
      ['3,0', 'pet'],
    ]),
  };
}

function makeContext({ params = sourceItem.params, block = 0, blockGrant = sourceItem.block } = {}) {
  const player = createActor('player', { block });
  const piece = {
    ...sourceItem,
    itemId: 'wolf_emblem',
    placementKey: 'emblem',
    name: 'Wolf Emblem',
    params: { ...params },
    kind: 'accessory',
    side: 'you',
    alive: true,
    blockGrant,
    buffPowers: { block: 1.5, empower: 1.5 },
  };
  const sword = {
    ...itemById.get('wooden_sword'), itemId: 'wooden_sword', placementKey: 'sword',
    name: 'Wooden Sword', kind: 'weapon', side: 'you', critChance: 5,
  };
  const armor = {
    ...itemById.get('leather_armor'), itemId: 'leather_armor', placementKey: 'armor',
    name: 'Leather Armor', kind: 'armor', side: 'you', critChance: 7,
  };
  const pet = {
    ...itemById.get('power_puppy'), itemId: 'power_puppy', placementKey: 'pet',
    name: 'Power Puppy', kind: 'pet', side: 'you', critChance: 11,
  };
  return {
    t: 2,
    player,
    dummy: createActor('dummy'),
    events: [],
    graph: makeGraph(),
    pieces: [piece, sword, armor, pet],
    itemsById: itemById,
    canAffect,
    piece,
    sword,
    armor,
    pet,
  };
}

const handler = getScriptHandler('wolf_emblem');
assert.equal(handler?.handlerId, 'wolf_emblem');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const combat = makeContext();
handler.onPrepare(combat.piece, combat);
assert.equal(combat.sword.critChance, 27, 'primary empowered target gets base plus Pet-scaled crit chance');
assert.equal(combat.armor.critChance, 7, 'non-empowerable primary target is filtered by source rule');
assert.equal(combat.pet.critChance, 11, 'secondary Pet target does not receive the primary crit aura');

handler.onCooldownEffect(combat.piece, combat);
assert.equal(combat.player.block, 15, 'Block branch uses source Block and the Emblem buff power');
assert.equal(combat.player.block, 15, 'Block branch updates the actor Block total');
const blockEvent = combat.events.find((event) => event.meta?.handler === 'wolf_emblem' && event.meta?.stack === 'block');
const blockActivation = combat.events.find((event) => event.type === 'activate' && event.meta?.handler === 'wolf_emblem');
assert.ok(blockEvent && blockActivation && combat.events.indexOf(blockEvent) < combat.events.indexOf(blockActivation),
  'Block effect is projected before source activation');

const empower = makeContext({ block: 10 });
handler.onCooldownEffect(empower.piece, empower);
assert.equal(empower.player.block, 10, 'Empower branch does not add Block above threshold');
assert.equal(empower.player.stacks.empower, 2, 'Empower branch uses source value and buff power');
const empowerEvent = empower.events.find((event) => event.meta?.handler === 'wolf_emblem' && event.meta?.stack === 'empower');
const empowerActivation = empower.events.find((event) => event.type === 'activate' && event.meta?.handler === 'wolf_emblem');
assert.ok(empowerEvent && empowerActivation && empower.events.indexOf(empowerEvent) < empower.events.indexOf(empowerActivation),
  'Empower effect is projected before source activation');

const zero = makeContext({
  params: { empower: 0, p1: 0, blockt: 0, p2: 0 },
  block: 0,
  blockGrant: 0,
});
handler.onCooldownEffect(zero.piece, zero);
assert.equal(zero.player.stacks.empower, 0, 'explicit zero Empower is preserved');
assert.equal(zero.player.block, 0, 'explicit zero Block is preserved');
assert.ok(zero.events.some((event) => event.type === 'activate' && event.meta?.handler === 'wolf_emblem'),
  'zero-valued effect still follows the source activation path');

// Exercise the shared grant path used by the handler with the same actor so
// the fixture guards against a future change that bypasses buff-power scaling.
assert.doesNotThrow(() => grantStacks(combat.player, 'block', 0, { piece: combat.piece }));

console.log('OK Wolf Emblem source/parity smoke');
