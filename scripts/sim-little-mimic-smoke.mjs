import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/LittleMimic.gd', 'utf8');
const portFile = fs.readFileSync('js/pages/sim/engine/scripts/ports-buff.js', 'utf8');
const littleMimicPort = portFile.slice(
  portFile.indexOf('export const littleMimicPort'),
  portFile.indexOf('/**', portFile.indexOf('export const littleMimicPort') + 10),
);

assert.match(source, /func getCounterValue\(\)[\s\S]*gold \+= item\.getPrice\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(getCounterValue\(\) \* speedPerGold\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveMostBuffs\(numBuffs\)[\s\S]*activate\(\)/);
assert.match(source, /func onCalcTradeChance\(\):[\s\S]*getShopChance\(\) \/ 100\.0/);
assert.match(littleMimicPort, /onPrepare\(piece, ctx\)/);
assert.match(littleMimicPort, /Math\.trunc\(getPName\(piece\.params, 'buffs'/);
assert.match(littleMimicPort, /pushBuffGrants\([\s\S]*pushActivate\(piece, ctx, 'little_mimic'/);
assert.doesNotMatch(littleMimicPort, /onCombatStart\(piece, ctx\)/);

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const targetItem = byId.get('wooden_sword') || [...byId.values()].find(
  (item) => item.id !== 'little_mimic' && Number(item.cost) > 0,
);
assert.ok(targetItem, 'the catalog must expose a priced item for the getPrice regression');

const piece = {
  placementKey: 'mimic',
  itemId: 'little_mimic',
  name: 'Little Mimic',
  kind: 'pet',
  side: 'you',
  params: { buffs: 3, p1: 3, speed: 1, p2: 1 },
  speedScale: 0,
  baseCooldown: 6,
  cooldown: 6,
};
const target = { placementKey: 'target', itemId: targetItem.id, name: targetItem.name };
const ctx = {
  t: 1,
  player: createActor('player'),
  events: [],
  rng: () => 0,
  pieces: [piece, target],
  itemsById: byId,
  graph: {
    pieces: new Map([
      ['mimic', { key: 'mimic', id: 'little_mimic', cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }],
      ['target', { key: 'target', id: targetItem.id, cells: ['1,0'], affectCells: [] }],
    ]),
    filled: new Map([['1,0', 'target']]),
  },
  canAffect: null,
};
const handler = getScriptHandler('little_mimic');
assert.equal(handler?.handlerId, 'little_mimic');
assert.equal(typeof handler?.onPrepare, 'function');
handler.onPrepare(piece, ctx);
assert.equal(piece.speedScale, Number(targetItem.cost) / 100, 'onPrepare uses linked Item.getPrice as speed bonus');

piece.params = { buffs: 2.9, p1: 2.9, speed: 0, p2: 0 };
const beforeZeroSpeed = piece.speedScale;
handler.onPrepare(piece, { ...ctx, events: [] });
assert.equal(piece.speedScale, beforeZeroSpeed, 'explicit zero speed remains zero');

const events = [];
const activationCtx = { ...ctx, t: 2, events };
handler.onCooldownEffect(piece, activationCtx);
const grantIndex = events.findIndex((event) => event.type === 'buff');
const activateIndex = events.findIndex((event) => event.type === 'activate');
assert.ok(grantIndex >= 0, 'Little Mimic grants the selected buff');
assert.ok(activateIndex > grantIndex, 'Little Mimic activates after giveMostBuffs');
const totalBuffs = Object.values(activationCtx.player.stacks).reduce((sum, amount) => sum + amount, 0);
assert.equal(totalBuffs, 2, 'source int(getP("buffs")) truncates fractional values');

const zeroPiece = { ...piece, placementKey: 'zero-mimic', params: { buffs: 0, p1: 0, speed: 0, p2: 0 }, _activationLogged: false };
const zeroEvents = [];
handler.onCooldownEffect(zeroPiece, { ...activationCtx, events: zeroEvents });
assert.equal(zeroEvents.filter((event) => event.type === 'buff').length, 0, 'zero buffs grant nothing');
assert.equal(zeroEvents.filter((event) => event.type === 'activate').length, 1, 'zero buffs still call activate');

console.log('OK Little Mimic source-backed price speed, prepare lifecycle, integer buff count, grant-before-activation ordering, and zero parameters regression');
