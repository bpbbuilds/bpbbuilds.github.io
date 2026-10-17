import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MegaClover.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-an-accessories.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'mega_clover');

assert.ok(sourceItem, 'Mega Clover: extracted catalog row');
assert.match(source, /func _ready\(\):[\s\S]*stackTypes = Game\.getBuffs\(\)[\s\S]*stackTypes\.erase\(Game\.EventType\.Lucky\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*character_lucky_changed[\s\S]*activated = false/);
assert.match(source, /func onLuckyChanged\(amount, event\):[\s\S]*getLucky\(\) >= luckNeeded[\s\S]*giveRandomBuffs\(numBuffs, event, stackTypes\)[\s\S]*activate\(\)/);
assert.match(port, /handlerId: 'mega_clover'/);
assert.match(port, /onPrepare\(piece, ctx\)/);

function context(params = sourceItem.params) {
  return {
    t: 0,
    player: createActor('player'),
    dummy: createActor('dummy'),
    events: [],
    rng: () => 0,
    pieces: [],
    itemsById: new Map([['mega_clover', sourceItem]]),
    params,
  };
}

const handler = getScriptHandler('mega_clover');
assert.equal(handler?.handlerId, 'mega_clover');
const ctx = context();
const clover = {
  itemId: 'mega_clover',
  placementKey: 'clover',
  name: 'Mega Clover',
  params: sourceItem.params,
  side: 'you',
  alive: true,
};
ctx.pieces = [clover];
handler.onPrepare(clover, ctx);
grantStacks(ctx.player, 'lucky', 15, { originKey: 'setup', originId: 'setup' });
assert.equal(ctx.player.stacks.lucky, 15,
  'Mega Clover: Lucky is used only as the threshold and is not spent');
assert.equal(ctx.player.stacks.regeneration, 22,
  'Mega Clover: random buffs use the source pool without Lucky');
assert.equal(ctx.events.at(-1)?.type, 'activate',
  'Mega Clover: activation follows its random-buff grant');

grantStacks(ctx.player, 'lucky', 15, { originKey: 'setup-2', originId: 'setup-2' });
assert.equal(ctx.player.stacks.regeneration, 22,
  'Mega Clover: source activated flag prevents a second threshold burst');

const zeroCtx = context({
  ...sourceItem.params,
  luckneeded: 0,
  p1: 0,
  buffs: 0,
  p2: 0,
});
const zero = {
  ...clover,
  placementKey: 'zero-clover',
  params: zeroCtx.params,
};
zeroCtx.pieces = [zero];
handler.onPrepare(zero, zeroCtx);
grantStacks(zeroCtx.player, 'lucky', 1, { originKey: 'setup', originId: 'setup' });
assert.equal(zeroCtx.player.stacks.regeneration, 0,
  'Mega Clover: explicit zero random-buff count does not invent a buff');
assert.equal(zeroCtx.events.at(-1)?.type, 'activate',
  'Mega Clover: explicit zero threshold still activates once');

console.log('Mega Clover source/parity smoke passed.');
