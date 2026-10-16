import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { tickTimedResistances } from '../js/pages/sim/engine/timed-resistance.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Sandbag.gd', 'utf8');
const leatherHelm = fs.readFileSync('tools/game-extract-full/Items/LeatherHelm.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-consumable.js', 'utf8');
const sandbagPort = port.slice(
  port.indexOf('function sandbagParams'),
  port.indexOf('/** @type {ScriptHandler} */', port.indexOf('export const sandbagPort') + 1),
);

assert.match(source, /extends "res:\/\/Items\/LeatherHelm\.gd"/);
assert.match(source, /func onPrepare\(\):[\s\S]*pass/);
assert.match(
  source,
  /func onPreCombatStart\(\):[\s\S]*Game\.sandbagActive[\s\S]*\.onPreCombatStart\(\)[\s\S]*opponent\(\)\.changeDamageResistance\(damReduction\)[\s\S]*Util\.changeTimer\(buffTimer, getBuffDur\(\)/,
);
assert.match(source, /func onCombatStart\(\):[\s\S]*inflictBlind\(blind\)[\s\S]*giveStacks\(character\(\), Game\.EventType\.Blind, blind\)[\s\S]*activate\(\)/);
assert.match(source, /func buffEnded\(\):[\s\S]*\.buffEnded\(\)[\s\S]*opponent\(\)\.changeDamageResistance\( - damReduction\)/);
assert.match(leatherHelm, /func onPreCombatStart\(\):[\s\S]*changeDamageResistance\(damReduction\)[\s\S]*buffTimer\.start\(getBuffDur\(\)/);
assert.match(sandbagPort, /onPrepare\(piece\)/);
assert.match(sandbagPort, /onPreCombatStart\(piece, ctx\)/);
assert.match(sandbagPort, /grantTimedResistancePct/);
assert.match(sandbagPort, /getPName\(piece\.params, 'blind', getP3\(piece\.params, 0\)\)/);
assert.match(sandbagPort, /pushActivate\(piece, ctx, 'sandbag'/);

function item(params, placementKey = 'sandbag') {
  const base = byId.get('sandbag');
  assert.ok(base, 'catalog item sandbag exists');
  return {
    ...base,
    itemId: 'sandbag',
    name: 'Sandbag',
    placementKey,
    params,
    alive: true,
  };
}

function context(piece, t = 2) {
  return {
    player: createActor('player'),
    dummy: createActor('dummy'),
    events: [],
    itemsById: byId,
    pieces: [piece],
    t,
    rng: () => 0,
  };
}

const handler = getScriptHandler('sandbag');
assert.equal(handler?.handlerId, 'sandbag');

const sandbag = item({ damreduction: 25, p1: 25, dur: 7, p2: 7, blind: 3, p3: 3 });
const ctx = context(sandbag);
handler.onPrepare(sandbag, ctx);
handler.onPreCombatStart(sandbag, ctx);
assert.equal(ctx.player.damageResistancePct, 25, 'LeatherHelm parent adds self damage resistance');
assert.equal(ctx.dummy.damageResistancePct, 25, 'Sandbag adds the same damage resistance to the opponent');
assert.equal(sandbag._sandbagBuffsActive, 1, 'pre-combat arms the Sandbag buff state');
assert.equal(ctx.player._sandbagActive, true, 'pre-combat sets the shared active guard');
assert.equal(ctx.player._timedResists?.[0]?.untilT, 9, 'source duration starts from combat time');

handler.onCombatStart(sandbag, ctx);
assert.equal(ctx.player.stacks.blind, 3, 'combat start blinds the Sandbag owner');
assert.equal(ctx.dummy.stacks.blind, 3, 'combat start blinds the opponent');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Blind effects finish before activation');
assert.equal(ctx.events.at(-1)?.itemId, 'sandbag');

tickTimedResistances([ctx.player, ctx.dummy], 9);
assert.equal(ctx.player.damageResistancePct, 0, 'owner resistance expires at the source duration');
assert.equal(ctx.dummy.damageResistancePct, 0, 'opponent resistance expires with the same timer');
assert.equal(sandbag._sandbagBuffsActive, 0, 'timer expiry clears the active buff count');
assert.equal(ctx.player._sandbagActive, false, 'timer expiry clears the shared active guard');

const sparse = item({}, 'sparse-sandbag');
const sparseCtx = context(sparse);
handler.onPrepare(sparse, sparseCtx);
handler.onPreCombatStart(sparse, sparseCtx);
handler.onCombatStart(sparse, sparseCtx);
assert.equal(sparseCtx.player.damageResistancePct, 0, 'missing damage reduction does not fabricate resistance');
assert.equal(sparseCtx.dummy.damageResistancePct, 0, 'missing damage reduction does not affect the opponent');
assert.equal(sparseCtx.player.stacks.blind || 0, 0, 'missing Blind does not fabricate a self debuff');
assert.equal(sparseCtx.dummy.stacks.blind || 0, 0, 'missing Blind does not fabricate an opponent debuff');
assert.equal(sparseCtx.events.at(-1)?.type, 'activate', 'activation still follows the source start hook');

console.log('OK Sandbag source and handler regression');
