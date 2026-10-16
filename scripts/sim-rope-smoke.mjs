import assert from 'node:assert/strict';
import fs from 'node:fs';

import { tickTimedSpeeds } from '../js/pages/sim/engine/timed-speed.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const canAffect = { rulesById: rules.byId || null };
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Rope.gd', 'utf8');
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-an-accessories.js',
  'utf8',
);
const ropePort = port.slice(
  port.indexOf('const ropePort'),
  port.indexOf('/** @type {Record<string, ScriptHandler>} */', port.indexOf('const ropePort')),
);

assert.match(source, /extends Item/);
assert.match(source, /func canAffect\(item\):[\s\S]*item\.canActivate\(\)/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*item\.hasCooldown\(\)/);
assert.match(
  source,
  /func onPrepare\(\):[\s\S]*getAffectedItems\(Affected\.Secondary\)[\s\S]*speedUpItem = item[\s\S]*getAffectedItems\(\)[\s\S]*connectForCombat\(triggerItem, "activated", "onTriggerItemActivated"\)/,
);
assert.match(
  source,
  /func onTriggerItemActivated\(event\):[\s\S]*speedLeft = maxSpeed - curSpeed[\s\S]*speedUpItem\.addSpeed\(min\(speedLeft, speedPerTrigger\)\)[\s\S]*speedTimer\.start\(getP_m\("dur"\)\)[\s\S]*miniActivate\(\)/,
);
assert.match(source, /func onSpeedTimeout\(\):[\s\S]*speedUpItem\.reduceSpeed\(min\(speedLeft, speedPerTrigger\)\)/);
assert.match(port, /function ropeSecondaryTarget\(ctx, piece\)[\s\S]*link\.color === 'secondary'/);
assert.match(port, /function ropeSecondaryTarget\(ctx, piece\)[\s\S]*Number\(ctx\.itemsById\.get\(other\.itemId\)\?\.cooldown\) > 0/);
assert.match(port, /function ropeSecondaryTarget\(ctx, piece\)[\s\S]*\.at\(-1\) \|\| null/);
assert.match(ropePort, /link\.color !== 'secondary'/);
assert.match(port, /function ropeSpeedParams\(piece\)[\s\S]*getPName\(piece\.params, 'speed', getP1\(piece\.params, 0\)\)/);
assert.match(port, /function ropeSpeedParams\(piece\)[\s\S]*getPName\(piece\.params, 'dur', getP2\(piece\.params, 0\)\)/);
assert.match(ropePort, /miniActivate: true/);

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  assert.ok(item, `catalog item ${id} exists`);
  return {
    ...item,
    ...overrides,
    itemId: id,
    placementKey: key,
    name: overrides.name || item.displayName || item.name || id,
    speedScale: 0,
    alive: true,
  };
}

const rope = piece('rope', 'rope', {
  params: { speed: 10, p1: 10, dur: 6, p2: 6, max: 50, p3: 50 },
});
const trigger = piece('wooden_sword', 'trigger', { cooldown: 1.5 });
const firstSecondary = piece('magic_torch', 'first-secondary', { cooldown: 1.8 });
const lastSecondary = piece('torch', 'last-secondary', { cooldown: 1.5 });
const noCooldown = piece('wooden_buckler', 'no-cooldown', { cooldown: 0 });
const graph = {
  pieces: new Map([
    [rope.placementKey, {
      key: rope.placementKey,
      id: rope.itemId,
      cells: ['rope-cell'],
      affectCells: [
        { cell: 'primary-cell', color: 'primary' },
        { cell: 'first-secondary-cell', color: 'secondary' },
        { cell: 'last-secondary-cell', color: 'secondary' },
        { cell: 'no-cooldown-cell', color: 'secondary' },
      ],
    }],
    [trigger.placementKey, { key: trigger.placementKey, id: trigger.itemId, cells: ['primary-cell'], affectCells: [] }],
    [firstSecondary.placementKey, { key: firstSecondary.placementKey, id: firstSecondary.itemId, cells: ['first-secondary-cell'], affectCells: [] }],
    [lastSecondary.placementKey, { key: lastSecondary.placementKey, id: lastSecondary.itemId, cells: ['last-secondary-cell'], affectCells: [] }],
    [noCooldown.placementKey, { key: noCooldown.placementKey, id: noCooldown.itemId, cells: ['no-cooldown-cell'], affectCells: [] }],
  ]),
  filled: new Map([
    ['rope-cell', rope.placementKey],
    ['primary-cell', trigger.placementKey],
    ['first-secondary-cell', firstSecondary.placementKey],
    ['last-secondary-cell', lastSecondary.placementKey],
    ['no-cooldown-cell', noCooldown.placementKey],
  ]),
};
const ctx = {
  graph,
  canAffect,
  itemsById: byId,
  pieces: [rope, trigger, firstSecondary, lastSecondary, noCooldown],
  events: [],
  t: 0,
};
const handler = getScriptHandler('rope');
assert.equal(handler?.handlerId, 'rope');

