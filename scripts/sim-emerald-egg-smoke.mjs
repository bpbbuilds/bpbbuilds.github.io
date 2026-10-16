import assert from 'node:assert/strict';
import fs from 'node:fs';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/EmeraldEgg.gd', 'utf8');
assert.match(source, /extends DragonEgg/);
assert.match(source, /func onCombatStart\(\):\s*doCooldownEffect\(\)/);
assert.match(source, /func doCooldownEffect\(\):\s*giveLucky\(getP1\(\)\)\s*activate\(\)/);

const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-am-eggs.js', 'utf8');
const emeraldBlock = handlerSource.match(/export const emeraldEggPort = \{[\s\S]*?\n\};/u)?.[0];
assert.ok(emeraldBlock, 'Emerald Egg handler block exists');
const grantIndex = emeraldBlock.indexOf("grantStacks(ctx.player, 'lucky'");
const activateIndex = emeraldBlock.indexOf("petActivate(piece, ctx, 'emerald_egg')");
assert.ok(grantIndex >= 0 && grantIndex < activateIndex, 'Lucky is granted before activation');
assert.doesNotMatch(emeraldBlock, /Math\.max\(1, Math\.round\(getP1/);

const sourceItem = inventory.byId.emerald_egg;
assert.equal(sourceItem.file, 'Exclusive/EmeraldEgg.gd');
assert.deepEqual(sourceItem.overrides.sort(), ['doCooldownEffect', 'onCombatStart']);
const handler = getScriptHandler('emerald_egg');
assert.equal(typeof handler?.onCombatStart, 'function');
assert.equal(typeof handler?.onCooldownEffect, 'function');

function piece(params) {
  return {
    itemId: 'emerald_egg',
    placementKey: 'you:emerald-egg',
    name: 'Emerald Egg',
    params,
    side: 'you',
    alive: true,
  };
}

const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
const ctx = { player, dummy, events, t: 0, rng: () => 0 };
handler.onCombatStart(piece({ p1: 3 }), ctx);
assert.equal(player.stacks.lucky, 3, 'combat start grants source Lucky amount');
assert.equal(events.filter((event) => event.type === 'activate' && event.itemId === 'emerald_egg').length, 1);

handler.onCooldownEffect(piece({ p1: 3 }), { ...ctx, t: 4 });
assert.equal(player.stacks.lucky, 6, 'cooldown grants source Lucky amount');
assert.equal(events.filter((event) => event.type === 'activate' && event.itemId === 'emerald_egg').length, 2);

const zeroPlayer = createActor('player');
const zeroEvents = [];
const zeroCtx = { player: zeroPlayer, dummy: createActor('dummy'), events: zeroEvents, t: 0, rng: () => 0 };
handler.onCombatStart(piece({ p1: 0 }), zeroCtx);
assert.equal(zeroPlayer.stacks.lucky, 0, 'typed zero Lucky stays zero');
assert.equal(zeroEvents.filter((event) => event.type === 'activate' && event.itemId === 'emerald_egg').length, 1);

console.log('OK Emerald Egg source/order/Lucky smoke');
