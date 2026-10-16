import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/EchoingBattlecry.gd', 'utf8');
assert.match(source, /extends Item/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasStartofBattle\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*affectedItems = getAffectedItems\(\)[\s\S]*affectedItems\.shuffle\(\)[\s\S]*addSpeed\(speedPerItem \* affectedItems\.size\(\)/);
assert.match(source, /item\.repeatCombatStart\(\)/);
assert.match(source, /if affectedItems\.empty\(\):[\s\S]*onAfterEffectFinished\(\)[\s\S]*else:[\s\S]*activate\(\)/);

const handler = getScriptHandler('echoing_battlecry');
assert.equal(typeof handler?.onPrepare, 'function', 'Echoing Battlecry applies its source preparation hook');
assert.equal(handler?.onPreCombatStart, undefined, 'Echoing Battlecry does not defer preparation to pre-combat');
assert.equal(typeof handler?.onCooldownEffect, 'function', 'Echoing Battlecry replays one queued start effect per cooldown');

const echo = {
  itemId: 'echoing_battlecry',
  placementKey: 'you:echo',
  name: 'Echoing Battlecry',
  params: { speed: 20 },
  speedScale: 0,
  cooldown: 2,
  triggerTime: 2,
  alive: true,
};
const first = { itemId: 'holy_armor', placementKey: 'you:first', name: 'Holy Armor', kind: 'armor', blockGrant: 5 };
const second = { itemId: 'holy_armor', placementKey: 'you:second', name: 'Holy Armor 2', kind: 'armor', blockGrant: 5 };
const nonStart = { itemId: 'non_start', placementKey: 'you:non-start', name: 'Non-start item', kind: 'passive' };
const itemsById = new Map([
  [echo.itemId, { id: echo.itemId, type: 'Skill' }],
  [first.itemId, { id: first.itemId, type: 'Armor', params: { p1: 0 } }],
  [nonStart.itemId, { id: nonStart.itemId, type: 'Accessory' }],
]);
const graph = {
  pieces: new Map([
    [echo.placementKey, { key: echo.placementKey, id: echo.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }, { cell: '3,0', color: 'primary' }] }],
    [first.placementKey, { key: first.placementKey, id: first.itemId, cells: ['1,0'], affectCells: [] }],
    [second.placementKey, { key: second.placementKey, id: second.itemId, cells: ['2,0'], affectCells: [] }],
    [nonStart.placementKey, { key: nonStart.placementKey, id: nonStart.itemId, cells: ['3,0'], affectCells: [] }],
  ]),
  filled: new Map([['0,0', echo.placementKey], ['1,0', first.placementKey], ['2,0', second.placementKey], ['3,0', nonStart.placementKey]]),
};
const canAffect = {
  rulesById: { echoing_battlecry: { primary: { op: 'hasStartofBattle' } } },
  startOfBattleIds: new Set(['holy_armor']),
};
const player = { id: 'you', stacks: {}, block: 0 };
const ctx = {
  t: 0,
  rng: () => 0.25,
  graph,
  itemsById,
  canAffect,
  pieces: [echo, first, second, nonStart],
  player,
  dummy: { id: 'them', stacks: {}, block: 0 },
  events: [],
};

handler.onPrepare(echo, ctx);
assert.equal(echo._echoQueue.length, 2, 'only start-of-battle targets enter the replay queue');
assert.equal(echo.speedScale, 0.4, 'preparation speed scales by the number of affected start effects');
assert.ok(echo._echoQueue.every((key) => key === first.placementKey || key === second.placementKey), 'queue stores affected target keys');

const firstHandled = handler.onCooldownEffect(echo, ctx);
assert.equal(firstHandled, true, 'first replay is handled by the dedicated port');
assert.equal(echo._echoQueue.length, 1, 'one target is removed from the queue per cooldown');
assert.equal(echo.alive, true, 'the item remains available until the final replay');
assert.equal(player.block, 5, 'replayed combat-start handler runs once for the target');
assert.ok(ctx.events.some((event) => event.meta?.handler === 'echoing_battlecry' && /replay start/.test(event.label)), 'replay is retained in the event projection');

handler.onCooldownEffect(echo, ctx);
assert.equal(echo._echoQueue.length, 0, 'the final target drains the queue');
assert.equal(echo.alive, false, 'source onAfterEffectFinished consumes after the final replay');
assert.equal(echo.cooldown, 999, 'source onAfterEffectFinished deactivates future cooldowns');

const zero = { ...echo, alive: true, cooldown: 2, triggerTime: 2, placementKey: 'you:echo-zero', params: { speed: 0 }, speedScale: 0 };
const zeroCtx = { ...ctx, pieces: [zero, first], graph: { ...graph, pieces: new Map([[zero.placementKey, { key: zero.placementKey, id: zero.itemId, cells: ['0,0'], affectCells: [{ cell: '1,0', color: 'primary' }] }], [first.placementKey, graph.pieces.get(first.placementKey)]]), filled: new Map([['0,0', zero.placementKey], ['1,0', first.placementKey]]) } };
handler.onPrepare(zero, zeroCtx);
assert.equal(zero.speedScale, 0, 'zero typed speed remains zero');

console.log('OK Echoing Battlecry source port');