handler.onPrepare(rope, ctx);
assert.equal(rope._ropeTarget, lastSecondary, 'source uses the last affected secondary cooldown item');

handler.onPeerActivated(rope, firstSecondary, ctx);
assert.equal(lastSecondary.speedScale, 0, 'secondary activations do not trigger Rope');
assert.equal(ctx.events.length, 0);

handler.onPeerActivated(rope, trigger, ctx);
assert.equal(lastSecondary.speedScale, 0.1, 'a primary activation adds source speed to the secondary target');
assert.equal(ctx.events.at(-1)?.type, 'info');
assert.equal(ctx.events.at(-1)?.meta?.miniActivate, true, 'Rope miniActivate is non-metric');
tickTimedSpeeds([rope, lastSecondary], 6);
assert.equal(lastSecondary.speedScale, 0, 'Rope speed expires after the source duration');

const capped = piece('rope', 'capped-rope', {
  params: { speed: 10, p1: 10, dur: 6, p2: 6, max: 50, p3: 50 },
});
const cappedTarget = piece('torch', 'capped-target', { cooldown: 1.5 });
const cappedTrigger = piece('wooden_sword', 'capped-trigger', { cooldown: 1.5 });
const cappedGraph = {
  pieces: new Map([
    [capped.placementKey, { key: capped.placementKey, id: capped.itemId, cells: ['capped-rope-cell'], affectCells: [{ cell: 'capped-primary-cell', color: 'primary' }, { cell: 'capped-secondary-cell', color: 'secondary' }] }],
    [cappedTrigger.placementKey, { key: cappedTrigger.placementKey, id: cappedTrigger.itemId, cells: ['capped-primary-cell'], affectCells: [] }],
    [cappedTarget.placementKey, { key: cappedTarget.placementKey, id: cappedTarget.itemId, cells: ['capped-secondary-cell'], affectCells: [] }],
  ]),
  filled: new Map([
    ['capped-rope-cell', capped.placementKey],
    ['capped-primary-cell', cappedTrigger.placementKey],
    ['capped-secondary-cell', cappedTarget.placementKey],
  ]),
};
const cappedCtx = {
  graph: cappedGraph,
  canAffect,
  itemsById: byId,
  pieces: [capped, cappedTrigger, cappedTarget],
  events: [],
  t: 0,
};
handler.onPrepare(capped, cappedCtx);
for (let i = 0; i < 6; i += 1) handler.onPeerActivated(capped, cappedTrigger, cappedCtx);
assert.equal(cappedTarget.speedScale, 0.5, 'Rope caps visible speed at max');
assert.equal(cappedCtx.events.length, 6, 'each primary activation mini-activates Rope');

const sparse = piece('rope', 'sparse-rope', { params: {} });
const sparseCtx = { ...ctx, pieces: [sparse], events: [], graph: { pieces: new Map([[sparse.placementKey, { key: sparse.placementKey, id: sparse.itemId, cells: ['sparse'], affectCells: [] }]]), filled: new Map([['sparse', sparse.placementKey]]) } };
handler.onPrepare(sparse, sparseCtx);
assert.equal(sparse._ropeTarget, null, 'missing links do not fabricate a Rope target');
assert.equal(sparse._ropeSpeedupTotal, 0);

console.log('OK Rope source and handler regression');
