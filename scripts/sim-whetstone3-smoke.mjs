import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffPowerPieces, unbindBuffPowerPieces } from '../js/pages/sim/engine/buff-power.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Whetstone3.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-armor.js', 'utf8');
const canAffectSource = fs.readFileSync('js/shared/backpack-grid/can-affect.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const itemById = new Map(catalog.map((item) => [item.id, item]));
const sourceItem = itemById.get('whetstone3');

assert.ok(sourceItem, 'Whetstone3: extracted catalog row');
assert.match(source, /extends "res:\/\/Items\/Whetstone\.gd"/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canBlock\(\)[\s\S]*\.canAffect\(item\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*item\.giveBuffPower\(Game\.EventType\.Block, blockFactor\)/);
assert.match(portSource, /onPrepare\(piece, ctx\)[\s\S]*giveBuffPower\(other, 'block', factor\)/);
assert.match(portSource, /whetstonePort\.onCombatStart\(piece, ctx, canWhetstone3Target\)/);
assert.match(canAffectSource, /CAN_BLOCK_OVERRIDES/);
assert.equal(getScriptHandler('whetstone3')?.handlerId, 'whetstone3');

const canAffect = {
  rulesById: rules.byId,
  craftedIds: new Set(rules.craftedIds),
  classMasks: rules.classMasks,
  classBits: rules.classBits,
  gainedStacksById: rules.gainedStacksById,
  gainsBuffsIds: new Set(rules.gainsBuffsIds),
  parentById: rules.parentById,
};
const keys = ['sword', 'armor', 'halberd', 'burning-coal'];
const graph = {
  pieces: new Map([
    ['stone', {
      key: 'stone',
      id: 'whetstone3',
      affectCells: keys.map((key) => ({ cell: `${key}-cell`, color: 'primary' })),
      cells: [],
    }],
    ...keys.map((key) => [key, {
      key,
      id: key === 'sword' ? 'wooden_sword' : key === 'armor' ? 'leather_armor' : key === 'halberd' ? 'halberd' : 'burning_coal',
      affectCells: [],
      cells: [`${key}-cell`],
    }]),
  ]),
  filled: new Map(keys.map((key) => [`${key}-cell`, key])),
};
const piece = {
  itemId: 'whetstone3',
  placementKey: 'stone',
  name: 'Whetstone3',
  kind: 'passive',
  side: 'you',
  params: { ...sourceItem.params },
};
const sword = {
  itemId: 'wooden_sword', placementKey: 'sword', name: 'Wooden Sword', kind: 'weapon',
  damageMin: 1, damageMax: 3, blockGrant: 0, bonusDamage: 0,
};
const armor = {
  itemId: 'leather_armor', placementKey: 'armor', name: 'Leather Armor', kind: 'armor',
  damageMin: 0, damageMax: 0, blockGrant: 45, bonusDamage: 0,
};
const halberd = {
  itemId: 'halberd', placementKey: 'halberd', name: 'Halberd', kind: 'weapon',
  damageMin: 3, damageMax: 6, blockGrant: 0, bonusDamage: 0,
};
const burningCoal = {
  itemId: 'burning_coal', placementKey: 'burning-coal', name: 'Burning Coal', kind: 'gem',
  damageMin: 0, damageMax: 0, blockGrant: 12, bonusDamage: 0,
};
const pieces = [piece, sword, armor, halberd, burningCoal];
const ctx = {
  t: 0,
  player: createActor('player'),
  events: [],
  graph,
  pieces,
  itemsById: itemById,
  canAffect,
};
const handler = getScriptHandler('whetstone3');

handler.onPrepare(piece, ctx);
assert.equal(sword.buffPowers.block, 1.1, 'Whetstone3 prepares the inherited Block power on weapons');
assert.equal(armor.buffPowers.block, 1.1, 'Whetstone3 prepares the Block power on blockers');
assert.equal(halberd.buffPowers.block, 1.1, 'Whetstone3 recognizes Halberd.canBlock override');
assert.equal(burningCoal.buffPowers, undefined, 'Whetstone3 excludes Burning Coal.canBlock override');

bindBuffPowerPieces([armor]);
grantStacks(ctx.player, 'block', 10, { originKey: armor.placementKey });
unbindBuffPowerPieces();
assert.equal(ctx.player.block, 11, 'Whetstone3 applies the source Block buff power to later Block gains');

handler.onCombatStart(piece, ctx);
assert.equal(sword.bonusDamage, 2, 'Whetstone3 inherits Whetstone damage for empowerable weapons');
assert.equal(armor.bonusDamage, 2, 'Whetstone3 inherits Whetstone damage for canBlock targets');
assert.equal(halberd.bonusDamage, 2, 'Whetstone3 includes custom canBlock targets in inherited damage');
assert.equal(burningCoal.bonusDamage, 0, 'Whetstone3 does not affect Burning Coal');
assert.equal(armor.blockGrant, 45, 'Whetstone3 does not flatten Block stats at combat start');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Whetstone3 activates after inherited Whetstone damage');

console.log('OK Whetstone3 source/parity smoke');
