import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Generator.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect_lightning\(item\):[\s\S]*return item\.hasCooldown\(\) or item\.reactsToCharges\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*emitCharge\(\)[\s\S]*EventBus\.emitSignal\(self, "charge_emitted"/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*if useStamina\(\) == Character\.StaminaResult\.Sufficient:[\s\S]*emitCharge\(\)[\s\S]*EventBus\.emitSignal\(self, "charge_emitted"/);
assert.match(source, /func emitCharge\(speedFactor = 1\.0\):[\s\S]*var event = activate\(\)[\s\S]*sendCharge\(getP_m\("dur"\), chargeCells, speedFactor, event\)/);
assert.match(source, /func onChargeEnteredCell\(charge, cellIndex\):[\s\S]*changeChargedItemStat\(charge, cellIndex, flatSpeed, speedPerTile\)/);
assert.equal(inventory.byId.generator?.file, 'Exclusive/Generator.gd');
assert.equal(getScriptHandler('generator')?.handlerId, 'generator');

function piece(id, key, side, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item?.name || id,
    params: item?.params || {},
    side,
    alive: true,
    kind: 'accessory',
    cooldown: item?.cooldown ?? 4.5,
    baseCooldown: item?.cooldown ?? 4.5,
    staminaCost: item?.staminaCost ?? 0,
    ...overrides,
  };
}

function context(owner, foe, generator) {
  const bus = createCombatBus();
  const signals = { count: 0 };
  bus.on('charge_emitted', () => { signals.count += 1; });
  owner._combatBus = bus;
  foe._combatBus = bus;
  const pieces = [generator];
  const placements = [{ id: generator.itemId, x: 5, y: 8, r: 0, key: generator.placementKey }];
  return {
    player: owner,
    dummy: foe,
    pieces,
    graph: buildBoardGraph(placements, byId),
    itemsById: byId,
    canAffect: { rulesById: null },
    events: [],
    chargeJobs: [],
    bus,
    signals,
    rng: () => 0,
    t: 5,
  };
}

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  const generator = piece('generator', `${side}:generator`, side);
  const ctx = context(owner, foe, generator);
  const handler = getScriptHandler('generator');

  handler.onCombatStart(generator, ctx);
  const startCharge = ctx.events.find((event) => event.type === 'charge');
  assert.ok(startCharge, `Generator emits a charge path at combat start on ${side}`);
  assert.equal(startCharge.actor, side === 'you' ? 'player' : 'dummy', `Generator charge belongs to its owner on ${side}`);
  assert.equal(startCharge.meta.chargePath.cells.length, 6, `Generator uses all six source charge cells on ${side}`);
  assert.equal(startCharge.meta.chargePath.duration, 10, `Generator uses source duration per tile on ${side}`);
  assert.equal(ctx.events.findIndex((event) => event.type === 'activate') < ctx.events.findIndex((event) => event.type === 'charge'), true, `Generator activates before sending its charge on ${side}`);
  assert.equal(ctx.signals.count, 1, `Generator emits the source charge signal at combat start on ${side}`);

  ctx.events.length = 0;
  ctx.t = 20;
  owner.stamina = 1;
  handler.onCooldownEffect(generator, ctx);
  assert.ok(Math.abs(owner.stamina - 0.2) < 1e-9, `Generator spends its exact fractional stamina cost on ${side}`);
  assert.ok(ctx.events.some((event) => event.type === 'charge'), `Generator sends a charge after sufficient stamina on ${side}`);
  assert.equal(ctx.signals.count, 2, `Generator emits the source charge signal after a successful cooldown on ${side}`);

  ctx.events.length = 0;
  owner.stamina = 0.79;
  handler.onCooldownEffect(generator, ctx);
  assert.equal(owner.stamina, 0.79, `Generator does not partially spend stamina when the source gate fails on ${side}`);
  assert.equal(ctx.events.some((event) => event.type === 'charge'), false, `Generator does not charge while starved on ${side}`);
  assert.equal(ctx.events.at(-1)?.type, 'stamina', `Generator reports its starvation result on ${side}`);

  const zero = piece('generator', `${side}:generator-zero`, side, {
    params: { dur: 0, p1: 0, speed: 0, p2: 0, speed2: 0, p3: 0 },
  });
  const zeroCtx = context(owner, foe, zero);
  handler.onCombatStart(zero, zeroCtx);
  const zeroCharge = zeroCtx.events.find((event) => event.type === 'charge');
  assert.equal(zeroCharge?.meta.chargePath.duration, 0, `Generator honors explicit zero duration and speed parameters on ${side}`);
}

console.log('OK Generator source-backed six-cell charge, exact stamina gate, owner-side events, and zero parameters');
