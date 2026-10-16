import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/StoneGloves.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b-aura.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const stoneGlovesPort'),
  handlerSource.indexOf('/** Anvil.gd', handlerSource.indexOf('export const stoneGlovesPort')),
);

assert.equal(inventory.byId.stone_gloves?.file, 'Exclusive/StoneGloves.gd');
assert.equal(inventory.byId.stone_gloves?.extends, 'Item');
assert.deepEqual(
  inventory.byId.stone_gloves?.overrides,
  ['onCombatStart', 'onPrepare'],
);
assert.match(source, /^extends Item/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canBeEmpowered\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(weapon, "attacked"/);
assert.match(source, /func onCombatStart\(\):[\s\S]*reduceSpeed\(speedReduction\)[\s\S]*addBonusDamageFactor\(damBonusFactor\)[\s\S]*activate\(\)/);
assert.match(source, /func onWeaponAttacked\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*giveBlock\(getBlock\(\), true[\s\S]*miniActivate\(\)/);
assert.match(portBlock, /onPrepare\(piece, ctx\)/);
assert.match(portBlock, /item_attacked/);
assert.doesNotMatch(portBlock.slice(portBlock.indexOf('onCombatStart(piece, ctx)')), /bus\?\.on/);
assert.match(portBlock, /addSpeed\(o, -speedRed\)/);
assert.match(portBlock, /addBonusDamageFactor\(o, damF\)/);
assert.match(portBlock, /pushActivate\(piece, ctx, 'stone_gloves'/);
assert.match(portBlock, /miniActivate: true/);

const gloves = {
  ...byId.get('stone_gloves'),
  itemId: 'stone_gloves',
  placementKey: 'gloves',
  name: 'Stone Gloves',
  kind: 'accessory',
  params: { dambonus: 20, p1: 20, speedreduction: 10, p2: 10 },
  blockGrant: 7,
};
const sword = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'sword',
  name: 'Wooden Sword',
  kind: 'weapon',
  damageMin: 1,
  damageMax: 3,
  speedScale: 0,
  bonusDamageFactor: 1,
};
const pet = {
  ...byId.get('squirrel'),
  itemId: 'squirrel',
  placementKey: 'pet',
  name: 'Squirrel',
  kind: 'pet',
  damageMax: 10,
  speedScale: 0,
  bonusDamageFactor: 1,
};
const player = createActor('player');
const bus = createCombatBus();
player._combatBus = bus;
const events = [];
const ctx = {
  player,
  pieces: [gloves, sword, pet],
  graph: {
    pieces: new Map([
      ['gloves', { key: 'gloves', id: 'stone_gloves', cells: ['0,0'], affectCells: [
        { cell: '1,0', color: 'primary' },
        { cell: '2,0', color: 'primary' },
      ] }],
      ['sword', { key: 'sword', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
      ['pet', { key: 'pet', id: 'squirrel', cells: ['2,0'], affectCells: [] }],
    ]),
    filled: new Map([['1,0', 'sword'], ['2,0', 'pet']]),
  },
  itemsById: byId,
  canAffect: { rulesById: canAffectRules.byId },
  events,
  bus,
  t: 2,
};
const handler = getScriptHandler('stone_gloves');
assert.equal(handler?.handlerId, 'stone_gloves');
handler.onPrepare(gloves, ctx);
assert.deepEqual([...gloves._stoneGlovesLinkedKeys], ['sword']);
handler.onCombatStart(gloves, ctx);
assert.equal(sword.speedScale, -0.1, 'linked weapons receive the source speed reduction');
assert.equal(sword.bonusDamageFactor, 1.2, 'linked weapons receive the source damage factor');
assert.equal(pet.speedScale, 0, 'pets are excluded by canBeEmpowered');
assert.equal(pet.bonusDamageFactor, 1);
assert.ok(events.some((event) => event.type === 'activate' && event.itemId === 'stone_gloves'));

bus.emit('item_attacked', { piece: sword, hit: { hit: false }, t: 3 });
assert.equal(player.block, 0, 'a missed linked attack does not grant Block');
bus.emit('item_attacked', { piece: pet, hit: { hit: true }, t: 3.1 });
assert.equal(player.block, 0, 'an excluded pet does not grant Block');
bus.emit('item_attacked', { piece: sword, hit: { hit: true }, t: 3.2 });
assert.equal(player.block, 7, 'a successful linked weapon attack grants catalog Block');
assert.ok(events.some((event) => event.meta?.handler === 'stone_gloves' && event.meta?.miniActivate));

console.log('OK Stone Gloves source, prepare listener lifecycle, weapon-only aura, hit-gated Block, mini activation, and parameter projection regression');
