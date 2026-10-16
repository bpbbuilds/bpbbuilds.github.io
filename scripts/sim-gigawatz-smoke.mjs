import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Gigawatz.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onPrepare\(\):[\s\S]*curDamageBonus = 0[\s\S]*numSpeedboosts = 0/);
assert.match(source, /func onChargeReceived\(_charge\):[\s\S]*if numSpeedboosts < maxNumSpeedBoosts:[\s\S]*addSpeed\(speedBonus\)[\s\S]*numSpeedboosts \+= 1/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*inflictBlind\(blind\)[\s\S]*var dam = descriptor\.minDam \+ curDamageBonus[\s\S]*dealEffectDamage\(dam\)[\s\S]*activate\(\)[\s\S]*curDamageBonus \+= damageBonus/);
assert.equal(inventory.byId.gigawatz?.file, 'Exclusive/Gigawatz.gd');
assert.equal(getScriptHandler('gigawatz')?.handlerId, 'gigawatz');

function piece(side, overrides = {}) {
  const item = byId.get('gigawatz');
  return {
    ...item,
    itemId: 'gigawatz',
    placementKey: `${side}:gigawatz`,
    name: item?.name || 'Gigawatz',
    params: item?.params || {},
    side,
    alive: true,
    kind: 'skill',
    damageMin: item?.damageMin ?? 10,
    damageMax: item?.damageMax ?? 10,
    ...overrides,
  };
}

function context(owner, foe, giga) {
  const bus = createCombatBus();
  owner._combatBus = bus;
  foe._combatBus = bus;
  return {
    player: owner,
    dummy: foe,
    pieces: [giga],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: { rulesById: null },
    events: [],
    bus,
    rng: () => 0,
    t: 5,
  };
}

const handler = getScriptHandler('gigawatz');

for (const side of ['you', 'them']) {
  const owner = createActor(side === 'you' ? 'player' : 'dummy', { maxHp: 100 });
  const foe = createActor(side === 'you' ? 'dummy' : 'player', { maxHp: 100 });
  const giga = piece(side, { _gigaActs: 99, _gigaChargeSpeed: 99 });
  const ctx = context(owner, foe, giga);

  handler.onPrepare(giga, ctx);
  assert.equal(giga._gigaNumSpeedBoosts, 0, `Gigawatz resets its source charge count during preparation on ${side}`);
  assert.equal(giga._gigaDamageBonus, 0, `Gigawatz resets its source damage bonus during preparation on ${side}`);

  for (let i = 0; i < 11; i += 1) handler.onChargeReceived(giga, ctx);
  assert.ok(Math.abs(giga.speedScale - 1.5) < 1e-9, `Gigawatz accepts exactly max source speed boosts on ${side}`);
  assert.equal(giga._gigaNumSpeedBoosts, 10, `Gigawatz caps charge count at source max on ${side}`);

  handler.onCooldownEffect(giga, ctx);
  assert.equal(foe.stacks.blind, 3, `Gigawatz inflicts source Blind on ${side}`);
  assert.equal(foe.hp, 90, `Gigawatz deals source effect damage without a normal attack path on ${side}`);
  assert.equal(ctx.events.some((event) => event.meta?.chargePulse), false, `Gigawatz does not invent a charge pulse on ${side}`);
  const firstDamage = ctx.events.find((event) => event.type === 'damage' && event.itemId === 'gigawatz');
  const firstActivate = ctx.events.findIndex((event) => event.type === 'activate' && event.itemId === 'gigawatz');
  assert.equal(firstDamage?.meta?.effect, true, `Gigawatz marks its damage as effect damage on ${side}`);
  assert.equal(firstActivate > ctx.events.findIndex((event) => event === firstDamage), true, `Gigawatz activates after its effect damage on ${side}`);

  ctx.events.length = 0;
  foe.stacks.blind = 0;
  handler.onCooldownEffect(giga, ctx);
  assert.equal(foe.hp, 73, `Gigawatz adds the source damageBonus after its first cooldown on ${side}`);

  const zero = piece(side, {
    placementKey: `${side}:gigawatz-zero`,
    params: { blind: 0, p1: 0, damincrease: 0, p2: 0, speed: 0, p3: 0, max: 0, p4: 0 },
  });
  const zeroCtx = context(owner, foe, zero);
  foe.stacks.blind = 0;
  handler.onPrepare(zero, zeroCtx);
  const hpBefore = foe.hp;
  handler.onCooldownEffect(zero, zeroCtx);
  assert.equal(foe.stacks.blind || 0, 0, `Gigawatz honors explicit zero Blind on ${side}`);
  assert.equal(foe.hp, hpBefore - 10, `Gigawatz preserves its descriptor damage when effect parameters are zero on ${side}`);
}

console.log('OK Gigawatz source-backed preparation counters, capped charge speed, effect damage, source damage increments, and zero parameters');
