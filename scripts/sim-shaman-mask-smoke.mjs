import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { BUFF_KEYS } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ShamanMask.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-buff.js', 'utf8');
const shamanPort = port.slice(
  port.indexOf('export const shamanMaskPort'),
  port.indexOf('/** @type', port.indexOf('export const shamanMaskPort') + 1),
);

assert.match(source, /extends Item/);
assert.match(source, /onready var luckNeeded: int = getP2\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveLucky\(inventory\.countSocketedGems\(\)\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*useLucky\(luckNeeded\)[\s\S]*giveRandomBuffs\(getP3\(\), event\)[\s\S]*activate\(\)/);
assert.match(shamanPort, /gemIds/);
assert.match(shamanPort, /Math\.trunc\(getP2\(/);
assert.match(shamanPort, /giveRandomBuffs\(/);
assert.ok(
  shamanPort.indexOf('giveRandomBuffs(') < shamanPort.indexOf('pushActivate('),
  'random buffs must be granted before activation',
);
assert.doesNotMatch(shamanPort, /Math\.max\(1, Math\.round\(getP2/);
assert.doesNotMatch(shamanPort, /gemNames\.length/);

const piece = {
  itemId: 'shaman_mask',
  placementKey: 'shaman-mask',
  name: 'Shaman Mask',
  params: { p1: 1, p2: 2.9, p3: 2 },
};
const socketedHost = {
  itemId: 'wooden_sword',
  placementKey: 'socketed-host',
  gemIds: ['regular_ruby'],
  gemNames: ['Ruby Rune'],
};
const staleDisplayOnly = {
  itemId: 'wooden_buckler',
  placementKey: 'stale-display-only',
  gemIds: [],
  gemNames: ['Stale Gem Name'],
};
const player = createActor('player');
const ctx = {
  t: 5,
  player,
  events: [],
  pieces: [piece, socketedHost, staleDisplayOnly],
  rng: () => 0.99,
};

const handler = getScriptHandler('shaman_mask');
assert.equal(handler?.handlerId, 'shaman_mask');
handler.onCombatStart(piece, ctx);
assert.equal(player.stacks.lucky, 1, 'only actual socketed gem ids count toward start Lucky');

player.stacks.lucky = 5;
ctx.events.length = 0;
const beforePositiveBuffs = BUFF_KEYS.reduce(
  (sum, stack) => sum + (Number(player.stacks[stack]) || 0),
  0,
);
handler.onCooldownEffect(piece, ctx);
assert.equal(player.stacks.lucky, 3, 'getP2 is integer-truncated without a minimum clamp');
const positiveGrants = ctx.events
  .filter((event) => event.type === 'buff' && Number(event.amount) > 0)
  .reduce((sum, event) => sum + Number(event.amount), 0);
assert.equal(positiveGrants, 2, 'getP3 controls the number of random buff grants');
const afterPositiveBuffs = BUFF_KEYS.reduce(
  (sum, stack) => sum + (Number(player.stacks[stack]) || 0),
  0,
);
assert.equal(afterPositiveBuffs, beforePositiveBuffs, 'spending two Lucky and granting two buffs preserves the total');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Shaman Mask activates after the Lucky spend and grants');

const zeroPiece = {
  ...piece,
  placementKey: 'shaman-mask-zero',
  params: { p2: 0, p3: 1 },
};
const zeroCtx = {
  ...ctx,
  player: createActor('player'),
  events: [],
  pieces: [zeroPiece],
};
handler.onCooldownEffect(zeroPiece, zeroCtx);
assert.equal(
  zeroCtx.events.filter((event) => event.type === 'buff' && Number(event.amount) > 0).length,
  1,
  'a zero Lucky threshold still grants the source random buff before activation',
);
assert.equal(zeroCtx.events.at(-1)?.type, 'activate');

console.log('OK Shaman Mask source and handler regression');
