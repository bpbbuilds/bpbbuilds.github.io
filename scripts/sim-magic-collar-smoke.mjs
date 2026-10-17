import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MagicCollar.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-accessories.js', 'utf8');
const magicPort = port.slice(port.indexOf('const magicCollarPort'), port.indexOf('const spikedCollarPort'));
const sourceItem = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'))
  .items.find((item) => item.id === 'magic_collar');

assert.ok(sourceItem, 'Magic Collar: extracted catalog row');
assert.match(source, /extends RangerCollar/);
assert.match(source, /return item\.canBeEmpowered\(\)/);
assert.match(source, /connectForCombat\(item, "attacked", "onWeaponAttacked"\)/);
assert.match(source, /damageRes\.triggerOnHit\(\)/);
assert.match(source, /getChance\(\) \* character\(\)\.getLucky\(\)/);
assert.match(source, /giveMana\(mana, damageRes\.event\)/);
assert.match(source, /miniActivate\(\)/);
assert.match(magicPort, /onPrepare\(piece, ctx\)/);
assert.match(magicPort, /on\?\.\('item_attacked'/);
assert.match(magicPort, /Math\.max\(0, getStackAmount\(ctx\.player, 'lucky'\)\)/);
assert.match(magicPort, /Math\.trunc\(getPName\(piece\.params, 'mana'/);
assert.match(magicPort, /miniActivate: true/);
assert.doesNotMatch(magicPort, /Math\.max\(1, getStackAmount/);

const collar = {
  itemId: 'magic_collar',
  placementKey: 'collar',
  name: 'Magic Collar',
  params: { mana: 3 },
};
const weapon = {
  itemId: 'wooden_sword',
  placementKey: 'weapon',
  name: 'Wooden Sword',
};
const accessory = {
  itemId: 'accessory',
  placementKey: 'accessory',
  name: 'Accessory',
};
const itemsById = new Map([
  ['magic_collar', { ...sourceItem, id: 'magic_collar', chance: 7 }],
  ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon', damageMin: 4, damageMax: 6 }],
  ['accessory', { id: 'accessory', type: 'Accessory', damageMin: 4 }],
]);
const graph = {
  pieces: new Map([
    ['collar', { id: 'magic_collar', affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
    ] }],
    ['weapon', { id: 'wooden_sword', affectCells: [], cells: ['1,0'] }],
    ['accessory', { id: 'accessory', affectCells: [], cells: ['2,0'] }],
  ]),
  filled: new Map([['1,0', 'weapon'], ['2,0', 'accessory']]),
};
const ctx = {
  t: 0,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  rng: () => 0,
  bus: createCombatBus(),
  pieces: [collar, weapon, accessory],
  itemsById,
  graph,
  canAffect: {
    rulesById: {
      magic_collar: { primary: { op: 'canBeEmpowered' } },
    },
  },
};
const handler = getScriptHandler('magic_collar');
assert.equal(handler?.handlerId, 'magic_collar');
handler.onPrepare(collar, ctx);

ctx.bus.emit('item_attacked', { piece: weapon, hit: { hit: true }, t: 0 });
assert.equal(ctx.player.stacks.mana, 0, 'Magic Collar: zero Lucky does not proc');
assert.equal(ctx.events.length, 0, 'Magic Collar: zero Lucky has no event');

grantStacks(ctx.player, 'lucky', 2, { originId: 'test' });
ctx.bus.emit('item_attacked', { piece: weapon, hit: { hit: true }, t: 1 });
assert.equal(ctx.player.stacks.mana, 3, 'Magic Collar: empowered hit grants exact Mana');
assert.equal(ctx.events.filter((event) => event.meta?.handler === 'magic_collar').length, 2,
  'Magic Collar: Mana grant and mini activation are logged');

ctx.bus.emit('item_attacked', { piece: accessory, hit: { hit: true }, t: 2 });
assert.equal(ctx.player.stacks.mana, 3, 'Magic Collar: non-empowerable link does not proc');
ctx.bus.emit('item_attacked', { piece: weapon, hit: { hit: false }, t: 3 });
assert.equal(ctx.player.stacks.mana, 3, 'Magic Collar: miss does not proc');

const zeroManaPiece = { ...collar, _magicCollarPrepared: false, params: { mana: 0 } };
const zeroCtx = {
  ...ctx,
  player: createActor('player'),
  events: [],
  rng: () => 0,
  pieces: [zeroManaPiece, weapon],
  bus: createCombatBus(),
};
handler.onPrepare(zeroManaPiece, zeroCtx);
grantStacks(zeroCtx.player, 'lucky', 2, { originId: 'test' });
zeroCtx.bus.emit('item_attacked', { piece: weapon, hit: { hit: true }, t: 0 });
assert.equal(zeroCtx.player.stacks.mana, 0, 'Magic Collar: zero Mana stays zero');
assert.equal(zeroCtx.events.at(-1)?.meta?.miniActivate, true,
  'Magic Collar: zero Mana still mirrors source miniActivate');

console.log('Magic Collar source/parity smoke passed.');
