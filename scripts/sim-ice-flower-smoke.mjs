import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/IceFlower.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*return item\.isWeapon\(\)/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*item\.hasType\(Type\.Shield\)[\s\S]*item\.canActivate\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(item, "attacked", "onWeaponAttacked"\)[\s\S]*connectForCombat\(item, "activated", "onShieldOrArmorActivated"\)/);
assert.match(source, /func onWeaponAttacked\(damageRes\):[\s\S]*character\(\)\.getMana\(\) >= manaNeeded[\s\S]*rollChance\(\)[\s\S]*useMana\(manaNeeded\)[\s\S]*inflictCold\(cold, event\)[\s\S]*miniActivate\(\)/);
assert.match(source, /func onShieldOrArmorActivated\(event\):[\s\S]*rollChance2\(\)[\s\S]*giveMana\(mana\)[\s\S]*giveBlock\(\)[\s\S]*miniActivate\(\)/);
assert.equal(inventory.byId.ice_flower?.file, 'Exclusive/IceFlower.gd');
assert.equal(getScriptHandler('ice_flower')?.handlerId, 'ice_flower');

function makePiece(itemId, placementKey, overrides = {}) {
  const item = byId.get(itemId) || { id: itemId, name: itemId };
  return {
    ...item,
    itemId,
    placementKey,
    name: item.displayName || item.name || itemId,
    params: { ...(item.params || {}) },
    alive: true,
    side: 'you',
    ...overrides,
  };
}

const flowerCatalog = { ...byId.get('ice_flower'), chance: 100, chance2: 100 };
const flower = makePiece('ice_flower', 'flower', {
  ...flowerCatalog,
  chance: 100,
  chance2: 100,
  blockGrant: flowerCatalog.block,
});
const weapon = makePiece('wooden_sword', 'weapon', { kind: 'weapon' });
const shield = makePiece('shield_of_valor', 'shield', { kind: 'armor', cooldown: 0 });
const activeArmor = makePiece('ice_armor', 'active-armor', { kind: 'armor', cooldown: 4.7 });
const passiveArmor = makePiece('ice_armor', 'passive-armor', { kind: 'armor', cooldown: 0 });
const unrelated = makePiece('wooden_sword', 'unrelated', { kind: 'weapon' });
const graph = {
  pieces: new Map([
    ['flower', { key: 'flower', id: 'ice_flower', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'secondary' },
      { cell: '3,0', color: 'secondary' },
      { cell: '4,0', color: 'secondary' },
    ] }],
    ['weapon', { key: 'weapon', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
    ['shield', { key: 'shield', id: 'shield_of_valor', cells: ['2,0'], affectCells: [] }],
    ['active-armor', { key: 'active-armor', id: 'ice_armor', cells: ['3,0'], affectCells: [] }],
    ['passive-armor', { key: 'passive-armor', id: 'ice_armor', cells: ['4,0'], affectCells: [] }],
    ['unrelated', { key: 'unrelated', id: 'wooden_sword', cells: ['5,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'flower'],
    ['1,0', 'weapon'],
    ['2,0', 'shield'],
    ['3,0', 'active-armor'],
    ['4,0', 'passive-armor'],
    ['5,0', 'unrelated'],
  ]),
};
const pieces = [flower, weapon, shield, activeArmor, passiveArmor, unrelated];
const itemsById = new Map(byId);
itemsById.set('ice_flower', flowerCatalog);
const player = createActor('player', { maxHp: 200 });
const dummy = createActor('dummy', { maxHp: 200 });
const bus = createCombatBus();
player._combatBus = bus;
dummy._combatBus = bus;
const ctx = {
  t: 4,
  player,
  dummy,
  bus,
  events: [],
  graph,
  pieces,
  itemsById,
  canAffect: null,
  rng: () => 0,
};

const handler = getScriptHandler('ice_flower');
handler.onPrepare(flower, ctx);
assert.deepEqual([...flower._iceFlowerPrimaryKeys], ['weapon'], 'Ice Flower listens only to primary weapons');
assert.deepEqual(
  [...flower._iceFlowerSecondaryKeys], ['shield', 'active-armor'],
  'Ice Flower accepts shields and activatable armor as secondary targets',
);

player.stacks.mana = 1;
bus.emit('item_attacked', { piece: weapon, hit: { hit: false }, t: 4 });
assert.equal(player.stacks.mana, 0, 'Ice Flower spends the exact source Mana threshold on an attack signal');
assert.equal(dummy.stacks.cold, 3, 'Ice Flower inflicts its source Cold even when the weapon attack misses');
assert.equal(ctx.events.at(-1)?.meta?.miniActivate, true, 'Ice Flower records mini activation after its primary effect');

handler.onPeerActivated(flower, shield, ctx);
assert.equal(player.stacks.mana, 1, 'Ice Flower grants source Mana when a linked shield activates');
assert.equal(player.block, 17, 'Ice Flower grants its own Block, not the activated item Block');
assert.equal(ctx.events.at(-1)?.meta?.miniActivate, true, 'Ice Flower records mini activation after its secondary effect');

const beforePassive = player.block;
handler.onPeerActivated(flower, passiveArmor, ctx);
assert.equal(player.block, beforePassive, 'Ice Flower ignores armor without canActivate');
handler.onPeerActivated(flower, unrelated, ctx);
assert.equal(player.block, beforePassive, 'Ice Flower ignores unrelated activations');

const zero = makePiece('ice_flower', 'zero', {
  ...flowerCatalog,
  params: { manat: 0, p1: 0, cold: 0, p2: 0, mana: 0, p3: 0 },
  chance: 100,
  chance2: 100,
  blockGrant: 0,
});
const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroDummy = createActor('dummy', { maxHp: 200 });
const zeroBus = createCombatBus();
zeroPlayer._combatBus = zeroBus;
zeroDummy._combatBus = zeroBus;
const zeroCtx = {
  ...ctx,
  player: zeroPlayer,
  dummy: zeroDummy,
  bus: zeroBus,
  events: [],
  pieces: [zero, weapon, shield],
  itemsById: new Map([...itemsById, ['ice_flower', { ...flowerCatalog, block: 0 }]]),
};
zeroCtx.graph = {
  pieces: new Map([
    ['zero', { key: 'zero', id: 'ice_flower', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'secondary' },
    ] }],
    ['weapon', { key: 'weapon', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
    ['shield', { key: 'shield', id: 'shield_of_valor', cells: ['2,0'], affectCells: [] }],
  ]),
  filled: new Map([['0,0', 'zero'], ['1,0', 'weapon'], ['2,0', 'shield']]),
};
handler.onPrepare(zero, zeroCtx);
zeroBus.emit('item_attacked', { piece: weapon, hit: { hit: true }, t: 4 });
handler.onPeerActivated(zero, shield, zeroCtx);
assert.equal(zeroPlayer.stacks.mana || 0, 0, 'Ice Flower honors explicit zero Mana parameters');
assert.equal(zeroDummy.stacks.cold || 0, 0, 'Ice Flower honors explicit zero Cold parameters');
assert.equal(zeroPlayer.block || 0, 0, 'Ice Flower honors explicit zero Block');

console.log('OK Ice Flower source-backed prepare target filtering, miss-inclusive weapon attacks, chance/chance2, exact Mana/Cold/Block, mini activation, and zero parameters');
