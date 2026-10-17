import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MagicMirror.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-d-board.js', 'utf8');
const magicPort = port.slice(port.indexOf('/** MagicMirror.gd'), port.indexOf('/** PlasticCube.gd'));
const sourceItem = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'))
  .items.find((item) => item.id === 'magic_mirror');

assert.ok(sourceItem, 'Magic Mirror: extracted catalog row');
assert.match(source, /extends Item/);
assert.match(source, /return item\.hasType\(Type\.Holy\)/);
assert.match(source, /getChance\(\) \+ getNumAffectedItems\(\) \* getChance2\(\)/);
assert.match(source, /changeAllDebuffsReflectChance\(totalChance\)/);
assert.match(source, /multiplyBuffsLimit\(buffFactor, buffLimit\)/);
assert.match(source, /onAfterEffectFinished\(\)/);
assert.match(magicPort, /onPrepare\(piece, ctx\)/);
assert.match(magicPort, /Number\.isFinite\(Number\(piece\.chance2\)\)/);
assert.match(magicPort, /pushBuffGrants\(ctx\.events, piece, ctx\.player, ctx\.t, 'magic_mirror'/);
assert.match(magicPort, /afterEffectFinished\(piece, ctx, 'magic_mirror'/);
assert.doesNotMatch(magicPort, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'max'/);

const piece = {
  itemId: 'magic_mirror',
  placementKey: 'mirror',
  name: 'Magic Mirror',
  params: { buffs: 20, max: 20 },
  chance: 20,
  chance2: 2,
  charges: 1,
  alive: true,
};
const holy = { itemId: 'holy_spear', placementKey: 'holy', name: 'Holy Spear' };
const nonHoly = { itemId: 'wooden_sword', placementKey: 'sword', name: 'Wooden Sword' };
const itemsById = new Map([
  ['magic_mirror', { ...sourceItem, id: 'magic_mirror' }],
  ['holy_spear', { id: 'holy_spear', type: 'Melee Weapon', extraTypes: ['Holy'] }],
  ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon' }],
]);
const graph = {
  pieces: new Map([
    ['mirror', { id: 'magic_mirror', affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
    ] }],
    ['holy', { id: 'holy_spear', affectCells: [], cells: ['1,0'] }],
    ['sword', { id: 'wooden_sword', affectCells: [], cells: ['2,0'] }],
  ]),
  filled: new Map([['1,0', 'holy'], ['2,0', 'sword']]),
};
const ctx = {
  t: 0,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  pieces: [piece, holy, nonHoly],
  itemsById,
  graph,
  canAffect: {
    rulesById: {
      magic_mirror: { primary: { op: 'hasType', type: 'Holy' } },
    },
  },
};
const handler = getScriptHandler('magic_mirror');
assert.equal(handler?.handlerId, 'magic_mirror');
handler.onPrepare(piece, ctx);
assert.equal(ctx.player.debuffReflectChance, 22,
  'Magic Mirror: base chance plus one affected Holy item');
handler.onCombatStart(piece, ctx);
assert.equal(ctx.player.debuffReflectChance, 22,
  'Magic Mirror: combat-start fallback does not double-apply prepare');

grantStacks(ctx.player, 'heat', 2, { originId: 'test' });
grantStacks(ctx.player, 'lucky', 2, { originId: 'test' });
handler.onCooldownEffect(piece, ctx);
const total = ['heat', 'lucky'].reduce((sum, stack) => sum + ctx.player.stacks[stack], 0);
assert.equal(total, 5, 'Magic Mirror: proportional buffs are capped and rounded like source');
assert.equal(piece.alive, false, 'Magic Mirror: one-shot spell is consumed');
assert.equal(piece.charges, 0, 'Magic Mirror: source effect completion consumes charges');
const grants = ctx.events.filter((event) => event.meta?.handler === 'magic_mirror' && event.type === 'buff');
const activation = ctx.events.find((event) => event.meta?.handler === 'magic_mirror' && event.type === 'activate');
assert.equal(grants.length, 1, 'Magic Mirror: one buff grant summary is logged');
assert.ok(activation, 'Magic Mirror: effect completion activation is logged');
assert.ok(ctx.events.indexOf(activation) > ctx.events.indexOf(grants[0]),
  'Magic Mirror: activation follows grants');
assert.match(activation.label, /^Spell:/);

const zero = {
  ...piece,
  placementKey: 'zero-mirror',
  params: { buffs: 0, max: 0 },
  alive: true,
  charges: 1,
};
const zeroCtx = { ...ctx, events: [], pieces: [zero], player: createActor('player') };
handler.onCooldownEffect(zero, zeroCtx);
assert.equal(zeroCtx.events.some((event) => event.type === 'buff'), false,
  'Magic Mirror: zero-safe parameters do not invent buff grants');
assert.equal(zero.alive, false, 'Magic Mirror: zero-safe effect still completes');

console.log('Magic Mirror source/parity smoke passed.');
