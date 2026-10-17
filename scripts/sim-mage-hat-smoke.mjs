import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MageHat.gd', 'utf8');
const portFile = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b.js', 'utf8');
const mageHatPort = portFile.slice(
  portFile.indexOf('export const mageHatPort'),
  portFile.indexOf('/** time_melting', portFile.indexOf('export const mageHatPort')),
);

assert.equal(inventory.byId.mage_hat?.file, 'Exclusive/MageHat.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*Rarity\.Common/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*Rarity\.Rare/);
assert.match(source, /func canAffect_tertiary\(item\):[\s\S]*Rarity\.Epic/);
assert.match(source, /getNumAffectedItems\(Affected\.Primary\)[\s\S]*giveBlock\(getBlock\(\) \* numCommon\)/);
assert.match(source, /getNumAffectedItems\(Affected\.Secondary\)[\s\S]*giveMana\(mana \* numRare\)/);
assert.match(source, /getNumAffectedItems\(Affected\.Tertiary\)[\s\S]*changeEffectDamageFactor\( - damReduction \* numEpic\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*activate\(\)/);
assert.match(mageHatPort, /linkedCount\(ctx, piece,[\s\S]*'primary'/);
assert.match(mageHatPort, /linkedCount\(ctx, piece,[\s\S]*'secondary'/);
assert.match(mageHatPort, /linkedCount\(ctx, piece,[\s\S]*'tertiary'/);
assert.match(mageHatPort, /Math\.trunc\(getPName\(piece\.params, 'mana'/);
assert.match(mageHatPort, /pushActivate\(piece, ctx, 'mage_hat'/);
assert.doesNotMatch(mageHatPort, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'mana'/);

const mageItem = { id: 'mage_hat', name: 'Mage Hat', rarity: 'Epic', type: 'Helmet', block: 10 };
const common = { id: 'common', name: 'Common', rarity: 'Common', type: 'Weapon' };
const rare = { id: 'rare', name: 'Rare', rarity: 'Rare', type: 'Weapon' };
const epic = { id: 'epic', name: 'Epic', rarity: 'Epic', type: 'Weapon' };
const wrongColorRare = { id: 'wrong_rare', name: 'Wrong Rare', rarity: 'Rare', type: 'Weapon' };
const itemsById = new Map([mageItem, common, rare, epic, wrongColorRare].map((item) => [item.id, item]));
const piece = {
  placementKey: 'mage',
  itemId: 'mage_hat',
  name: 'Mage Hat',
  kind: 'armor',
  side: 'you',
  blockGrant: 10,
  params: { mana: 4, p1: 4, damreduction: 10, p2: 10 },
};
const targets = [
  { placementKey: 'common', itemId: 'common' },
  { placementKey: 'rare', itemId: 'rare' },
  { placementKey: 'epic', itemId: 'epic' },
  { placementKey: 'wrong', itemId: 'wrong_rare' },
];
const graph = {
  pieces: new Map([
    ['mage', { key: 'mage', id: 'mage_hat', affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'secondary' },
      { cell: '3,0', color: 'tertiary' },
      { cell: '4,0', color: 'primary' },
    ] }],
    ...targets.map((target) => [target.placementKey, {
      key: target.placementKey,
      id: target.itemId,
      affectCells: [],
    }]),
  ]),
  filled: new Map([
    ['1,0', 'common'],
    ['2,0', 'rare'],
    ['3,0', 'epic'],
    ['4,0', 'wrong'],
  ]),
};

const handler = getScriptHandler('mage_hat');
assert.equal(handler?.handlerId, 'mage_hat');
assert.equal(typeof handler?.onCombatStart, 'function');

const ctx = {
  t: 0,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  graph,
  itemsById,
  pieces: [piece, ...targets],
};
handler.onCombatStart(piece, ctx);
assert.equal(ctx.player.block, 10, 'only the primary common grants one Mage Hat block package');
assert.equal(ctx.player.stacks.mana, 4, 'only the secondary rare grants one Mage Hat mana package');
assert.equal(ctx.dummy.effectDmgFactor, -0.1, 'only the tertiary epic reduces opponent effect damage by 10%');
assert.equal(ctx.events.filter((event) => event.type === 'activate' && event.meta?.handler === 'mage_hat').length, 1);
assert.match(ctx.events.find((event) => event.meta?.handler === 'mage_hat' && event.type === 'info')?.label || '', /commons 1 \/ rares 1 \/ epics 1/);

const zeroPiece = { ...piece, blockGrant: 0, params: { mana: 0, damreduction: 0 } };
const zeroCtx = {
  ...ctx,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
};
handler.onCombatStart(zeroPiece, zeroCtx);
assert.equal(zeroCtx.player.block, 0, 'zero block remains zero instead of being clamped to one');
assert.equal(zeroCtx.player.stacks.mana, 0, 'zero mana remains zero instead of being clamped to one');
assert.equal(zeroCtx.dummy.effectDmgFactor, 0, 'zero reduction remains zero');
assert.equal(zeroCtx.events.filter((event) => event.type === 'activate').length, 1, 'zero-value Mage Hat still activates at combat start');

console.log('OK Mage Hat source-backed color lanes, block/mana/effect reduction, activation, and zero-value regression');
