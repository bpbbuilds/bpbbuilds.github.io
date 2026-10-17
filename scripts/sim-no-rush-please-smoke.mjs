import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { gainStacks } from '../js/pages/sim/engine/stacks.js';
import { tickTimedResistances } from '../js/pages/sim/engine/timed-resistance.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/NoRushPlease.gd', 'utf8');
const helmSource = fs.readFileSync('tools/game-extract-full/Items/LeatherHelm.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ai-e.js', 'utf8');
const catalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8')).items;
const sourceItem = catalog.find((item) => item.id === 'no_rush_please');

assert.ok(sourceItem, 'No Rush Please: extracted catalog row');
assert.match(source, /extends "res:\/\/Items\/LeatherHelm\.gd"/);
assert.match(source, /func onPrepare\(\):[\s\S]*pass/);
assert.match(source, /func onPreCombatStart\(\):[\s\S]*\.onPreCombatStart\(\)[\s\S]*opponent\(\)\.changeDamageResistance\(damReduction\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*inflictCold\(cold\)[\s\S]*\.onCombatStart\(\)/);
assert.match(helmSource, /func onPreCombatStart\(\):[\s\S]*changeDamageResistance\(damReduction\)[\s\S]*buffTimer\.start\(getBuffDur\(\)/);
assert.match(port, /handlerId: 'no_rush_please'/);
const rushPort = port.match(/export const noRushPleasePort[\s\S]*?\n\};/u)?.[0] || '';
assert.match(rushPort, /onPreCombatStart\(piece, ctx\)/);
assert.match(rushPort, /leatherHelmPort/);
assert.match(rushPort, /grantTimedResistancePct\(\s*ctx\.dummy/);
assert.doesNotMatch(rushPort, /Math\.max\(1,\s*Math\.round\(getPName\(piece\.params, 'cold'/,
  'No Rush Please: explicit zero Cold must not become one');

const handler = getScriptHandler('no_rush_please');
assert.equal(handler?.handlerId, 'no_rush_please');

function makeContext(params = sourceItem.params) {
  const player = createActor('player');
  const dummy = createActor('dummy');
  const bus = createCombatBus();
  const events = [];
  player._combatBus = bus;
  dummy._combatBus = bus;
  player._eventLog = events;
  dummy._eventLog = events;
  const piece = {
    itemId: 'no_rush_please',
    placementKey: 'rush',
    name: 'No Rush Please',
    params: { ...params },
    side: 'you',
    kind: 'skill',
    alive: true,
  };
  return {
    t: 0,
    player,
    dummy,
    bus,
    events,
    rng: () => 0,
    pieces: [piece],
    itemsById: new Map([['no_rush_please', sourceItem]]),
  };
}

const ctx = makeContext();
handler.onPrepare(ctx.pieces[0], ctx);
assert.equal(ctx.player.critResistance, 0,
  'No Rush Please: the source no-op onPrepare does not inherit Leather Helm resistances');
assert.equal(ctx.player.stunResistance, 0,
  'No Rush Please: the source no-op onPrepare does not inherit Leather Helm resistances');
handler.onPreCombatStart(ctx.pieces[0], ctx);
assert.equal(ctx.player.damageResistancePct, 35,
  'No Rush Please: inherited pre-combat hook grants self damage resistance');
assert.equal(ctx.dummy.damageResistancePct, 35,
  'No Rush Please: override grants the same damage resistance to the opponent');
handler.onCombatStart(ctx.pieces[0], ctx);
assert.equal(ctx.dummy.stacks.cold, 5,
  'No Rush Please: combat start inflicts the exact Cold amount');
assert.equal(ctx.events.filter((event) => event.type === 'activate').length, 1,
  'No Rush Please: inherited combat-start activation is projected once');
tickTimedResistances([ctx.player, ctx.dummy], 10);
assert.equal(ctx.player.damageResistancePct, 0,
  'No Rush Please: inherited self resistance expires at the source duration');
assert.equal(ctx.dummy.damageResistancePct, 0,
  'No Rush Please: opponent resistance expires at the source duration');

const zero = makeContext({ damreduction: 0, p1: 0, dur: 0, p2: 0, cold: 0, p3: 0 });
handler.onPreCombatStart(zero.pieces[0], zero);
handler.onCombatStart(zero.pieces[0], zero);
assert.equal(zero.player.damageResistancePct, 0, 'No Rush Please: zero DR remains zero');
assert.equal(zero.dummy.damageResistancePct, 0, 'No Rush Please: zero opponent DR remains zero');
assert.equal(zero.dummy.stacks.cold, 0, 'No Rush Please: explicit zero Cold remains zero');
assert.equal(zero.events.filter((event) => event.type === 'activate').length, 1,
  'No Rush Please: zero values do not suppress source activation');

console.log('No Rush Please source/parity smoke passed.');
