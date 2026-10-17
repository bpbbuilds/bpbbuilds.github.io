import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { dealHit } from '../js/pages/sim/engine/scripts/handlers.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MoltenSpear.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-wave-c-spear.js', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = rawCatalog.items || rawCatalog;
const sourceItem = catalog.find((item) => item.id === 'molten_spear');
const fireItem = catalog.find((item) => item.id === 'molten_greatsword');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));

assert.ok(sourceItem, 'Molten Spear: extracted catalog row');
assert.ok(fireItem, 'Molten Spear: Fire target fixture');
assert.match(source, /onready var missDamage: = int\(getP\("missdam"\)\)/);
assert.match(source, /onready var heatNeeded: = int\(getP\("heatt"\)\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getNumAffected_type\(Type\.Fire\)[\s\S]*getNumEmptyAffectedCells\(\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*damageRes\.damage \+= missDamage[\s\S]*damageRes\.hit = true/);
assert.match(source, /func onPreDealDamage_late\(damageRes: DamageResult\):[\s\S]*removeBlock\(totalBlockRemoval\)/);
assert.match(port, /handlerId: 'molten_spear'/);
assert.match(port, /onPrepare\(piece, ctx\)/);
assert.match(port, /onPreDealDamageEarly\(piece, ctx, res\)/);
assert.match(port, /onPreDealDamageLate\(piece, ctx\)/);
assert.doesNotMatch(port, /dealHit\(piece, ctx, \(hit\.raw/);

function makeContext({
  params = sourceItem.params,
  targetParams = fireItem.params,
  accuracy = 0,
  block = 20,
} = {}) {
  const player = createActor('player');
  const dummy = createActor('dummy', { block });
  const bus = createCombatBus();
  const events = [];
  player._eventLog = events;
  dummy._eventLog = events;
  player._combatBus = bus;
  dummy._combatBus = bus;
  const piece = {
    itemId: 'molten_spear',
    placementKey: 'spear',
    name: 'Molten Spear',
    params: { ...params },
    side: 'you',
    kind: 'weapon',
    alive: true,
    accuracy,
    damageMin: 10,
    damageMax: 10,
    staminaCost: 0,
    cooldown: 1,
    baseCooldown: 1,
    damageKind: 'melee',
    vampiric: false,
  };
  const target = {
    itemId: 'molten_greatsword',
    placementKey: 'fire',
    name: 'Molten Greatsword',
    side: 'you',
    kind: 'weapon',
    alive: true,
  };
  const ctx = {
    t: 1,
    player,
    dummy,
    bus,
    events,
    rng: () => 0,
    pieces: [piece, target],
    itemsById: new Map([
      ['molten_spear', sourceItem],
      ['molten_greatsword', { ...fireItem, params: { ...targetParams } }],
    ]),
    graph: {
      pieces: new Map([
        ['spear', {
          key: 'spear',
          id: 'molten_spear',
          cells: ['0,0'],
          affectCells: [
            { cell: '1,0', color: 'primary' },
            { cell: '2,0', color: 'primary' },
          ],
        }],
        ['fire', { key: 'fire', id: 'molten_greatsword', cells: ['1,0'], affectCells: [] }],
      ]),
      filled: new Map([
        ['0,0', 'spear'],
        ['1,0', 'fire'],
      ]),
    },
    canAffect: { rulesById: rules.byId },
  };
  const handler = getScriptHandler('molten_spear');
  ctx.notifyPreDealDamageEarly = (currentPiece, currentCtx, res) =>
    handler?.onPreDealDamageEarly?.(currentPiece, currentCtx, res);
  ctx.notifyPreDealDamageLate = (currentPiece, currentCtx, res) =>
    handler?.onPreDealDamageLate?.(currentPiece, currentCtx, res);
  return { ctx, piece, handler };
}

function runStrike(fixture, heat = 0) {
  const { ctx, piece, handler } = fixture;
  handler.onPrepare(piece, ctx);
  bindBuffCombatLog({ events: ctx.events, getT: () => ctx.t, dummy: ctx.dummy });
  if (heat) grantStacks(ctx.player, 'heat', heat, { originId: 'fixture' });
  const result = dealHit(piece, ctx, () => 10);
  unbindBuffCombatLog();
  return result;
}

const handler = getScriptHandler('molten_spear');
assert.equal(handler?.handlerId, 'molten_spear');

const converted = makeContext();
const convertedResult = runStrike(converted, 1);
assert.equal(converted.piece._blockStrip, 55,
  'Molten Spear: prepare counts Fire multiplicity 10 plus one empty affect cell');
assert.equal(convertedResult.hit, true,
  'Molten Spear: enough Heat converts the same missed DamageResult into a hit');
assert.equal(convertedResult.raw, 10, 'Molten Spear: conversion preserves the original rolled damage');
assert.equal(convertedResult.damage, 15, 'Molten Spear: miss damage is added to the same strike');
assert.equal(converted.ctx.player.stacks.heat, 0, 'Molten Spear: exact Heat cost is spent');
assert.equal(converted.ctx.dummy.block, 0, 'Molten Spear: late hook strips block before damage is blocked');
assert.equal(converted.ctx.dummy.hp, 1185, 'Molten Spear: converted damage reaches HP after block strip');
assert.equal(converted.ctx.events.filter((event) => event.type === 'miss').length, 0,
  'Molten Spear: same-strike conversion does not leave a miss event');
assert.equal(converted.ctx.events.filter((event) =>
  event.type === 'damage' && !event.meta?.kind).length, 1,
  'Molten Spear: conversion produces one ordinary damage event');

const ordinaryMiss = makeContext();
const missResult = runStrike(ordinaryMiss);
assert.equal(missResult.hit, false, 'Molten Spear: insufficient Heat leaves the attack missed');
assert.equal(ordinaryMiss.ctx.player.stacks.heat, 0, 'Molten Spear: insufficient Heat is not spent');
assert.equal(ordinaryMiss.ctx.dummy.block, 20,
  'Molten Spear: late block removal does not run after an unconverted miss');
assert.equal(ordinaryMiss.ctx.events.filter((event) => event.type === 'miss').length, 1,
  'Molten Spear: an unconverted strike remains one miss');

const zero = makeContext({
  params: { heatt: 0, p1: 0, missdam: 0, p2: 0, blockremoval: 0, p3: 0 },
  targetParams: { ...fireItem.params, fire: 0, p6: 0 },
});
const zeroResult = runStrike(zero);
assert.equal(zero.piece._blockStrip, 0, 'Molten Spear: explicit zero block-removal value is preserved');
assert.equal(zeroResult.hit, true, 'Molten Spear: explicit zero Heat requirement is honored');
assert.equal(zeroResult.damage, 10, 'Molten Spear: explicit zero miss damage adds nothing');
assert.equal(zero.ctx.dummy.block, 10, 'Molten Spear: zero strip leaves ordinary block mitigation intact');
assert.equal(zero.ctx.player.stacks.heat || 0, 0, 'Molten Spear: zero Heat spend remains zero');

console.log('Molten Spear source/parity smoke passed.');
