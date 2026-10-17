import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/LeafBadge.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));
const data = byId.get('leaf_badge');

assert.equal(inventory.byId.leaf_badge?.file, 'Exclusive/LeafBadge.gd');
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.canDamage\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*character_lucky_changed[\s\S]*onLuckyChanged/);
assert.match(source, /func onLuckyChanged\(amount, _event\):[\s\S]*changeCritChancePercent\(amount \* getChance\(\)\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveLucky\(1\)[\s\S]*activate\(\)/);
assert.equal(getScriptHandler('leaf_badge')?.handlerId, 'leaf_badge');

function makePiece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    id,
    placementKey: key,
    name: item?.displayName || item?.name || id,
    params: { ...(item?.params || {}) },
    kind: id === 'leaf_badge' ? 'accessory' : 'weapon',
    side: 'you',
    alive: true,
    critChance: 0,
    ...overrides,
  };
}

const badge = makePiece('leaf_badge', 'badge');
const sword = makePiece('wooden_sword', 'sword', { critChance: 10 });
const nonDamagingWeapon = makePiece('spiked_wall', 'wall', { kind: 'weapon', critChance: 20 });
const graph = {
  pieces: new Map([
    ['badge', { key: 'badge', id: 'leaf_badge', cells: ['0,0'], affectCells: [
      { cell: '1,0', color: 'primary' },
      { cell: '2,0', color: 'primary' },
    ] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
    ['wall', { key: 'wall', id: 'spiked_wall', cells: ['2,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', 'badge'],
    ['1,0', 'sword'],
    ['2,0', 'wall'],
  ]),
};
const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
const events = [];
player._combatBus = bus;
dummy._combatBus = bus;
player._eventLog = events;
dummy._eventLog = [];
const ctx = {
  player,
  dummy,
  bus,
  events,
  t: 3,
  rng: () => 0,
  pieces: [badge, sword, nonDamagingWeapon],
  graph,
  itemsById: byId,
  canAffect: null,
};
const handler = getScriptHandler('leaf_badge');

handler.onPrepare(badge, ctx);
grantStacks(player, 'lucky', 2, { originKey: 'setup', originId: 'setup' });
assert.equal(sword.critChance, 14, 'Leaf Badge adds chance percent per Lucky stack to damage-capable items');
assert.equal(nonDamagingWeapon.critChance, 20, 'Leaf Badge excludes linked items that fail source canDamage()');

assert.equal(handler.onCooldownEffect(badge, ctx), true);
assert.equal(player.stacks.lucky, 3, 'Leaf Badge grants exactly one Lucky');
const activation = events.find((event) => event.type === 'activate' && event.itemId === 'leaf_badge');
assert.ok(activation, 'Leaf Badge records its source activation after the Lucky grant');

const zero = makePiece('leaf_badge', 'zero-badge', { params: { chance: 0 } });
const zeroCtx = { ...ctx, events: [], pieces: [zero, sword], graph: {
  pieces: new Map([
    ['zero-badge', { key: 'zero-badge', id: 'leaf_badge', cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }],
    ['sword', { key: 'sword', id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
  ]),
  filled: new Map([['0,0', 'zero-badge'], ['1,0', 'sword']]),
} };
zeroCtx.player = createActor('player');
zeroCtx.player._combatBus = bus;
zeroCtx.player._eventLog = zeroCtx.events;
const beforeZero = sword.critChance;
zeroCtx.itemsById = new Map(byId);
zeroCtx.itemsById.set('leaf_badge', { ...data, chance: 0 });
handler.onPrepare(zero, zeroCtx);
grantStacks(zeroCtx.player, 'lucky', 2);
assert.equal(sword.critChance, beforeZero, 'Leaf Badge honors an explicit zero chance');

console.log('OK Leaf Badge source-backed canDamage target filtering, Lucky listener timing, crit chance accumulation, Lucky grant/activation ordering, and zero chance');
