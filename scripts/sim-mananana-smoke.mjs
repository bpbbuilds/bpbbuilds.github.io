import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Mananana.gd', 'utf8');
const foodSource = fs.readFileSync('tools/game-extract-full/Items/Food.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-aura.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'mananana');
const foodItem = catalog.find((item) => item.id === 'banana');

assert.ok(sourceItem, 'Mananana: extracted catalog row');
assert.ok(foodItem, 'Mananana: food fixture');
assert.match(foodSource, /func prepare\(\):[\s\S]*addSpeed\(getNumAffectedItems\(\) \* 0\.1\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getMana\(\) >= manaNeeded[\s\S]*useMana\(manaNeeded\)[\s\S]*heal\(getP_m\("heal"\)[\s\S]*giveStamina\(stamina[\s\S]*activate\(\)/);
assert.match(port, /handlerId: 'mananana'/);
assert.match(port, /onPrepare\(piece, ctx\)/);

const mananana = {
  itemId: 'mananana',
  placementKey: 'mananana',
  name: 'Mananana',
  params: sourceItem.params,
  side: 'you',
  alive: true,
  speedScale: 0,
};
const food = {
  itemId: 'banana',
  placementKey: 'food',
  name: 'Banana',
  side: 'you',
  alive: true,
};
const ctx = {
  t: 0,
  player: createActor('player'),
  dummy: createActor('dummy'),
  events: [],
  rng: () => 0,
  pieces: [mananana, food],
  itemsById: new Map([
    ['mananana', sourceItem],
    ['banana', foodItem],
  ]),
  graph: {
    pieces: new Map([
      ['mananana', { key: 'mananana', id: 'mananana', cells: ['0,0'], affectCells: [
        { cell: '1,0', color: 'primary' },
      ] }],
      ['food', { key: 'food', id: 'banana', cells: ['1,0'], affectCells: [] }],
    ]),
    filled: new Map([['0,0', 'mananana'], ['1,0', 'food']]),
  },
  canAffect: {
    rulesById: {
      mananana: { primary: { op: 'hasType', type: 'Food' } },
    },
  },
};

const handler = getScriptHandler('mananana');
assert.equal(handler?.handlerId, 'mananana');
handler.onPrepare(mananana, ctx);
assert.equal(mananana.speedScale, 0.1,
  'Mananana: Food prepare adds ten percent speed for one linked Food item');

ctx.player.hp = 180;
ctx.player.stamina = 2;
grantStacks(ctx.player, 'mana', 2, { originKey: 'setup', originId: 'setup' });
handler.onCooldownEffect(mananana, ctx);
assert.equal(ctx.player.stacks.mana, 0, 'Mananana: cooldown spends the named Mana cost');
assert.equal(ctx.player.hp, 190, 'Mananana: cooldown applies the exact named heal');
assert.equal(ctx.player.stamina, 4, 'Mananana: cooldown gives the exact named stamina');
assert.equal(ctx.events.at(-1)?.type, 'activate',
  'Mananana: cooldown activates after its resource effects');

const zero = {
  ...mananana,
  placementKey: 'zero-mananana',
  params: { ...sourceItem.params, manat: 0, heal: 0, stamina: 0 },
};
const zeroCtx = {
  ...ctx,
  player: createActor('zero-player'),
  events: [],
};
zeroCtx.player.hp = 180;
zeroCtx.player.stamina = 2;
grantStacks(zeroCtx.player, 'mana', 1, { originKey: 'setup', originId: 'setup' });
handler.onCooldownEffect(zero, zeroCtx);
assert.equal(zeroCtx.player.stacks.mana, 1,
  'Mananana: explicit zero Mana cost does not invent a spend');
assert.equal(zeroCtx.player.hp, 180,
  'Mananana: explicit zero heal does not invent health');
assert.equal(zeroCtx.player.stamina, 2,
  'Mananana: explicit zero stamina does not invent stamina');

console.log('Mananana source/parity smoke passed.');
