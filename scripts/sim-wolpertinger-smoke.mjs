import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks, spendStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Wolpertinger.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const sourceItem = catalog.find((item) => item.id === 'wolpertinger');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ai-c2.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('export const wolpertingerPort'),
  handlerSource.indexOf('/** @type {Record<string, ScriptHandler>} */', handlerSource.indexOf('export const wolpertingerPort')),
);

assert.ok(sourceItem, 'Wolpertinger: extracted catalog row');
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.hasType\(Type\.Pet\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(getNumAffectedItems\(\) \* getP3\(\) \/ 100\.0\)[\s\S]*connectToCharacterBuffs\("onBuffChanged"\)[\s\S]*baseStaminaRegen/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveLeastBuffs\(numBuffs\)[\s\S]*activate\(\)/);
assert.match(portBlock, /onPrepare\(piece, ctx\)/);
assert.doesNotMatch(portBlock, /onPreCombatStart|onCombatStart/);
assert.match(portBlock, /baseStaminaRegen/);
assert.match(portBlock, /Math\.trunc\(getP2\(piece\.params, 3\)\)/);

const handler = getScriptHandler('wolpertinger');
assert.equal(typeof handler?.onPrepare, 'function', 'Wolpertinger uses source preparation hook');
assert.equal(typeof handler?.onCooldownEffect, 'function', 'Wolpertinger has a cooldown hook');

const wolp = {
  ...sourceItem,
  itemId: 'wolpertinger',
  placementKey: 'you:wolp',
  name: 'Wolpertinger',
  params: { ...sourceItem.params },
  kind: 'pet',
  side: 'you',
  speedScale: 0,
  alive: true,
};
const power = { itemId: 'power_puppy', placementKey: 'you:power', kind: 'pet', side: 'you' };
const courage = { itemId: 'courage_puppy', placementKey: 'you:courage', kind: 'weapon', side: 'you' };
const sword = { itemId: 'wooden_sword', placementKey: 'you:sword', kind: 'weapon', side: 'you' };
const graph = {
  pieces: new Map([
    [wolp.placementKey, { key: wolp.placementKey, id: wolp.itemId, cells: ['0,0'], affectCells: [] }],
    [power.placementKey, { key: power.placementKey, id: power.itemId, cells: ['1,0'], affectCells: [] }],
    [courage.placementKey, { key: courage.placementKey, id: courage.itemId, cells: ['0,1'], affectCells: [] }],
    [sword.placementKey, { key: sword.placementKey, id: sword.itemId, cells: ['2,0'], affectCells: [] }],
  ]),
  filled: new Map([
    ['0,0', wolp.placementKey],
    ['1,0', power.placementKey],
    ['0,1', courage.placementKey],
    ['2,0', sword.placementKey],
  ]),
};
const itemsById = new Map([
  ['wolpertinger', sourceItem],
  ['power_puppy', { id: 'power_puppy', type: 'Pet', extraTypes: ['Nature'] }],
  ['courage_puppy', { id: 'courage_puppy', type: 'Melee Weapon', extraTypes: ['Pet', 'Nature', 'Effect'] }],
  ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon' }],
]);
const player = createActor('player', { staminaRegen: 2 });
const ctx = {
  t: 4,
  player,
  events: [],
  pieces: [wolp, power, courage, sword],
  graph,
  itemsById,
  canAffect: null,
  rng: () => 0,
};

handler.onPrepare(wolp, ctx);
assert.equal(wolp.speedScale, 0.3, 'Wolpertinger counts both linked Pet-type items at prepare');
assert.equal(player.staminaRegen, 2, 'Wolpertinger does not change stamina regen before a buff change');

grantStacks(player, 'lucky', 1, { originKey: 'test', originId: 'test' });
assert.equal(player.staminaRegen, 2.014, 'Wolpertinger uses base stamina regen for a buff gain');
spendStacks(player, 'lucky', 1, { originKey: 'test', originId: 'test' });
assert.ok(Math.abs(player.staminaRegen - 2) < 1e-12, 'Wolpertinger also reverses stamina regen when a buff is spent');
grantStacks(player, 'cold', 1, { originKey: 'test', originId: 'test' });
assert.ok(Math.abs(player.staminaRegen - 2) < 1e-12, 'Wolpertinger ignores non-buff changes');

handler.onCooldownEffect(wolp, ctx);
const grants = ctx.events.filter((event) => event.meta?.handler === 'wolpertinger' && event.type === 'buff');
const activation = ctx.events.find((event) => event.meta?.handler === 'wolpertinger' && event.type === 'activate');
assert.equal(grants.reduce((sum, event) => sum + event.amount, 0), 3, 'Wolpertinger gives source P2 least-buff stacks');
assert.ok(activation && grants.every((event) => ctx.events.indexOf(event) < ctx.events.indexOf(activation)), 'Wolpertinger effects precede activation');

const fractional = {
  ...wolp,
  placementKey: 'you:wolp-fractional',
  params: { p1: 0.7, p2: 2.9, p3: 15 },
};
const fractionalCtx = { ...ctx, t: 8, events: [] };
handler.onCooldownEffect(fractional, fractionalCtx);
assert.equal(
  fractionalCtx.events.filter((event) => event.meta?.handler === 'wolpertinger' && event.type === 'buff')
    .reduce((sum, event) => sum + event.amount, 0),
  2,
  'Wolpertinger truncates the source integer buff count',
);

const zero = {
  ...wolp,
  placementKey: 'you:wolp-zero',
  params: { p1: 0, p2: 0, p3: 0 },
};
const zeroCtx = { ...ctx, t: 9, events: [] };
handler.onCooldownEffect(zero, zeroCtx);
assert.equal(zeroCtx.events.filter((event) => event.type === 'buff').length, 0, 'explicit zero P2 gives no buffs');
assert.ok(zeroCtx.events.some((event) => event.type === 'activate'), 'explicit zero P2 still activates');

console.log('OK Wolpertinger source/parity smoke');
