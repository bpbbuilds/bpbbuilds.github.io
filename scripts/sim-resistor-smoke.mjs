import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { getStackAmount } from '../js/pages/sim/engine/stacks.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/Resistor.gd',
  'utf8',
);
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-ai-hard.js',
  'utf8',
);
const resistorPort = port.slice(
  port.indexOf('export const resistorPort'),
  port.indexOf('/** LeatherBoots.gd', port.indexOf('export const resistorPort')),
);

assert.match(source, /onready var heatThreshold: = int\(getP\("heatt"\)\)/);
assert.match(source, /onready var heat: = int\(getP\("heat"\)\)/);
assert.match(source, /if character\(\)\.getHeat\(\) < heatThreshold:[\s\S]*giveHeat\(heat\)[\s\S]*miniActivate\(\)/);
assert.match(resistorPort, /getPName\(piece\.params, 'heatt', getP1\(piece\.params, 0\)\)/);
assert.match(resistorPort, /getPName\(piece\.params, 'heat', getP2\(piece\.params, 0\)\)/);
assert.doesNotMatch(resistorPort, /Math\.max\(\s*1[\s\S]*heatT/);
assert.match(resistorPort, /type: 'info'[\s\S]*miniActivate: true/);

function item(id, overrides = {}) {
  const base = byId.get(id);
  assert.ok(base, `catalog item ${id} exists`);
  return {
    ...base,
    ...overrides,
    itemId: id,
    placementKey: overrides.placementKey || id,
    alive: true,
  };
}

const resistor = item('resistor', {
  params: { heatt: 20, p1: 20, heat: 3, p2: 3 },
  placementKey: 'resistor-piece',
});
const player = createActor('player');
const events = [];
const ctx = { player, events, t: 4, rng: () => 0 };
const handler = getScriptHandler('resistor');
assert.equal(handler?.handlerId, 'resistor');

handler.onChargeReceived(resistor, ctx);
assert.equal(getStackAmount(player, 'heat'), 3, 'charge gives the configured Heat amount below threshold');
assert.equal(events.filter((event) => event.type === 'activate').length, 0, 'miniActivate is not a normal activation');
assert.equal(events.at(-1)?.type, 'info');
assert.equal(events.at(-1)?.meta?.miniActivate, true);
assert.equal(events.at(-1)?.label, 'Resistor: mini activate');

const eventCountAtThreshold = events.length;
player.stacks.heat = 20;
handler.onChargeReceived(resistor, ctx);
assert.equal(getStackAmount(player, 'heat'), 20, 'charge at threshold does not add Heat');
assert.equal(events.length, eventCountAtThreshold, 'threshold failure has no mini activation');

const sparse = item('resistor', { placementKey: 'sparse-resistor', params: {} });
const sparsePlayer = createActor('player');
const sparseEvents = [];
handler.onChargeReceived(sparse, {
  ...ctx,
  player: sparsePlayer,
  events: sparseEvents,
});
assert.equal(getStackAmount(sparsePlayer, 'heat'), 0, 'missing parameters do not fabricate threshold or Heat');
assert.equal(sparseEvents.length, 0, 'missing parameters do not fabricate a mini activation');

const zero = item('resistor', {
  placementKey: 'zero-resistor',
  params: { heatt: 0, p1: 0, heat: 0, p2: 0 },
});
const zeroPlayer = createActor('player');
const zeroEvents = [];
handler.onChargeReceived(zero, { ...ctx, player: zeroPlayer, events: zeroEvents });
assert.equal(getStackAmount(zeroPlayer, 'heat'), 0, 'zero parameters remain zero-safe');
assert.equal(zeroEvents.length, 0, 'zero threshold does not trigger below itself');

console.log('OK Resistor source and handler regression');
