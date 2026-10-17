import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/IceDragon.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onPrepare\(\):[\s\S]*gaveBlock = false[\s\S]*connectForCombat\(opponent\(\), "character_cold_changed", "onOpponentColdChanged"\)/);
assert.match(source, /func onOpponentColdChanged\(amount, event\):[\s\S]*opponent\(\)\.getCold\(\) >= coldThreshold[\s\S]*giveBlock\(getBlock\(\), true, event\)[\s\S]*changeEffectDamageFactor\( - damReduction\)/);
assert.match(source, /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*inflictCold\(coldOnHit\)/);
assert.equal(inventory.byId.ice_dragon?.file, 'Exclusive/IceDragon.gd');
assert.equal(getScriptHandler('ice_dragon')?.handlerId, 'ice_dragon');

function piece(overrides = {}) {
  const item = byId.get('ice_dragon');
  return {
    ...item,
    itemId: 'ice_dragon',
    placementKey: 'you:ice-dragon',
    name: item.displayName || item.name,
    params: { ...(item.params || {}) },
    side: 'you',
    kind: 'weapon',
    blockGrant: item.block,
    alive: true,
    ...overrides,
  };
}

function context(player, dummy, pieceValue) {
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    player,
    dummy,
    bus,
    events: [],
    t: 3,
    rng: () => 0,
    pieces: [pieceValue],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: null,
  };
}

const player = createActor('player', { maxHp: 200 });
const dummy = createActor('dummy', { maxHp: 200 });
const dragon = piece({ params: { cold: 2, p1: 2, coldt: 3, p2: 3, damfactor: 20, p3: 20 } });
const ctx = context(player, dummy, dragon);
const handler = getScriptHandler('ice_dragon');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onPreDealDamageEarly, 'function');
handler.onPrepare(dragon, ctx);

handler.onPreDealDamageEarly(dragon, ctx, { hit: false });
assert.equal(dummy.stacks.cold, 0, 'Ice Dragon does not inflict Cold on a miss');
handler.onPreDealDamageEarly(dragon, ctx, { hit: true });
assert.equal(dummy.stacks.cold, 2, 'Ice Dragon inflicts source Cold before the attack resolves');
assert.equal(player.block, 0, 'Ice Dragon waits for its exact Cold threshold');
handler.onPreDealDamageEarly(dragon, ctx, { hit: true });
assert.equal(dummy.stacks.cold, 4, 'Ice Dragon adds Cold on each successful hit');
assert.equal(player.block, 90, 'Ice Dragon grants its live Block at the threshold');
assert.equal(dummy.effectDmgFactor, -0.2, 'Ice Dragon applies its source effect-damage reduction once');
assert.equal(ctx.events.at(-1)?.itemId, 'ice_dragon', 'Ice Dragon logs its activation after the threshold grant');

handler.onPreDealDamageEarly(dragon, ctx, { hit: true });
assert.equal(player.block, 90, 'Ice Dragon only grants threshold Block once');

const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroDummy = createActor('dummy', { maxHp: 200 });
const zeroDragon = piece({
  blockGrant: 0,
  params: { cold: 1, p1: 1, coldt: 1, p2: 1, damfactor: 0, p3: 0 },
});
const zeroCtx = context(zeroPlayer, zeroDummy, zeroDragon);
handler.onPrepare(zeroDragon, zeroCtx);
handler.onPreDealDamageEarly(zeroDragon, zeroCtx, { hit: true });
assert.equal(zeroPlayer.block, 0, 'Ice Dragon honors an explicit zero Block value');
assert.equal(zeroDummy.effectDmgFactor || 0, 0, 'Ice Dragon honors an explicit zero reduction');

console.log('OK Ice Dragon source-backed prepare listener, pre-hit Cold, threshold Block/reduction, one-shot behavior, and zero parameters');
