import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/DoubleAxe.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.equal(inventory.byId.double_axe?.file, 'Exclusive/DoubleAxe.gd');
assert.equal(getScriptHandler('double_axe')?.handlerId, 'double_axe');
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*if damageRes\.hasHit\(\):[\s\S]*addBonusDamage\(getP1\(\)\)/);
assert.match(source, /func onPrepare\(\):[\s\S]*enteredRage = false[\s\S]*battle_rage_started/);
assert.match(source, /func onBattleRageStarted\(event\):[\s\S]*doCooldownEffect\(\)[\s\S]*enteredRage = true/);

function piece(overrides = {}) {
  const item = byId.get('double_axe');
  return {
    ...item,
    itemId: 'double_axe',
    placementKey: 'you:axe',
    name: item.name,
    params: { ...(item.params || {}) },
    side: 'you',
    alive: true,
    cooldown: item.cooldown,
    baseCooldown: item.cooldown,
    triggerTime: item.cooldown,
    damageMin: 10,
    damageMax: 10,
    kind: 'weapon',
    ...overrides,
  };
}

function context(owner, dummy, axe, bus = createCombatBus()) {
  const events = [];
  owner._combatBus = bus;
  dummy._combatBus = bus;
  owner._eventLog = events;
  dummy._eventLog = events;
  owner.stamina = 20;
  owner.maxStamina = 20;
  return {
    player: owner,
    dummy,
    pieces: [axe],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: null,
    events,
    bus,
    rng: () => 0,
    t: 5,
    activatePiece: () => true,
    notifyPreDealDamageEarly: (pieceToNotify, notifyCtx, result) => {
      getScriptHandler(pieceToNotify.itemId)?.onPreDealDamageEarly?.(
        pieceToNotify,
        notifyCtx,
        result,
      );
    },
  };
}

{
  const owner = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const axe = piece();
  const bus = createCombatBus();
  const ctx = context(owner, dummy, axe, bus);
  getScriptHandler('double_axe').onPrepare(axe, ctx);

  bus.emit('battle_rage_started', { actor: dummy, t: 5 });
  assert.equal(axe._axeRaged, false, 'opponent rage does not trigger the axe');
  assert.equal(axe.bonusDamage || 0, 0, 'opponent rage does not add damage');

  const normal = { hit: true, damage: 10 };
  getScriptHandler('double_axe').onPreDealDamageEarly(axe, ctx, normal);
  assert.equal(normal.damage, 12, 'normal hit includes source P1 bonus');
  assert.equal(axe.bonusDamage, 2, 'normal hit stores source P1 bonus');

  const miss = { hit: false, damage: 10 };
  getScriptHandler('double_axe').onPreDealDamageEarly(axe, ctx, miss);
  assert.equal(miss.damage, 10, 'miss receives no bonus');
  assert.equal(axe.bonusDamage, 2, 'miss stores no bonus');

  bus.emit('battle_rage_started', { actor: owner, t: 6 });
  assert.equal(axe._axeRaged, true, 'owner rage starts the source transition');
  assert.equal(axe.bonusDamage, 4, 'rage-start extra attack uses pre-rage P1 bonus');
  const rageHit = { hit: true, damage: 10 };
  getScriptHandler('double_axe').onPreDealDamageEarly(axe, ctx, rageHit);
  assert.equal(rageHit.damage, 13, 'rage hit includes source P2 bonus');
  assert.equal(axe.bonusDamage, 7, 'rage hit stores source P2 bonus');
  assert.ok(ctx.events.some((event) => event.type === 'activate'), 'rage-start attack activates');
}

{
  const owner = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  const axe = piece({ params: { p1: 0, p2: 0 } });
  const ctx = context(owner, dummy, axe);
  getScriptHandler('double_axe').onPrepare(axe, ctx);
  const zero = { hit: true, damage: 10 };
  getScriptHandler('double_axe').onPreDealDamageEarly(axe, ctx, zero);
  assert.equal(zero.damage, 10, 'zero source P1 remains zero');
  assert.equal(axe.bonusDamage || 0, 0, 'zero source P1 adds no bonus');
  ctx.bus.emit('battle_rage_started', { actor: owner, t: 5 });
  assert.equal(axe.bonusDamage || 0, 0, 'zero source P2 adds no bonus');
}

console.log('OK Double Axe source port');
