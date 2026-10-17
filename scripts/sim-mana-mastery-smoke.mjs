import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ManaMastery.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-spells.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'mana_mastery');
const magicItem = { id: 'magic-target', type: 'Accessory', extraTypes: ['Magic'] };

assert.ok(sourceItem, 'Mana Mastery: extracted catalog row');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Magic\)/);
assert.match(source, /func canAffect_global\(item\):[\s\S]*item\.isA\(manaOrbDescriptor\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(magicSpeed \* numMagic\)/);
assert.match(source, /func onPreCombatStart\(\):[\s\S]*getAllInInventoryOfType\(manaOrbDescriptor\)[\s\S]*addBonusRandomBuffs\(bonusBuffs\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveMana\(mana\)[\s\S]*activate\(\)/);
assert.match(port, /handlerId: 'mana_mastery'/);
assert.match(port, /onPrepare\(piece, ctx\)/);
assert.match(port, /onPreCombatStart\(piece, ctx\)/);

const masteryItem = { ...sourceItem, id: 'mana_mastery' };
const mastery = {
  itemId: 'mana_mastery',
  placementKey: 'mastery',
  name: 'Mana Mastery',
  params: sourceItem.params,
  side: 'you',
  alive: true,
  speedScale: 0,
};
const magic = {
  itemId: magicItem.id,
  placementKey: 'magic',
  name: 'Magic Target',
  side: 'you',
  alive: true,
};
const orb = {
  itemId: 'mana_orb',
  placementKey: 'orb',
  name: 'Mana Orb',
  side: 'you',
  alive: true,
  _bonusBuffs: 0,
};
const ctx = {
  t: 0,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  rng: () => 0,
  pieces: [mastery, magic, orb],
  itemsById: new Map([
    ['mana_mastery', masteryItem],
    [magicItem.id, magicItem],
    ['mana_orb', { id: 'mana_orb', type: 'Accessory', extraTypes: ['Magic'] }],
  ]),
  graph: {
    pieces: new Map([
      ['mastery', { key: 'mastery', id: 'mana_mastery', cells: ['0,0'], affectCells: [
        { cell: '1,0', color: 'primary' },
      ] }],
      ['magic', { key: 'magic', id: magicItem.id, cells: ['1,0'], affectCells: [] }],
      ['orb', { key: 'orb', id: 'mana_orb', cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', 'mastery'], ['1,0', 'magic'], ['2,0', 'orb']]),
  },
  canAffect: {
    rulesById: {
      'mana_mastery': { primary: { op: 'hasType', type: 'Magic' } },
    },
  },
};

const handler = getScriptHandler('mana_mastery');
assert.equal(handler?.handlerId, 'mana_mastery');
const orbHandler = getScriptHandler('mana_orb');
assert.equal(typeof orbHandler?.onPrepare, 'function',
  'Mana Orb: source reset runs during preparation before Mana Mastery global setup');
handler.onPrepare(mastery, ctx);
assert.equal(mastery.speedScale, 0.25,
  'Mana Mastery: preparation speed scales once per linked Magic item');
orb._bonusBuffs = 9;
orbHandler.onPrepare(orb, ctx);
assert.equal(orb._bonusBuffs, 0,
  'Mana Orb: preparation resets the prior Mastery bonus before combat setup');
handler.onPreCombatStart(mastery, ctx);
assert.equal(orb._bonusBuffs, 20,
  'Mana Mastery: pre-combat global effect boosts every owned Mana Orb');

handler.onCooldownEffect(mastery, ctx);
assert.equal(ctx.player.stacks.mana, 3,
  'Mana Mastery: cooldown grants the exact named Mana amount');
assert.equal(ctx.events.at(-1)?.type, 'activate',
  'Mana Mastery: activation follows its Mana grant');

const zero = {
  ...mastery,
  placementKey: 'zero-mastery',
  params: { ...sourceItem.params, mana: 0, buffs: 0, speed: 0 },
};
const zeroCtx = { ...ctx, events: [], player: createActor('zero-player') };
handler.onCooldownEffect(zero, zeroCtx);
assert.equal(zeroCtx.player.stacks.mana, 0,
  'Mana Mastery: explicit zero Mana does not invent a grant');
assert.equal(zeroCtx.events.at(-1)?.type, 'activate',
  'Mana Mastery: zero-cost cooldown still activates');

console.log('Mana Mastery source/parity smoke passed.');
