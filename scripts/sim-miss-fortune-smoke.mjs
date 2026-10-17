import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MissFortune.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports.js', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = rawCatalog.items || rawCatalog;
const sourceItem = catalog.find((item) => item.id === 'miss_fortune');

assert.ok(sourceItem, 'Miss Fortune: extracted catalog row');
assert.match(source, /func doCooldownEffect\(\):[\s\S]*getLucky\(\) >= luckNeeded[\s\S]*useLucky\(luckNeeded\)[\s\S]*giveMostBuffs\(numBuffs, event\)[\s\S]*activate\(\)/);
assert.match(port, /handlerId: 'miss_fortune'/);
assert.match(port, /getPName\(piece\.params, 'luck'/);
assert.match(port, /getPName\(piece\.params, 'buffs'/);

function makeContext(params = sourceItem.params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const events = [];
  player._eventLog = events;
  dummy._eventLog = events;
  const piece = {
    itemId: 'miss_fortune',
    placementKey: 'fortune',
    name: 'Miss Fortune',
    params: { ...params },
    side: 'you',
    kind: 'accessory',
    alive: true,
    baseCooldown: sourceItem.cooldown,
    cooldown: sourceItem.cooldown,
  };
  return {
    t: 4,
    player,
    dummy,
    events,
    rng: () => 0,
    pieces: [piece],
  };
}

const handler = getScriptHandler('miss_fortune');
assert.equal(handler?.handlerId, 'miss_fortune');

const ctx = makeContext();
bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
const fortune = ctx.pieces[0];
ctx.player.stacks.lucky = 1;
ctx.player.stacks.regeneration = 5;
handler.onCooldownEffect(fortune, ctx);
assert.equal(ctx.player.stacks.lucky, 0,
  'Miss Fortune: exact Lucky cost is spent before the most-held buff is granted');
assert.equal(ctx.player.stacks.regeneration, 8,
  'Miss Fortune: exact source buff count is granted to the most-held buff');
const grantIndex = ctx.events.findIndex((event) =>
  event.meta?.stack === 'regeneration' && event.amount === 3);
const activateIndex = ctx.events.findIndex((event) => event.type === 'activate');
assert.ok(grantIndex >= 0, 'Miss Fortune: buff grant is present in the combat log');
assert.ok(activateIndex > grantIndex,
  'Miss Fortune: activation follows lucky spend and giveMostBuffs');

const noLuck = makeContext();
const noLuckPiece = noLuck.pieces[0];
bindBuffCombatLog({ events: noLuck.events, getT: () => noLuck.t, dummy: noLuck.dummy });
handler.onCooldownEffect(noLuckPiece, noLuck);
assert.equal(noLuck.events.filter((event) => event.type === 'activate').length, 1,
  'Miss Fortune: cooldown always activates without enough Lucky');
assert.equal(noLuck.player.stacks.regeneration || 0, 0,
  'Miss Fortune: insufficient Lucky skips the buff branch');

const zero = makeContext({ luck: 0, p1: 0, buffs: 0, p2: 0 });
bindBuffCombatLog({ events: zero.events, getT: () => zero.t, dummy: zero.dummy });
handler.onCooldownEffect(zero.pieces[0], zero);
assert.equal(zero.player.stacks.lucky || 0, 0,
  'Miss Fortune: explicit zero Lucky requirement does not spend Lucky');
assert.equal(zero.player.stacks.regeneration || 0, 0,
  'Miss Fortune: explicit zero buff count does not invent a grant');
assert.equal(zero.events.filter((event) => event.type === 'activate').length, 1,
  'Miss Fortune: explicit zero parameters still preserve the unconditional activation');

unbindBuffCombatLog();
console.log('Miss Fortune source/parity smoke passed.');
