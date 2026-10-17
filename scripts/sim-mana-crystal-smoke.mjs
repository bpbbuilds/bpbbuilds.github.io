import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ManaCrystal.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ai-d.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'mana_crystal');
const magicTargetItem = { id: 'magic_target', type: 'Accessory', extraTypes: ['Magic'] };

assert.ok(sourceItem, 'Mana Crystal: extracted catalog row');
assert.match(source, /const chargeCells = \[[\s\S]*Vector2\( - 1, 0\)[\s\S]*Vector2\(0, - 1\)[\s\S]*Vector2\(1, 0\)[\s\S]*Vector2\(0, 1\)/);
assert.match(source, /func canAffect_lightning\(item\):[\s\S]*return true/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*emitCharge\(\)[\s\S]*charge_emitted/);
assert.match(source, /func emitCharge\(speedFactor = 1\.0\):[\s\S]*activate\(\)[\s\S]*sendCharge\(getP_m\("dur"\), chargeCells\[i\]/);
assert.match(source, /func onChargeEnteredCell\(charge, cellIndex\):[\s\S]*hasType\(Type\.Magic\)[\s\S]*giveMana\(mana2\)/);
assert.match(port, /handlerId: 'mana_crystal'/);
assert.match(port, /emitManaCrystalCharge\(piece, ctx/);

const crystal = {
  ...sourceItem,
  itemId: 'mana_crystal',
  placementKey: 'crystal',
  name: 'Mana Crystal',
  params: { ...sourceItem.params, mana1: 3, mana2: 7, dur: 2 },
  side: 'you',
  alive: true,
  kind: 'accessory',
};
const target = {
  ...magicTargetItem,
  itemId: magicTargetItem.id,
  placementKey: 'magic-target',
  name: 'Magic Target',
  side: 'you',
  alive: true,
  kind: 'accessory',
};
const bus = createCombatBus();
let signalCount = 0;
bus.on('charge_emitted', () => { signalCount += 1; });
const byId = new Map([
  ['mana_crystal', sourceItem],
  [magicTargetItem.id, magicTargetItem],
]);
const ctx = {
  t: 5,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  rng: () => 0,
  bus,
  pieces: [crystal, target],
  itemsById: byId,
  canAffect: { rulesById: null },
  graph: buildBoardGraph([
    { id: 'mana_crystal', x: 5, y: 5, r: 0, key: 'crystal' },
    { id: magicTargetItem.id, x: 5, y: 4, r: 0, key: 'magic-target' },
  ], byId),
};

const handler = getScriptHandler('mana_crystal');
assert.equal(handler?.handlerId, 'mana_crystal');
handler.onCooldownEffect(crystal, ctx);
assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 1,
  'Mana Crystal: cooldown emits one activation');
assert.equal(ctx.events.filter((event) => event.type === 'charge' && event.meta?.phase === 'start').length, 4,
  'Mana Crystal: cooldown emits all four source directional charge paths');
assert.equal(signalCount, 1,
  'Mana Crystal: cooldown emits one charge_emitted signal');
assert.equal(ctx.player.stacks.mana, 7,
  'Mana Crystal: a Magic item receives mana2 on first charge entry');

const zero = {
  ...crystal,
  placementKey: 'zero-crystal',
  params: { ...crystal.params, mana1: 0, mana2: 0, dur: 0 },
};
const zeroCtx = {
  ...ctx,
  t: 0,
  events: [],
  player: createActor('zero-player'),
  pieces: [zero],
  graph: buildBoardGraph([
    { id: 'mana_crystal', x: 5, y: 5, r: 0, key: 'zero-crystal' },
  ], byId),
};
handler.onCooldownEffect(zero, zeroCtx);
assert.equal(zeroCtx.player.stacks.mana, 0,
  'Mana Crystal: explicit zero Mana values do not invent a grant');
const zeroStart = zeroCtx.events.find((event) => event.type === 'charge' && event.meta?.phase === 'start');
assert.equal(zeroStart?.meta.chargePath.duration, 0,
  'Mana Crystal: explicit zero duration is preserved');

console.log('Mana Crystal source/parity smoke passed.');
