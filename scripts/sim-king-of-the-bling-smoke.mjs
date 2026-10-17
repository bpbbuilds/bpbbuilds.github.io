import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/KingoftheBling.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const kingData = byId.get('king_of_the_bling');

assert.match(source, /func canAffect\(item\):[\s\S]*magicRingDescriptor[\s\S]*superiorRingDescriptor/);
assert.match(source, /func onPrepare\(\):[\s\S]*changeAmplificiationChancePercent_allBuffs\(getChance\(\)\)[\s\S]*changeAmplificiationChancePercent_allDebuffs\(getChance\(\)/);
assert.equal(inventory.byId.king_of_the_bling?.file, 'Exclusive/KingoftheBling.gd');
assert.equal(getScriptHandler('king_of_the_bling')?.handlerId, 'king_of_the_bling');

function piece(itemId, placementKey, side, overrides = {}) {
  const item = byId.get(itemId);
  return {
    ...item,
    itemId,
    placementKey,
    name: item?.name || itemId,
    side,
    alive: true,
    kind: itemId === 'king_of_the_bling' ? 'skill' : 'accessory',
    params: { ...(item?.params || {}) },
    ...overrides,
  };
}

const king = piece('king_of_the_bling', 'king', 'you');
const ring = piece('magic_ring', 'ring', 'you');
const superior = piece('superior_ring', 'superior', 'you');
const opponentRing = piece('magic_ring', 'opponent-ring', 'them');
const unrelated = piece('wooden_sword', 'unrelated', 'you', { kind: 'weapon' });
const graph = {
  pieces: new Map([
    ['king', { key: 'king', id: 'king_of_the_bling', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
      { cell: '3,0', color: 'primary' },
    ] }],
    ['ring', { key: 'ring', id: 'magic_ring', cells: ['1,0'], affectCells: [] }],
    ['superior', { key: 'superior', id: 'superior_ring', cells: ['2,0'], affectCells: [] }],
    ['opponent-ring', { key: 'opponent-ring', id: 'magic_ring', cells: ['3,0'], affectCells: [] }],
    ['unrelated', { key: 'unrelated', id: 'wooden_sword', cells: ['4,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'king'],
    ['1,0', 'ring'],
    ['2,0', 'superior'],
    ['3,0', 'opponent-ring'],
    ['4,0', 'unrelated'],
  ]),
};
const ctx = {
  pieces: [king, ring, superior, opponentRing, unrelated],
  graph,
  itemsById: byId,
  canAffect: null,
};
const handler = getScriptHandler('king_of_the_bling');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler?.onCombatStart, undefined, 'King of the Bling uses source prepare');
handler.onPrepare(king, ctx);
assert.equal(ring.buffAmpChance, 35, 'King of the Bling raises linked Magic Ring buff amplification by getChance');
assert.equal(ring.debuffAmpChance, 35, 'King of the Bling raises linked Magic Ring debuff amplification');
assert.equal(superior.buffAmpChance, 35, 'King of the Bling supports linked Superior Ring');
assert.equal(superior.debuffAmpChance, 35, 'King of the Bling supports Superior Ring debuffs');
assert.equal(opponentRing.buffAmpChance, undefined, 'King of the Bling does not affect the opponent inventory');
assert.equal(unrelated.buffAmpChance, undefined, 'King of the Bling excludes unrelated items');

const zeroKing = piece('king_of_the_bling', 'zero-king', 'you', { chance: 0 });
const zeroRing = piece('magic_ring', 'zero-ring', 'you');
const zeroCtx = {
  pieces: [zeroKing, zeroRing],
  graph: {
    pieces: new Map([
      ['zero-king', { key: 'zero-king', id: 'king_of_the_bling', cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }],
      ['zero-ring', { key: 'zero-ring', id: 'magic_ring', cells: ['1,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', 'zero-king'], ['1,0', 'zero-ring']]),
  },
  itemsById: new Map([
    ['king_of_the_bling', { ...kingData, chance: 0 }],
    ['magic_ring', byId.get('magic_ring')],
  ]),
  canAffect: null,
};
handler.onPrepare(zeroKing, zeroCtx);
assert.equal(zeroRing.buffAmpChance, 0, 'King of the Bling honors an explicit zero chance');
assert.equal(zeroRing.debuffAmpChance, 0, 'King of the Bling keeps zero debuff amplification side-effect free');

console.log('OK King of the Bling source-backed prepare lifecycle, Ring/Superior Ring filtering, buff/debuff amplification, side isolation, and zero chance');
