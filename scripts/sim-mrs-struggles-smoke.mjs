import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { BUFF_KEYS } from '../js/pages/sim/engine/buff-economy.js';
import { getStackAmount } from '../js/pages/sim/engine/stacks.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MrsStruggles.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-outliers.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'mrs_struggles');
const darkItem = catalog.find((item) => item.id === 'mr_struggles');
const nonDarkItem = catalog.find((item) => item.id === 'hero_sword');

assert.ok(sourceItem, 'Mrs Struggles: extracted catalog row');
assert.ok(darkItem, 'Mrs Struggles: Dark linked fixture');
assert.ok(nonDarkItem, 'Mrs Struggles: non-Dark linked fixture');
assert.match(source, /func canAffect\(item\):[\s\S]*item\.hasType\(Type\.Dark\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(getNumAffectedItems\(\) \* getP1\(\) \/ 100\.0\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*opponent\(\)\.loseStacks\(buff, 1, self\)[\s\S]*activate\(\)/);
assert.match(port, /handlerId: 'mrs_struggles'/);
const mrsPort = port.match(/export const mrsStrugglesPort[\s\S]*?\n\};/u)?.[0] || '';
assert.match(mrsPort, /onPrepare\(piece, ctx\)/);
assert.match(mrsPort, /itemHasType\(item, 'dark'\)/);
assert.match(mrsPort, /addSpeed\(piece,/);
assert.doesNotMatch(mrsPort, /onCombatStart\(piece, ctx\)/,
  'Mrs Struggles: source speed setup belongs to onPrepare');

const handler = getScriptHandler('mrs_struggles');
assert.equal(handler?.handlerId, 'mrs_struggles');

function makeContext(params = sourceItem.params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = events;
  const mrs = {
    itemId: 'mrs_struggles',
    placementKey: 'mrs',
    name: 'Mrs Struggles',
    params: { ...params },
    side: 'you',
    kind: 'accessory',
    alive: true,
    cooldown: sourceItem.cooldown,
    baseCooldown: sourceItem.cooldown,
    speedScale: 0,
  };
  const dark = {
    itemId: 'mr_struggles',
    placementKey: 'dark',
    name: 'Mr Struggles',
    side: 'you',
    kind: 'accessory',
    alive: true,
    cooldown: darkItem.cooldown,
    baseCooldown: darkItem.cooldown,
    speedScale: 0,
  };
  const nonDark = {
    itemId: 'hero_sword',
    placementKey: 'weapon',
    name: 'Hero Sword',
    side: 'you',
    kind: 'weapon',
    alive: true,
    cooldown: nonDarkItem.cooldown,
    baseCooldown: nonDarkItem.cooldown,
    speedScale: 0,
  };
  return {
    t: 1,
    player,
    dummy,
    bus,
    events,
    rng: () => 0,
    pieces: [mrs, dark, nonDark],
    itemsById: new Map([
      ['mrs_struggles', sourceItem],
      ['mr_struggles', darkItem],
      ['hero_sword', nonDarkItem],
    ]),
    graph: {
      pieces: new Map([
        ['mrs', {
          key: 'mrs',
          id: 'mrs_struggles',
          cells: ['0,0'],
          affectCells: [{ cell: '1,0', color: 'primary' }, { cell: '2,0', color: 'primary' }],
        }],
        ['dark', { key: 'dark', id: 'mr_struggles', cells: ['1,0'], affectCells: [] }],
        ['weapon', { key: 'weapon', id: 'hero_sword', cells: ['2,0'], affectCells: [] }],
      ]),
      filled: new Map([
        ['0,0', 'mrs'],
        ['1,0', 'dark'],
        ['2,0', 'weapon'],
      ]),
    },
    canAffect: null,
  };
}

const ctx = makeContext();
handler.onPrepare(ctx.pieces[0], ctx);
assert.equal(ctx.pieces[0].speedScale, 0.1,
  'Mrs Struggles: preparation grants self speed per affected Dark item');
assert.equal(ctx.pieces[1].speedScale, 0,
  'Mrs Struggles: preparation does not speed the linked Dark item');
assert.equal(ctx.pieces[2].speedScale, 0,
  'Mrs Struggles: preparation ignores non-Dark linked items');
assert.equal(typeof handler.onCombatStart, 'undefined',
  'Mrs Struggles: source speed setup is not deferred to combat start');

for (const key of BUFF_KEYS) grantStacks(ctx.dummy, key, 1, { originId: 'fixture' });
handler.onCooldownEffect(ctx.pieces[0], ctx);
assert.equal(BUFF_KEYS.every((key) => getStackAmount(ctx.dummy, key) === 0), true,
  'Mrs Struggles: cooldown removes one stack of every game buff from the opponent');
const activateIndex = ctx.events.findIndex((event) => event.type === 'activate');
const lastSpendIndex = ctx.events.reduce(
  (last, event, index) => event.type === 'buff' && event.amount < 0 ? index : last,
  -1,
);
assert.ok(activateIndex > lastSpendIndex,
  'Mrs Struggles: source activation follows the buff removal effects');

const zero = makeContext({ bonusspeed: 0, p1: 0 });
handler.onPrepare(zero.pieces[0], zero);
assert.equal(zero.pieces[0].speedScale, 0,
  'Mrs Struggles: explicit zero speed remains zero');

console.log('Mrs Struggles source/parity smoke passed.');
