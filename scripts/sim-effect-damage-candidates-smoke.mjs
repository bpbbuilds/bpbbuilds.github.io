import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { dealEffectDamage } from '../js/pages/sim/engine/scripts/handlers.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const files = {
  amulet_of_darkness: 'Items/Exclusive/AmuletofDarkness.gd',
  demonic_flask: 'Items/DemonicFlask.gd',
  ice_dragon: 'Items/Exclusive/IceDragon.gd',
  lightning_potion: 'Items/Exclusive/LightningPotion.gd',
  snowcake: 'Items/Exclusive/Snowcake.gd',
  sun_shield: 'Items/Exclusive/SunShield.gd',
  thors_hammer: 'Items/Exclusive/ThorsHammer.gd',
};
for (const [id, file] of Object.entries(files)) {
  assert.ok(fs.existsSync(`tools/game-extract-full/${file}`), `${id} source exists`);
  assert.equal(typeof getScriptHandler(id)?.onCooldownEffect === 'function' || typeof getScriptHandler(id)?.onCombatStart === 'function', true, `${id} has a runtime port`);
}
assert.match(fs.readFileSync('tools/game-extract-full/Items/Exclusive/AmuletofDarkness.gd', 'utf8'), /damageSource\.isEffectDamage/);
assert.match(fs.readFileSync('tools/game-extract-full/Items/Exclusive/SunShield.gd', 'utf8'), /dealEffectDamage/);

function context() {
  const bus = createCombatBus();
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    t: 1,
    player,
    dummy,
    bus,
    events: [],
    rng: () => 0,
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: new Map(),
    canAffect: null,
    pieces: [],
  };
}

// Every effect path is marked/scaled as effect damage, not an ordinary attack.
{
  const ctx = context();
  ctx.player.effectDmgFactor = 0.5;
  const piece = { itemId: 'effect_test', placementKey: 'effect', name: 'Effect', bonusDamageFactor: 1 };
  const res = dealEffectDamage(piece, ctx, 10);
  assert.equal(res.damage, 15);
  assert.equal(ctx.events.at(-1)?.meta?.effect, true);
}

// Amulet of Darkness accumulates incoming opponent effect damage only.
{
  const ctx = context();
  const amulet = { itemId: 'amulet_of_darkness', placementKey: 'amulet', name: 'Amulet', params: { damt: 5 } };
  ctx.itemsById.set(amulet.itemId, { id: amulet.itemId, chance: 100 });
  getScriptHandler(amulet.itemId).onCombatStart(amulet, ctx);
  dealEffectDamage({ itemId: 'source', placementKey: 'source', name: 'Source' }, ctx, 5);
  assert.ok(ctx.dummy.stacks.poison + ctx.dummy.stacks.blind + ctx.dummy.stacks.cold > 0, 'Amulet reacts to effect damage');
}

// Demonic Flask uses effect damage; Lightning Potion is the same direct path.
{
  const ctx = context();
  ctx.dummy.hp = 40;
  grantStacks(ctx.dummy, 'poison', 2);
  const flask = { itemId: 'demonic_flask', placementKey: 'flask', name: 'Flask', params: { p1: 50, p2: 2 }, alive: true, charges: 1 };
  getScriptHandler(flask.itemId).onCombatStart(flask, ctx);
  ctx.bus.emit('piece_dealt_damage', { piece: { itemId: 'weapon' }, hit: { hit: true }, t: ctx.t });
  assert.ok(ctx.events.some((e) => e.itemId === 'demonic_flask' && e.meta?.effect), 'Demonic Flask logs effect damage');
}
{
  const ctx = context();
  const potion = { itemId: 'lightning_potion', placementKey: 'potion', name: 'Lightning Potion', params: { p2: 1, p3: 1, p4: 2 }, damageMin: 5, alive: true, charges: 1 };
  getScriptHandler(potion.itemId).onCooldownEffect(potion, ctx);
  assert.ok(ctx.events.some((e) => e.itemId === potion.itemId && e.meta?.effect), 'Lightning Potion logs effect damage');
}

// Ice Dragon changes the foe's effect-damage factor, not global damage resistance.
{
  const ctx = context();
  const dragon = { itemId: 'ice_dragon', placementKey: 'dragon', name: 'Ice Dragon', params: { coldt: 2, damfactor: 10 }, blockGrant: 3 };
  getScriptHandler(dragon.itemId).onCombatStart(dragon, ctx);
  grantStacks(ctx.dummy, 'cold', 2);
  assert.equal(ctx.dummy.effectDmgFactor, -0.1);
  assert.equal(ctx.dummy.damageResistancePct, 0);
}

// Snowcake, Sun Shield, and Thor's Hammer all use the effect path for their proc hit.
{
  const ctx = context();
  const cake = { itemId: 'snowcake', placementKey: 'cake', name: 'Snowcake', params: { cold: 1, coldt: 1, damfactor: 10 }, damageMin: 5 };
  getScriptHandler(cake.itemId).onCooldownEffect(cake, ctx);
  assert.ok(ctx.events.some((e) => e.itemId === cake.itemId && e.meta?.effect), 'Snowcake logs effect damage');
}
{
  const ctx = context();
  const shield = { itemId: 'sun_shield', placementKey: 'shield', name: 'Sun Shield', params: { p3: 1, p4: 5 }, chance: 100 };
  ctx.itemsById.set(shield.itemId, shield);
  getScriptHandler(shield.itemId).onCombatStart(shield, ctx);
  ctx.bus.emit('afterBlock', {});
  assert.ok(ctx.events.some((e) => e.itemId === shield.itemId && e.meta?.effect), 'Sun Shield logs effect damage');
}
{
  const ctx = context();
  ctx.player.stacks.mana = 1;
  const hammer = { itemId: 'thors_hammer', placementKey: 'hammer', name: "Thor's Hammer", params: { manat: 1, dam: 5, blind: 1, dur_blind: 2 }, chance: 0 };
  getScriptHandler(hammer.itemId).onDealtDamage(hammer, ctx, { hit: true, damage: 4 });
  assert.ok(ctx.events.some((e) => e.itemId === hammer.itemId && e.meta?.effect), "Thor's Hammer logs effect damage");
}

console.log('OK effect-damage candidate ports: Amulet, Demonic Flask, Ice Dragon, Lightning Potion, Snowcake, Sun Shield, Thor');
