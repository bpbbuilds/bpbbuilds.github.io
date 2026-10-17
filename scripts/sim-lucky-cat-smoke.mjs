import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/LuckyCat.gd', 'utf8');
const portFile = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-accessories.js', 'utf8');
const luckyCatPort = portFile.slice(
  portFile.indexOf('const luckyCatPort'),
  portFile.indexOf('/** ManaOrb.gd', portFile.indexOf('const luckyCatPort')),
);

assert.equal(inventory.byId.lucky_cat?.file, 'Exclusive/LuckyCat.gd');
assert.match(source, /func getCounterValue\(\)[\s\S]*getAffectedGoldValue\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*condition1Fulfilled\(gold\)[\s\S]*changeCritResistance\(getChance\(\)\)[\s\S]*condition2Fulfilled\(gold\)[\s\S]*canAffect_global\(item\)[\s\S]*addSpeed\(bonusSpeed\)/);
assert.match(source, /func canAffect_global\(item\):[\s\S]*getRarity\(\) >= Rarity\.Godly[\s\S]*hasCooldown\(\)/);
assert.match(luckyCatPort, /onPrepare\(piece, ctx\)/);
assert.match(luckyCatPort, /rarityPriority\(item\) < 4/);
assert.doesNotMatch(luckyCatPort, /onCombatStart\(piece, ctx\)/);

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
byId.set('test_godly_blade', { id: 'test_godly_blade', name: 'Test Godly Blade', cost: 25, rarity: 'Godly', cooldown: 2 });
byId.set('test_godly_armor', { id: 'test_godly_armor', name: 'Test Godly Armor', cost: 20, rarity: 'Godly', cooldown: 1 });
byId.set('test_rare_weapon', { id: 'test_rare_weapon', name: 'Test Rare Weapon', cost: 100, rarity: 'Rare', cooldown: 2 });

const piece = {
  placementKey: 'cat',
  itemId: 'lucky_cat',
  name: 'Lucky Cat',
  kind: 'passive',
  side: 'you',
  params: { sales: 3, p1: 3, gold1: 20, p2: 20, gold2: 40, p3: 40, speed: 15, p4: 15 },
};
const targets = [
  { placementKey: 'blade', itemId: 'test_godly_blade', side: 'you', cooldown: 2, speedScale: 0 },
  { placementKey: 'armor', itemId: 'test_godly_armor', side: 'you', cooldown: 1, speedScale: 0 },
  { placementKey: 'rare', itemId: 'test_rare_weapon', side: 'you', cooldown: 2, speedScale: 0 },
];
const ctx = {
  player: createActor('player'),
  pieces: [piece, ...targets],
  itemsById: byId,
  graph: {
    pieces: new Map([
      ['cat', { key: 'cat', id: 'lucky_cat', cells: ['0,0'], affectCells: [
        { cell: '1,0', color: 'primary' },
        { cell: '2,0', color: 'primary' },
        { cell: '3,0', color: 'primary' },
      ] }],
      ...targets.map((target, index) => [target.placementKey, {
        key: target.placementKey,
        id: target.itemId,
        cells: [`${index + 1},0`],
        affectCells: [],
      }]),
    ]),
    filled: new Map([['1,0', 'blade'], ['2,0', 'armor'], ['3,0', 'rare']]),
  },
  canAffect: null,
};
const handler = getScriptHandler('lucky_cat');
assert.equal(handler?.handlerId, 'lucky_cat');
assert.equal(typeof handler?.onPrepare, 'function');
handler.onPrepare(piece, ctx);
assert.equal(piece._luckyCatState, 'two', 'threshold state uses affected item gold, not linked-item count');
assert.equal(ctx.player.critResistance, 15, 'first gold threshold grants exact crit resistance');
assert.equal(targets[0].speedScale, 0.15, 'second threshold speeds a Godly cooldown item');
assert.equal(targets[1].speedScale, 0.15, 'second threshold speeds every qualifying Godly cooldown item');
assert.equal(targets[2].speedScale, 0, 'non-Godly cooldown items are excluded by canAffect_global');

const onePiece = { ...piece, placementKey: 'one-cat', params: { gold1: 20, p2: 20, gold2: 40, p3: 40, speed: 15, p4: 15 } };
const oneTarget = { ...targets[0], placementKey: 'one-blade', speedScale: 0 };
const oneCtx = {
  ...ctx,
  player: createActor('player'),
  pieces: [onePiece, oneTarget],
  graph: {
    pieces: new Map([
      ['one-cat', { key: 'one-cat', id: 'lucky_cat', cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }],
      ['one-blade', { key: 'one-blade', id: oneTarget.itemId, cells: ['1,0'], affectCells: [] }],
    ]),
    filled: new Map([['1,0', 'one-blade']]),
  },
};
byId.set('one_blade', { ...byId.get('test_godly_blade') });
oneTarget.itemId = 'one_blade';
handler.onPrepare(onePiece, oneCtx);
assert.equal(onePiece._luckyCatState, 'one', 'the second threshold remains strict');
assert.equal(oneCtx.player.critResistance, 15, 'the first threshold still grants crit resistance');
assert.equal(oneTarget.speedScale, 0, 'the first threshold does not grant speed');

console.log('OK Lucky Cat source-backed affected-gold thresholds, crit resistance, Godly cooldown speed filter, strict thresholds, and no combat-start mismatch regression');
