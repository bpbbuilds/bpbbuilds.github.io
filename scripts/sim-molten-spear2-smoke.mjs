import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { dealHit } from '../js/pages/sim/engine/scripts/handlers.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { itemTypeMultiplicity } from '../js/pages/sim/engine/scripts/ports-util.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/MoltenSpear2.gd', 'utf8');
const port = fs.readFileSync('js/pages/sim/engine/scripts/ports-ap-onhit.js', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = rawCatalog.items || rawCatalog;
const sourceItem = catalog.find((item) => item.id === 'molten_spear2');
const fireItem = catalog.find((item) => item.id === 'molten_greatsword');
const rules = JSON.parse(fs.readFileSync('assets/data/can-affect-rules.json', 'utf8'));
const moltenPort = port.slice(port.indexOf("handlerId: 'molten_spear2'"));

assert.ok(sourceItem, 'Molten Spear2: extracted catalog row');
assert.ok(fireItem, 'Molten Spear2: Fire target fixture');
assert.match(source, /onready var missDamage: = int\(getP\("missdam"\)\)/);
assert.match(source, /onready var blind: = int\(getP\("blind"\)\)/);
assert.match(source, /onready var selfblind: = int\(getP\("blind_self"\)\)/);
assert.match(source, /onready var fireMultiplicity: = int\(getP\("fire"\)\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*getNumAffected_type\(Type\.Fire\)[\s\S]*getNumEmptyAffectedCells\(\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*addBonusDamage\(missDamage\)[\s\S]*damageRes\.hit = true[\s\S]*inflictBlind\(blind\)[\s\S]*selfInflictBlind\(selfblind\)/);
assert.match(source, /func onPreDealDamage_late\(damageRes: DamageResult\):[\s\S]*removeBlock\(totalBlockRemoval\)/);
assert.match(moltenPort, /handlerId: 'molten_spear2'/);
assert.match(moltenPort, /itemTypeMultiplicity\(ctx\.itemsById\.get\(o\.itemId\), 'fire'\)/);
assert.match(moltenPort, /onPreDealDamageEarly\(piece, ctx, res\)/);
assert.match(moltenPort, /addBonusDamage\(piece, dam\)/);
assert.doesNotMatch(moltenPort, /Math\.max\(1, Math\.round\(getPName\(piece\.params, 'heatt'/);

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
    itemId: 'molten_spear2',
    placementKey: 'spear2',
    name: 'Molten Spear2',
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
      ['molten_spear2', sourceItem],
      ['molten_greatsword', { ...fireItem, params: { ...targetParams } }],
    ]),
    graph: {
      pieces: new Map([
        ['spear2', {
          key: 'spear2',
          id: 'molten_spear2',
          cells: ['0,0'],
          affectCells: [
            { cell: '1,0', color: 'primary' },
            { cell: '2,0', color: 'primary' },
          ],
        }],
        ['fire', { key: 'fire', id: 'molten_greatsword', cells: ['1,0'], affectCells: [] }],
      ]),
      filled: new Map([
        ['0,0', 'spear2'],
        ['1,0', 'fire'],
      ]),
    },
    canAffect: { rulesById: rules.byId },
  };
  const handler = getScriptHandler('molten_spear2');
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

const handler = getScriptHandler('molten_spear2');
assert.equal(handler?.handlerId, 'molten_spear2');

const converted = makeContext();
const convertedResult = runStrike(converted, 2);
assert.equal(converted.piece._blockStrip, 55,
  'Molten Spear2: prepare counts Fire multiplicity 10 plus one empty affect cell');
assert.equal(convertedResult.hit, true,
  'Molten Spear2: enough Heat converts the same missed DamageResult into a hit');
assert.equal(convertedResult.damage, 13, 'Molten Spear2: miss damage is added to the converted strike');
assert.equal(converted.piece.bonusDamage, 3,
  'Molten Spear2: miss conversion permanently adds the source bonus damage');
assert.equal(converted.ctx.player.stacks.heat, 0, 'Molten Spear2: exact Heat cost is spent');
assert.equal(converted.ctx.dummy.stacks.blind, 1, 'Molten Spear2: converted hit blinds the opponent');
assert.equal(converted.ctx.player.stacks.blind, 1, 'Molten Spear2: converted hit self-blinds');
assert.equal(converted.ctx.dummy.block, 0, 'Molten Spear2: late hook strips block before damage is blocked');
assert.equal(converted.ctx.dummy.hp, 1187, 'Molten Spear2: converted damage reaches HP after block strip');
assert.equal(converted.ctx.events.filter((event) => event.type === 'miss').length, 0,
  'Molten Spear2: same-strike conversion does not leave a miss event');

const ordinaryHit = makeContext({ accuracy: 100 });
const hitResult = runStrike(ordinaryHit);
assert.equal(hitResult.hit, true, 'Molten Spear2: an ordinary hit remains a hit');
assert.equal(hitResult.damage, 10, 'Molten Spear2: ordinary hits do not receive miss damage');
assert.equal(ordinaryHit.ctx.dummy.stacks.blind, 1,
  'Molten Spear2: ordinary hits inflict Blind');
assert.equal(ordinaryHit.ctx.player.stacks.blind, 1,
  'Molten Spear2: ordinary hits inflict self-Blind');
assert.equal(ordinaryHit.piece.bonusDamage || 0, 0,
  'Molten Spear2: ordinary hits do not add the miss-conversion bonus');

const zeroTarget = { ...fireItem.params, fire: 0, p6: 0 };
const zero = makeContext({
  params: {
    heatt: 0,
    p1: 0,
    missdam: 0,
    p2: 0,
    blind: 0,
    p3: 0,
    blind_self: 0,
    p4: 0,
    blockremoval: 0,
    p5: 0,
    fire: 0,
    p6: 0,
  },
  targetParams: zeroTarget,
});
const zeroResult = runStrike(zero);
assert.equal(itemTypeMultiplicity({ ...sourceItem, params: { ...sourceItem.params, fire: 0 } }, 'fire'), 0,
  'Molten Spear2: explicit zero Fire multiplicity is preserved');
assert.equal(zero.piece._blockStrip, 0, 'Molten Spear2: explicit zero block-removal value is preserved');
assert.equal(zeroResult.hit, true, 'Molten Spear2: explicit zero Heat requirement is honored');
assert.equal(zeroResult.damage, 10, 'Molten Spear2: explicit zero miss damage adds nothing');
assert.equal(zero.piece.bonusDamage || 0, 0, 'Molten Spear2: zero miss damage adds no permanent bonus');
assert.equal(zero.ctx.dummy.stacks.blind || 0, 0, 'Molten Spear2: explicit zero Blind is preserved');
assert.equal(zero.ctx.player.stacks.blind || 0, 0, 'Molten Spear2: explicit zero self-Blind is preserved');
assert.equal(zero.ctx.dummy.block, 10, 'Molten Spear2: zero strip leaves ordinary block mitigation intact');

console.log('Molten Spear2 source/parity smoke passed.');
