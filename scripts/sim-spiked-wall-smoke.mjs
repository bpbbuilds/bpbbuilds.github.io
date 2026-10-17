import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { startBattleRage } from '../js/pages/sim/engine/battle-rage.js';
import { takeDamage } from '../js/pages/sim/engine/damage.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/SpikedWall.gd', 'utf8');
const shieldSource = fs.readFileSync('tools/game-extract-full/Items/SpikedShield.gd', 'utf8');
const characterSource = fs.readFileSync('tools/game-extract-full/Core/Character.gd', 'utf8');
const handlerSource = fs.readFileSync('js/pages/sim/engine/scripts/ports-ao-shields.js', 'utf8');
const portBlock = handlerSource.slice(
  handlerSource.indexOf('const spikedWallPort'),
  handlerSource.indexOf('const sunShieldPort'),
);
const sourceItem = catalog.find((item) => item.id === 'spiked_wall');

assert.ok(sourceItem, 'Spiked Wall: extracted catalog row');
assert.equal(inventory.byId.spiked_wall?.file, 'Exclusive/SpikedWall.gd');
assert.deepEqual(inventory.byId.spiked_wall?.overrides, ['onPrepare']);
assert.equal(sourceItem.cost, 14, 'Spiked Wall: catalog cost');
assert.equal(sourceItem.chance, 30, 'Spiked Wall: catalog chance');
assert.deepEqual(sourceItem.params, {
  damblock: 15,
  p1: 15,
  stamina: 0.3,
  p2: 0.3,
  spikes: 3,
  p3: 3,
  maxspikes: 12,
  p4: 12,
  staminaregen: 30,
  p5: 30,
  dur_rage: 2,
  p6: 2,
  spikedam: 30,
  p7: 30,
});
assert.match(source, /extends "res:\/\/Items\/SpikedShield\.gd"/);
assert.match(source, /func canBlockDamageRes\(damageRes: DamageResult\).*:[\s\S]*return damageRes\.triggerOnAttacked\(\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*\.onPrepare\(\)[\s\S]*addBattleRageDuration\(getP_m\("dur_rage"\)\)[\s\S]*changeRangedSpikesLimit\(spikesLimit\)[\s\S]*changeMeleeSpikesLimit\(spikesLimit\)[\s\S]*baseStaminaRegen[\s\S]*giveStaminaRegeneration\(staminaRegenMalus \* baseStaminaRegen\)/);
assert.match(shieldSource, /func beforeBlock\(\):[\s\S]*giveSpikes\(spikesToGive\)/);
assert.match(portBlock, /onPrepare\(piece, ctx\)/);
assert.match(portBlock, /canBlockDamageRes/);
assert.match(portBlock, /battleRageBonusDur/);
assert.match(portBlock, /baseStaminaRegen/);
assert.doesNotMatch(portBlock, /staminaRegen = Math\.max\(0, \(Number\(ctx\.player\.staminaRegen\)/);

function makeContext({ params = sourceItem.params } = {}) {
  const player = createActor('player', { maxHp: 200, staminaRegen: 1.5 });
  player.baseStaminaRegen = 1;
  const dummy = createActor('dummy', { maxHp: 200 });
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  const events = [];
  player._eventLog = events;
  dummy._eventLog = events;
  const piece = {
    ...sourceItem,
    itemId: 'spiked_wall',
    placementKey: 'wall',
    name: 'Spiked Wall',
    params: { ...params },
    kind: 'shield',
    side: 'you',
    alive: true,
    chance: sourceItem.chance,
  };
  return {
    t: 2,
    player,
    dummy,
    bus,
    events,
    rng: () => 0,
    pieces: [piece],
    itemsById: new Map([['spiked_wall', sourceItem]]),
    graph: null,
    piece,
  };
}

function incomingRangedHit(ctx, nowT = 4) {
  ctx.player._simT = nowT;
  return takeDamage(ctx.player, ctx.dummy, {
    amount: 10,
    originPiece: { itemId: 'dummy_bow', placementKey: 'dummy_bow' },
    accuracy: 100,
    canMiss: false,
    canCrit: false,
    isAttack: true,
    isMelee: false,
    skipSpikes: true,
    nowT,
    events: ctx.events,
    bus: ctx.bus,
    rng: ctx.rng,
  });
}

const handler = getScriptHandler('spiked_wall');
assert.equal(handler?.handlerId, 'spiked_wall');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onCombatStart, 'function');

const combat = makeContext();
combat.piece.paramAdd = { dur_rage: 1 };
combat.piece.paramMult = { dur_rage: 1.5 };
handler.onPrepare(combat.piece, combat);
assert.equal(combat.piece._spikesGiven, 0,
  'Spiked Wall: inherited Spiked Shield preparation resets the spike counter');
assert.equal(combat.player.battleRageBonusDur, 4.5,
  'Spiked Wall: prepare adds modified Battle Rage duration to the character bonus');
assert.equal(combat.player.meleeSpikesLimit, 1.3,
  'Spiked Wall: prepare adds the source melee Spikes damage limit');
assert.equal(combat.player.rangedSpikesLimit, 0.3,
  'Spiked Wall: prepare adds the source ranged Spikes damage limit');
assert.equal(combat.player.staminaRegen, 1.2,
  'Spiked Wall: stamina malus is based on base stamina regeneration');
handler.onCombatStart(combat.piece, combat);
incomingRangedHit(combat);
assert.equal(combat.player.hp, 200,
  'Spiked Wall: source triggerOnAttacked blocks a ranged hit');
assert.equal(combat.player.stacks.spikes, 3,
  'Spiked Wall: inherited shield hook grants source Spikes before damage');
assert.ok(Math.abs(combat.player.stamina - 4.7) < 1e-9,
  'Spiked Wall: inherited afterBlock drains source stamina');

startBattleRage(combat.player, 3, 2, { bus: combat.bus });
assert.equal(combat.player.battleRageUntil, 9.5,
  'Spiked Wall: Battle Rage consumes the prepared bonus duration');

const zero = makeContext({
  params: {
    damblock: 0,
    p1: 0,
    stamina: 0,
    p2: 0,
    spikes: 0,
    p3: 0,
    maxspikes: 0,
    p4: 0,
    staminaregen: 0,
    p5: 0,
    dur_rage: 0,
    p6: 0,
    spikedam: 0,
    p7: 0,
  },
});
handler.onPrepare(zero.piece, zero);
handler.onCombatStart(zero.piece, zero);
incomingRangedHit(zero);
assert.equal(zero.player.hp, 190,
  'Spiked Wall: explicit zero damblock remains zero');
assert.equal(zero.player.stacks.spikes, 0,
  'Spiked Wall: explicit zero Spikes remains zero');
assert.equal(zero.player.stamina, 5,
  'Spiked Wall: explicit zero stamina drain remains zero');
assert.equal(zero.player.staminaRegen, 1.5,
  'Spiked Wall: explicit zero stamina malus is inert');

console.log('Spiked Wall source/parity smoke passed.');
