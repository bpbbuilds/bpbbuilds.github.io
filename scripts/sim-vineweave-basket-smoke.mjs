import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor, healActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, item]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/VineweaveBasket.gd',
  'utf8',
);
const portSource = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-ak-bags.js',
  'utf8',
);

assert.match(source, /^extends Bag/);
assert.match(source, /func canApplyEffect\(toItem\):[\s\S]*toItem\.hasType\(Type\.Nature\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getP\("healamp"\)[\s\S]*getP\("ampbonus"\)[\s\S]*getNumAffectedInside\(\)[\s\S]*addHealingEfficiency/);
assert.match(source, /func onShopOpened\(\):/);
assert.match(source, /func onSaleRoll\(_item\):/);
assert.match(portSource, /handlerId: 'vineweave_basket'/);
assert.match(portSource, /onPrepare\(piece, ctx\)/);

const handler = getScriptHandler('vineweave_basket');
assert.equal(handler?.handlerId, 'vineweave_basket');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(handler?.onCombatStart, undefined, 'Vineweave Basket is preparation-time');

const basket = {
  ...byId.get('vineweave_basket'),
  itemId: 'vineweave_basket',
  placementKey: 'basket',
  alive: true,
  params: { healamp: 12, ampbonus: 5 },
};
const nature = {
  ...byId.get('walrus_tusk'),
  itemId: 'walrus_tusk',
  placementKey: 'nature',
  alive: true,
};
const plain = {
  ...byId.get('wooden_sword'),
  itemId: 'wooden_sword',
  placementKey: 'plain',
  alive: true,
};
const graph = {
  pieces: new Map([
    ['basket', { key: 'basket', id: 'vineweave_basket', cells: ['0,0', '0,1'], affectCells: [] }],
    ['nature', { key: 'nature', id: 'walrus_tusk', cells: ['0,0'], affectCells: [] }],
    ['plain', { key: 'plain', id: 'wooden_sword', cells: ['0,1'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'nature'],
    ['0,1', 'plain'],
  ]),
};
const player = createActor('player', { maxHp: 200 });
const ctx = {
  player,
  pieces: [basket, nature, plain],
  graph,
  itemsById: byId,
  events: [],
  t: 0,
};

handler.onPrepare(basket, ctx);
assert.ok(Math.abs(player._healAmp - 0.17) < 1e-9, 'one Nature item adds the source base and per-item healing efficiency');
assert.equal(ctx.events.at(-1)?.type, 'stat');
assert.equal(ctx.events.at(-1)?.meta?.stat, 'heal_efficiency');
assert.equal(ctx.events.at(-1)?.amount, 17);
player.hp = 100;
assert.equal(healActor(player, 50), 59, 'healing uses Vineweave Basket efficiency before the HP cap');

const run = simulateEngine({
  placements: [
    { id: 'vineweave_basket', key: 'basket', x: 0, y: 0, r: 0 },
    { id: 'walrus_tusk', key: 'nature', x: 0, y: 0, r: 0 },
  ],
  itemsById: new Map([
    ['vineweave_basket', byId.get('vineweave_basket')],
    ['walrus_tusk', byId.get('walrus_tusk')],
  ]),
  durationSec: 1,
  dummyAttacks: false,
});
assert.ok(run.snapshots.some((snapshot) => Math.abs(snapshot.player.healAmp - 0.17) < 1e-9), 'engine runs Vineweave during preparation');

console.log('OK Vineweave Basket source preparation timing, Nature cargo filter, healing efficiency, and engine regression');
