import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/LuckyClover.gd', 'utf8');
const portFile = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-start.js', 'utf8');
const luckyCloverPort = portFile.slice(
  portFile.indexOf('const luckyCloverPort'),
  portFile.indexOf('/** SapphireWhelp.gd', portFile.indexOf('const luckyCloverPort')),
);

assert.equal(inventory.byId.lucky_clover?.file, 'LuckyClover.gd');
assert.match(source, /func onCombatStart\(\):[\s\S]*giveLucky\(getP1\(\)\)[\s\S]*consume\(\)/);
assert.match(luckyCloverPort, /grantStacks\(ctx\.player, 'lucky', getP1\(piece\.params, 0\)/);
assert.match(luckyCloverPort, /consumeStart\(piece, ctx, 'lucky_clover'\)/);
assert.doesNotMatch(luckyCloverPort, /Math\.max\(1/);

const handler = getScriptHandler('lucky_clover');
assert.equal(handler?.handlerId, 'lucky_clover');

const player = createActor('player');
const piece = {
  placementKey: 'clover',
  itemId: 'lucky_clover',
  name: 'Lucky Clover',
  kind: 'passive',
  side: 'you',
  params: { p1: 1.7 },
  alive: true,
  charges: 1,
};
const ctx = { t: 1, player, events: [] };
handler.onCombatStart(piece, ctx);
assert.equal(player.stacks.lucky, 2, 'giveLucky(getP1()) rounds through the shared stack helper');
assert.equal(piece.alive, false, 'consume() deactivates the source item');
assert.equal(piece.charges, 0, 'consume() consumes the source item');
assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 1, 'consume() activates once');

const zeroPlayer = createActor('player');
const zeroPiece = { ...piece, placementKey: 'zero-clover', params: { p1: 0 }, alive: true, charges: 1 };
const zeroCtx = { t: 0, player: zeroPlayer, events: [] };
handler.onCombatStart(zeroPiece, zeroCtx);
assert.equal(zeroPlayer.stacks.lucky, 0, 'an explicit zero Lucky value remains zero');
assert.equal(zeroPiece.alive, false, 'zero-valued Clover still consumes');
assert.equal(zeroCtx.events.filter((event) => event.type === 'activate').length, 1, 'zero-valued Clover still activates');

console.log('OK Lucky Clover source-backed exact Lucky grant, consume ordering, activation, and zero parameter regression');
