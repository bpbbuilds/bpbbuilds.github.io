import assert from 'node:assert/strict';
import fs from 'node:fs';

import { processChargeJob } from '../js/pages/sim/engine/charge-delivery.js';
import { buildBatteryChargePath } from '../js/pages/sim/engine/charge-path.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const batteryItem = catalog.find((item) => item.id === 'battery');
assert.ok(batteryItem, 'Battery catalog item is available for the source-shaped path');

const handler = getScriptHandler('battery');
assert.equal(typeof handler?.onCombatStart, 'function', 'Battery emits its source charge on combat start');
assert.equal(typeof handler?.emitCharge, 'function', 'Battery exposes its source re-emission path');

for (const side of ['you', 'them']) {
  const piece = {
    itemId: 'battery',
    placementKey: `${side}:battery`,
    side,
    name: 'Battery',
    params: { dur: 2, speed: 10, speed2: 5 },
    alive: true,
  };
  const target = {
    itemId: 'wooden_sword',
    placementKey: `${side}:target`,
    side,
    name: 'Wooden Sword',
    speedScale: 0,
    alive: true,
  };
  const placement = { x: 4, y: 5, r: 0 };
  const path = buildBatteryChargePath({
    pathId: `${side}:fixture`,
    item: batteryItem,
    placement,
    startT: 0,
    durPerTile: 2,
  });
  assert.ok(path?.cells?.[1]?.cell, `Battery has a first lightning cell on ${side}`);
  const graph = {
    pieces: new Map([
      [piece.placementKey, { key: piece.placementKey, id: piece.itemId, x: placement.x, y: placement.y, r: placement.r, cells: ['4,5'], affectCells: [] }],
      [target.placementKey, { key: target.placementKey, id: target.itemId, x: 4, y: 4, r: 0, cells: [path.cells[1].cell], affectCells: [] }],
    ]),
    filled: new Map([[path.cells[1].cell, target.placementKey]]),
  };
  const owner = createActor(side === 'you' ? 'player' : 'dummy');
  const opponent = createActor(side === 'you' ? 'dummy' : 'player');
  const events = [];
  const ctx = {
    t: 0,
    player: owner,
    dummy: opponent,
    events,
    graph,
    pieces: [piece, target],
    itemsById: new Map([
      ['battery', batteryItem],
      ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon' }],
    ]),
    chargeJobs: [],
  };

  handler.onCombatStart(piece, ctx);
  const actor = side === 'you' ? 'player' : 'dummy';
  assert.ok(events.some((event) => event.type === 'activate' && event.actor === actor && event.meta?.handler === 'battery'), `Battery activation is attributed to its owner on ${side}`);
  assert.ok(events.filter((event) => event.type === 'charge').length >= 2, `Battery emits a complete charge path on ${side}`);
  assert.ok(ctx.chargeJobs.length > 0, `Battery schedules stat changes along its charge path on ${side}`);

  let sawChargedSpeed = false;
  for (const job of ctx.chargeJobs) {
    processChargeJob(job, { pieces: [piece, target] }, (activePiece) => ({
      ...ctx,
      t: job.at,
      pieces: [piece, target],
      player: owner,
      dummy: opponent,
      events,
      activePiece,
    }));
    sawChargedSpeed ||= target.speedScale > 0;
  }
  assert.equal(target.speedScale, 0, `Battery removes its temporary charged-item speed after the path leaves on ${side}`);
  assert.equal(sawChargedSpeed, true, `Battery applies its flat/per-tile speed bonus while charging an item on ${side}`);
}

console.log('OK Battery focused smoke');
