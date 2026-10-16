import assert from 'node:assert/strict';
import fs from 'node:fs';

import canAffectRules from '../assets/data/can-affect-rules.json' with { type: 'json' };
import gameItems from './_cache/game-items.json' with { type: 'json' };
import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { buildBoardGraph } from '../js/pages/sim/engine/board-graph.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { deliverCharge } from '../js/pages/sim/engine/charge-delivery.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { tickTimedSpeeds } from '../js/pages/sim/engine/timed-speed.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/ThunderDrake.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-d-weapons.js', 'utf8');
const boardSource = fs.readFileSync('js/pages/sim/engine/board-graph.js', 'utf8');
const port = handlerSource.slice(
  handlerSource.indexOf('export const thunderDrakePort'),
  handlerSource.indexOf('/** @type {Record<string, ScriptHandler>} */', handlerSource.indexOf('export const thunderDrakePort')),
);

assert.equal(inventory.byId.thunder_drake?.file, 'Exclusive/ThunderDrake.gd');
assert.deepEqual(inventory.byId.thunder_drake?.overrides, ['onDealtDamage', 'onPrepare']);
assert.match(source, /func canAffect_lightning\(item\):[\s\S]*return item\.hasCooldown\(\) or item\.reactsToCharges\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*setState\(false\)[\s\S]*curHitCount = 0[\s\S]*countItemsInAffectedCells_cached\(Affected\.Lightning\)/);
assert.match(source, /func onDealtDamage\(damageRes: DamageResult\):[\s\S]*if damageRes\.hasHit\(\):[\s\S]*curHitCount \+= 1[\s\S]*if curHitCount == numHits/);
assert.match(source, /if active:[\s\S]*item\.chargeLeft\(self\)[\s\S]*zapItem\(item\)[\s\S]*else:[\s\S]*setState\(true\)[\s\S]*item\.addSpeed\(buffSpeed \* lightningMultiplicity\[item\]\)[\s\S]*zapItem\(item\)/);
assert.match(source, /buffTimer\.start\(getP_m\("dur"\)\)/);
assert.match(source, /func onBuffEnded\(\):[\s\S]*item\.reduceSpeed\(buffSpeed \* lightningMultiplicity\[item\]\)[\s\S]*item\.chargeLeft\(self\)/);
assert.match(port, /onPrepare\(piece, ctx\)/);
assert.match(port, /piece\._drakeTargets = drakeTargets\(piece, ctx\)/);
assert.match(port, /piece\._drakeHits !== every/);
assert.match(port, /leaveCharge\(target, ctx/);
assert.match(port, /deliverCharge\(target, ctx/);
assert.match(port, /modifiedParamValue\([\s\S]*'dur'/);
assert.match(port, /scaleDrakeDuration\(piece, durBase\)/);
assert.match(port, /onTick\(piece, ctx\)/);
assert.match(boardSource, /up\.lightnings \|\| \[\]/);
assert.doesNotMatch(port, /Math\.max\(0\.5, getPName\(piece\.params, 'dur'/);
assert.doesNotMatch(port, /onCombatStart\(piece\)/);

const catalog = new Map(gameItems.items.map((item) => [item.id, item]));
const drakeCatalog = catalog.get('thunder_drake');
assert.ok(drakeCatalog, 'Thunder Drake is present in the extracted catalog');

function makeContext({ params = drakeCatalog.params, paramMult = { dur: 1.5 } } = {}) {
  const cooldownItem = {
    id: 'drake_cooldown_target',
    type: 'Weapon',
    cooldown: 2,
    shape: [[1]],
  };
  const reactiveCatalog = {
    ...catalog.get('robodog'),
    cooldown: 0,
    shape: [[1]],
  };
  const plainItem = {
    id: 'drake_plain_target',
    type: 'Armor',
    cooldown: 0,
    shape: [[1]],
  };
  const itemsById = new Map([
    ['thunder_drake', drakeCatalog],
    [cooldownItem.id, cooldownItem],
    [reactiveCatalog.id, reactiveCatalog],
    [plainItem.id, plainItem],
  ]);
  const placements = [
    { id: 'thunder_drake', key: 'drake', x: 0, y: 0, r: 0 },
    { id: cooldownItem.id, key: 'cooldown', x: 6, y: -2, r: 0 },
    { id: reactiveCatalog.id, key: 'reactive', x: 5, y: -1, r: 0 },
    { id: plainItem.id, key: 'plain', x: 4, y: 0, r: 0 },
  ];
  const graph = buildBoardGraph(placements, itemsById);
  const bus = createCombatBus();
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const events = [];
  const drake = {
    itemId: 'thunder_drake',
    name: 'Thunder Drake',
    placementKey: 'drake',
    side: 'you',
    kind: 'weapon',
    params,
    paramMult,
    effectDurationFactor: 1,
    alive: true,
    cooldown: 2.1,
    baseCooldown: 2.1,
    speedScale: 0,
    numCharges: 0,
  };
  const cooldownTarget = {
    itemId: cooldownItem.id,
    name: 'Cooldown Target',
    placementKey: 'cooldown',
    side: 'you',
    kind: 'weapon',
    alive: true,
    cooldown: 2,
    baseCooldown: 2,
    speedScale: 0,
    numCharges: 0,
  };
  const reactiveTarget = {
    itemId: reactiveCatalog.id,
    name: 'Reactive Target',
    placementKey: 'reactive',
    side: 'you',
    kind: 'pet',
    alive: true,
    cooldown: 0,
    baseCooldown: 0,
    speedScale: 0,
    numCharges: 0,
  };
  const plainTarget = {
    itemId: plainItem.id,
    name: 'Plain Target',
    placementKey: 'plain',
    side: 'you',
    kind: 'passive',
    alive: true,
    cooldown: 0,
    baseCooldown: 0,
    speedScale: 0,
    numCharges: 0,
  };
  for (const actor of [player, dummy]) {
    actor._combatBus = bus;
    actor._eventLog = events;
  }
  const ctx = {
    t: 1,
    player,
    dummy,
    bus,
    events,
    rng: () => 0,
    graph,
    itemsById,
    canAffect: {
      rulesById: canAffectRules.byId,
      reactsToChargesIds: new Set(canAffectRules.reactsToChargesIds),
    },
    pieces: [drake, cooldownTarget, reactiveTarget, plainTarget],
  };
  return { ctx, drake, cooldownTarget, reactiveTarget, plainTarget };
}

const runtime = getScriptHandler('thunder_drake');
assert.equal(runtime?.handlerId, 'thunder_drake');
assert.equal(typeof runtime?.onPrepare, 'function');
assert.equal(typeof runtime?.onDealtDamage, 'function');
assert.equal(typeof runtime?.onTick, 'function');

{
  const { ctx, drake, cooldownTarget, reactiveTarget, plainTarget } = makeContext();
  runtime.onPrepare(drake, ctx);
  assert.equal(drake._drakeHits, 0, 'prepare resets hit count');
  assert.deepEqual(
    drake._drakeTargets.map(({ target }) => target.placementKey),
    ['cooldown', 'reactive'],
    'Lightning only targets cooldown or charge-reactive items',
  );
  assert.deepEqual(
    drake._drakeTargets.map(({ multiplicity }) => multiplicity),
    [1, 1],
    'Lightning multiplicity is counted per affected cell and target',
  );

  runtime.onDealtDamage(drake, ctx, { hit: false });
  runtime.onDealtDamage(drake, ctx, { hit: true });
  runtime.onDealtDamage(drake, ctx, { hit: true });
  assert.equal(drake._drakeBuffOn, false, 'fewer than hits successful hits do not activate');
  runtime.onDealtDamage(drake, ctx, { hit: true });
  assert.equal(drake._drakeBuffOn, true, 'the exact hit threshold activates');
  assert.equal(drake._drakeHits, 0, 'activation resets the hit counter');
  assert.equal(cooldownTarget.numCharges, 1, 'cooldown target receives one charge');
  assert.equal(reactiveTarget.numCharges, 1, 'charge-reactive target receives one charge');
  assert.equal(plainTarget.numCharges, 0, 'non-Lightning target remains untouched');
  assert.equal(cooldownTarget.speedScale, 0.2, 'cooldown target gets source speed once');
  assert.equal(reactiveTarget.speedScale, 0.2, 'reactive target gets source speed once');
  assert.equal(drake._drakeBuffUntil, 4, 'duration uses the placement modifier');

  ctx.t = 2;
  runtime.onDealtDamage(drake, ctx, { hit: true });
  runtime.onDealtDamage(drake, ctx, { hit: true });
  runtime.onDealtDamage(drake, ctx, { hit: true });
  assert.equal(cooldownTarget.numCharges, 1, 'active refresh leaves then re-delivers exactly one charge');
  assert.equal(reactiveTarget.numCharges, 1, 'active refresh leaves then re-delivers exactly one charge');
  assert.equal(cooldownTarget.speedScale, 0.2, 'active refresh does not stack speed');
  assert.equal(drake._drakeBuffUntil, 5, 'active refresh restarts the timer from the new hit');

  ctx.t = 5;
  tickTimedSpeeds(ctx.pieces, ctx.t);
  runtime.onTick(drake, ctx);
  assert.equal(drake._drakeBuffOn, false, 'timer expiry ends the buff');
  assert.equal(cooldownTarget.numCharges, 0, 'timer expiry removes the Drake charge');
  assert.equal(reactiveTarget.numCharges, 0, 'timer expiry removes the Drake charge');
  assert.equal(cooldownTarget.speedScale, 0, 'timer expiry removes the timed speed');
  assert.equal(reactiveTarget.speedScale, 0, 'timer expiry removes the timed speed');
}

{
  const { ctx, drake, cooldownTarget, reactiveTarget, plainTarget } = makeContext({
    params: { hits: 0, p1: 0, dur: 0, p2: 0, speed: 0, p3: 0 },
    paramMult: {},
  });
  runtime.onPrepare(drake, ctx);
  runtime.onDealtDamage(drake, ctx, { hit: true });
  assert.equal(drake._drakeBuffOn, false, 'zero hits do not create an accidental first-hit activation');
  assert.equal(cooldownTarget.speedScale, 0);
  assert.equal(reactiveTarget.speedScale, 0);
  assert.equal(plainTarget.numCharges, 0);
}

console.log(
  'OK Thunder Drake source Lightning filter, board marks, exact hit threshold, charge receive/left cycle, multiplicity, modified timer refresh/end, and zero-safe regression',
);
