import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/LuckyShortbow.gd', 'utf8');
const portFile = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-onhit.js', 'utf8');
const luckyShortbowPort = portFile.slice(
  portFile.indexOf('export const luckyShortbowPort'),
  portFile.indexOf('/** ThornShortbow.gd', portFile.indexOf('export const luckyShortbowPort')),
);

assert.equal(inventory.byId.lucky_shortbow?.file, 'Exclusive/LuckyShortbow.gd');
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*rollChance\(\)[\s\S]*giveLucky\(1\)/);
assert.match(luckyShortbowPort, /onPreDealDamageEarly\(piece, ctx, hit\)/);
assert.match(luckyShortbowPort, /rollItemChance\(piece, ctx\.rng\)/);
assert.match(luckyShortbowPort, /grantStacks\(ctx\.player, 'lucky', 1/);
assert.doesNotMatch(luckyShortbowPort, /onDealtDamage\(/);

const handler = getScriptHandler('lucky_shortbow');
assert.equal(handler?.handlerId, 'lucky_shortbow');
assert.equal(typeof handler?.onPreDealDamageEarly, 'function');
assert.equal(handler?.onDealtDamage, undefined, 'the source hook is pre-damage, not post-damage');

const piece = {
  placementKey: 'shortbow',
  itemId: 'lucky_shortbow',
  name: 'Lucky Shortbow',
  kind: 'weapon',
  side: 'you',
  chance: 100,
};
const ctx = { t: 1, player: createActor('player'), events: [], rng: () => 0 };
handler.onPreDealDamageEarly(piece, ctx, { hit: true });
assert.equal(ctx.player.stacks.lucky, 1, 'a successful pre-damage chance roll grants one Lucky');
assert.equal(ctx.events.filter((event) => event.type === 'buff').length, 1, 'Lucky is logged once');

const missCtx = { t: 1, player: createActor('player'), events: [], rng: () => 0 };
handler.onPreDealDamageEarly(piece, missCtx, { hit: false });
assert.equal(missCtx.player.stacks.lucky, 0, 'misses do not grant Lucky');

const failedChancePiece = { ...piece, chance: 0 };
const failedChanceCtx = { t: 1, player: createActor('player'), events: [], rng: () => 0 };
handler.onPreDealDamageEarly(failedChancePiece, failedChanceCtx, { hit: true });
assert.equal(failedChanceCtx.player.stacks.lucky, 0, 'failed chance rolls do not grant Lucky');

console.log('OK Lucky Shortbow source-backed pre-damage hook, hit guard, chance roll, Lucky grant, and miss/failure regression');
