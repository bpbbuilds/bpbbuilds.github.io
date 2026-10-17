import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MagiteccArmor.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-mana.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'magitecc_armor');

assert.ok(sourceItem, 'Magitecc Armor: extracted catalog row');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Holy\)[\s\S]*item\.hasType\(Type\.Magic\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(getNumAffectedItems\(\) \* speedPerAffected\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveBlock\(\)[\s\S]*activate\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getMana\(\) >= manaNeeded[\s\S]*cleanseRandomDebuffs\(numDebuffs, event\)[\s\S]*giveBlock\(block2, true, event\)[\s\S]*activate\(\)/);
assert.match(port, /handlerId: 'magitecc_armor'/);
assert.match(port, /affectedTargets\(graph, piece\.placementKey, itemsById, canAffect\)/);

const holyItem = { id: 'holy_target', type: 'Armor', extraTypes: ['Holy'] };
const magicItem = { id: 'magic_target', type: 'Accessory', extraTypes: ['Magic'] };
const armor = {
  itemId: 'magitecc_armor',
  placementKey: 'armor',
  name: 'Magitecc Armor',
  params: sourceItem.params,
  speedScale: 0,
};
const holy = { itemId: holyItem.id, placementKey: 'holy', name: 'Holy Target' };
const magic = { itemId: magicItem.id, placementKey: 'magic', name: 'Magic Target' };
const ctx = {
  t: 0,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  rng: () => 0,
  pieces: [armor, holy, magic],
  itemsById: new Map([
    ['magitecc_armor', sourceItem],
    [holyItem.id, holyItem],
    [magicItem.id, magicItem],
  ]),
  graph: {
    pieces: new Map([
      ['armor', { key: 'armor', id: 'magitecc_armor', cells: ['0,0'], affectCells: [
        { cell: '1,0', color: 'primary' },
        { cell: '2,0', color: 'primary' },
      ] }],
      ['holy', { key: 'holy', id: holyItem.id, cells: ['1,0'], affectCells: [] }],
      ['magic', { key: 'magic', id: magicItem.id, cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', 'armor'], ['1,0', 'holy'], ['2,0', 'magic']]),
  },
  canAffect: {
    rulesById: {
      magitecc_armor: {
        primary: {
          op: 'or',
          args: [
            { op: 'hasType', type: 'Holy' },
            { op: 'hasType', type: 'Magic' },
          ],
        },
      },
    },
  },
};

const handler = getScriptHandler('magitecc_armor');
assert.equal(handler?.handlerId, 'magitecc_armor');
handler.onCombatStart(armor, ctx);
assert.equal(ctx.player.block, 65,
  'Magitecc Armor: combat start grants the catalog base Block');
assert.equal(armor.speedScale, 0.2,
  'Magitecc Armor: combat-start speed scales by both Holy/Magic links');
assert.equal(ctx.events.at(-1)?.type, 'activate',
  'Magitecc Armor: combat-start activation follows the base Block grant');

ctx.player.stacks.mana = 4;
ctx.player.stacks.poison = 1;
ctx.player.stacks.blind = 1;
handler.onCooldownEffect(armor, ctx);
assert.equal(ctx.player.stacks.mana, 0,
  'Magitecc Armor: cooldown consumes the named Mana cost');
assert.equal(ctx.player.stacks.poison + ctx.player.stacks.blind, 0,
  'Magitecc Armor: cooldown cleanses the named number of random debuffs');
assert.equal(ctx.player.block, 95,
  'Magitecc Armor: successful cooldown grants the named Block amount');
assert.equal(ctx.events.at(-1)?.type, 'activate',
  'Magitecc Armor: cooldown activation follows its cooldown effects');

const zero = {
  ...armor,
  placementKey: 'zero',
  params: { ...sourceItem.params, manat: 0, cleanse: 0, block: 0 },
};
const zeroCtx = { ...ctx, events: [], player: createActor('zero-player') };
handler.onCooldownEffect(zero, zeroCtx);
assert.equal(zeroCtx.player.block, 0,
  'Magitecc Armor: zero named Mana/block/cleanse values do not invent effects');
assert.equal(zeroCtx.events.at(-1)?.type, 'activate',
  'Magitecc Armor: zero-cost cooldown still activates');

console.log('Magitecc Armor source/parity smoke passed.');
