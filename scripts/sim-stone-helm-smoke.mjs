import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/StoneHelm.gd', 'utf8');
const parentSource = fs.readFileSync('tools/game-extract-full/Items/LeatherHelm.gd', 'utf8');
const portSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-b.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'stone_helm');

assert.ok(sourceItem, 'Stone Helm: extracted catalog row');
assert.match(source, /extends "res:\/\/Items\/LeatherHelm\.gd"/);
assert.match(source, /func getStunProtectChance\(\):[\s\S]*return getChance2\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*giveBlock\(\)[\s\S]*\.onCombatStart\(\)/);
assert.match(parentSource, /func onPrepare\(\):[\s\S]*changeCritResistance\(getChance\(\)\)[\s\S]*changeStunResistance\(getStunProtectChance\(\)\)/);
assert.match(parentSource, /func onPreCombatStart\(\):[\s\S]*changeDamageResistance\(damReduction\)[\s\S]*start\(getBuffDur\(\)/);

const port = portSource.match(/export const stoneHelmPort = \{[\s\S]*?\n\};/u)?.[0] || '';
assert.match(port, /onPrepare\(piece, ctx\)/);
assert.match(port, /onPreCombatStart\(piece, ctx\)/);
assert.match(port, /critResistance/);
assert.match(port, /stunResistance/);
assert.match(port, /pushActivate\(piece/);
assert.ok(getScriptHandler('stone_helm'), 'Stone Helm handler is registered');

function makeContext(params = sourceItem.params, overrides = {}) {
  const player = createActor('player');
  const events = [];
  const piece = {
    itemId: 'stone_helm',
    placementKey: 'helm',
    name: 'Stone Helm',
    kind: 'armor',
    side: 'you',
    alive: true,
    params: { ...params },
    blockGrant: sourceItem.block,
    chance: sourceItem.chance,
    chance2: sourceItem.chance2,
    state: 0,
    ...overrides,
  };
  return {
    t: 0,
    player,
    events,
    piece,
    itemsById: new Map([['stone_helm', sourceItem]]),
  };
}

const ctx = makeContext();
const handler = getScriptHandler('stone_helm');
handler.onPrepare(ctx.piece, ctx);
assert.equal(ctx.player.critResistance, 30, 'Stone Helm inherits the source crit resistance');
assert.equal(ctx.player.stunResistance, 40, 'Stone Helm overrides stun resistance with Chance2');
handler.onPreCombatStart(ctx.piece, ctx);
assert.equal(ctx.player.damageResistancePct, 25, 'Stone Helm starts inherited timed damage resistance');
assert.equal(ctx.piece.state, 1, 'Stone Helm enters the inherited active state');
handler.onCombatStart(ctx.piece, ctx);
assert.equal(ctx.player.block, 35, 'Stone Helm gives its item Block at combat start');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Stone Helm activates after its combat-start Block');

const zero = makeContext({ damagereduction: 0, p1: 0, dur: 0, p2: 0 }, {
  blockGrant: 0,
  chance: 0,
  chance2: 0,
});
handler.onPrepare(zero.piece, zero);
handler.onPreCombatStart(zero.piece, zero);
handler.onCombatStart(zero.piece, zero);
assert.equal(zero.player.block, 0, 'explicit zero Block remains zero');
assert.equal(zero.player.damageResistancePct, 0, 'explicit zero damage resistance remains zero');

console.log('OK Stone Helm source/parity smoke');
