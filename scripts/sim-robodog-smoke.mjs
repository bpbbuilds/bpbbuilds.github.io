import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/Robodog.gd',
  'utf8',
);
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-ai-c2.js',
  'utf8',
);
const roboPort = port.slice(
  port.indexOf('export const robodogPort'),
  port.indexOf('/** Sloth lives', port.indexOf('export const robodogPort')),
);

assert.match(source, /extends Item/);
assert.match(source, /func onPrepare\(\):[\s\S]*dragParticlesEnabled = false/);
assert.match(
  source,
  /func onChargeReceived\(_charge\):[\s\S]*resetBaseCooldown\(\)[\s\S]*numCharges == 1[\s\S]*setState\(true\)/,
);
assert.match(
  source,
  /func onChargeLeft\(_charge\):[\s\S]*numCharges == 0[\s\S]*setState\(false\)/,
);
assert.match(
  source,
  /func doCooldownEffect\(\):[\s\S]*giveLucky\(luck\)[\s\S]*giveHeat\(heat\)[\s\S]*numCharges == 0[\s\S]*setBaseCooldown\(baseCooldownOverride \+ cdIncrease\)[\s\S]*activate\(\)/,
);
assert.match(roboPort, /onChargeReceived\(piece\)/);
assert.match(roboPort, /onChargeLeft\(piece\)/);
assert.match(roboPort, /getPName\(piece\.params, 'luck', getP1\(piece\.params, 0\)\)/);
assert.match(roboPort, /getPName\(piece\.params, 'heat', getP2\(piece\.params, 0\)\)/);
assert.match(roboPort, /getPName\(piece\.params, 'cdincrease', getP3\(piece\.params, 0\)\)/);
assert.match(roboPort, /pushActivate\(piece, ctx, 'robodog'/);

function item(overrides = {}) {
  const base = byId.get('robodog');
  assert.ok(base, 'catalog item robodog exists');
  return {
    ...base,
    ...overrides,
    itemId: 'robodog',
    name: 'Robodog',
    placementKey: overrides.placementKey || 'robodog',
    params: overrides.params || base.params,
    alive: true,
  };
}

function context(piece) {
  return {
    player: createActor('player'),
    dummy: createActor('dummy'),
    events: [],
    itemsById: byId,
    pieces: [piece],
    t: 3,
  };
}

const handler = getScriptHandler('robodog');
assert.equal(handler?.handlerId, 'robodog');

const robo = item({
  baseCooldown: 1.9,
  cooldown: 1.9,
  numCharges: 0,
  params: { luck: 1, p1: 1, heat: 1, p2: 1, cdincrease: 0.5, p3: 0.5 },
});
const ctx = context(robo);
handler.onPrepare(robo, ctx);
assert.equal(robo._roboCharged, false, 'prepare starts uncharged');
handler.onCombatStart(robo, ctx);
assert.equal(robo._roboBaseCd, 1.9);

robo.baseCooldown = 2.4;
robo.cooldown = 2.4;
robo.numCharges = 1;
handler.onChargeReceived(robo, ctx);
assert.equal(robo.baseCooldown, 1.9, 'charge resets the base cooldown');
assert.equal(robo.cooldown, 1.9, 'charge resets the live cooldown');
assert.equal(robo._roboCharged, true, 'first charge enters the charged state');
robo.numCharges = 0;
handler.onChargeLeft(robo, ctx);
assert.equal(robo._roboCharged, false, 'last charge leaving clears the charged state');

handler.onCooldownEffect(robo, ctx);
assert.equal(ctx.player.stacks.lucky, 1, 'uncharged cooldown gives Lucky');
assert.equal(ctx.player.stacks.heat, 1, 'uncharged cooldown gives Heat');
assert.equal(robo.baseCooldown, 2.4, 'uncharged cooldown grows from the current base cooldown');
assert.equal(robo.cooldown, 2.4);
assert.equal(ctx.events.at(-1)?.type, 'activate', 'uncharged cooldown activates after Lucky/Heat');

const charged = item({
  placementKey: 'charged-robo',
  baseCooldown: 1.9,
  cooldown: 1.9,
  numCharges: 1,
  params: { luck: 1, p1: 1, heat: 1, p2: 1, cdincrease: 0.5, p3: 0.5 },
});
const chargedCtx = context(charged);
handler.onCooldownEffect(charged, chargedCtx);
assert.equal(chargedCtx.player.stacks.lucky, 1, 'charged cooldown still gives Lucky');
assert.equal(chargedCtx.player.stacks.heat, 1, 'charged cooldown still gives Heat');
assert.equal(charged.baseCooldown, 1.9, 'charged cooldown does not grow the base cooldown');
assert.equal(chargedCtx.events.some((event) => event.type === 'activate'), false, 'charged cooldown does not activate');

const sparse = item({
  placementKey: 'sparse-robo',
  baseCooldown: 1.9,
  cooldown: 1.9,
  numCharges: 0,
  params: {},
});
const sparseCtx = context(sparse);
handler.onCooldownEffect(sparse, sparseCtx);
assert.equal(sparseCtx.player.stacks.lucky || 0, 0, 'missing luck does not fabricate Lucky');
assert.equal(sparseCtx.player.stacks.heat || 0, 0, 'missing heat does not fabricate Heat');
assert.equal(sparse.baseCooldown, 1.9, 'missing cd increase does not fabricate cooldown growth');
assert.equal(sparseCtx.events.at(-1)?.type, 'activate', 'activation still follows the uncharged branch');

console.log('OK Robodog source and handler regression');
