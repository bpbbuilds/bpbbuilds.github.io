import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/HyperHedgehog.gd', 'utf8');
const parent = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Hedgehog.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /extends "res:\/\/Items\/Exclusive\/Hedgehog\.gd"/);
assert.match(source, /func onHPLow\(event\):[\s\S]*\.onHPLow\(event\)[\s\S]*giveEmpower\(empower, event\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*descriptor\.minDam[\s\S]*getSpikes\(\) \* damagePerSpike[\s\S]*getEmpower\(\) \* damagePerEmpower[\s\S]*dealEffectDamage\(dam\)[\s\S]*activate\(res\)/);
assert.match(parent, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_damaged", "onDamaged"\)/);
assert.match(parent, /var healthThreshold = getP\("healtht"\) \/ 100\.0 - 0\.0001/);
assert.equal(inventory.byId.hyper_hedgehog?.file, 'Exclusive/HyperHedgehog.gd');
assert.equal(getScriptHandler('hyper_hedgehog')?.handlerId, 'hyper_hedgehog');

function piece(overrides = {}) {
  const item = byId.get('hyper_hedgehog');
  return {
    ...item,
    itemId: 'hyper_hedgehog',
    placementKey: 'you:hyper-hedgehog',
    name: item.displayName || item.name,
    params: item.params || {},
    side: 'you',
    kind: 'pet',
    cooldown: item.cooldown,
    damageMin: item.damageMin,
    damageMax: item.damageMax,
    alive: true,
    ...overrides,
  };
}

function context(player, dummy, pieces = []) {
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
    pieces,
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: null,
  };
}

const player = createActor('player', { maxHp: 200 });
const dummy = createActor('dummy', { maxHp: 200 });
const hyper = piece();
const ctx = context(player, dummy, [hyper]);
const handler = getScriptHandler('hyper_hedgehog');
handler.onPrepare(hyper, ctx);
player.hp = 139;
ctx.bus.emit('character_damaged', { actor: player, hit: { hit: true }, t: 2.9 });
assert.equal(player.stacks.spikes, 4, 'Hyper Hedgehog inherits the source low-health Spikes grant');
assert.equal(player.block, 35, 'Hyper Hedgehog inherits its live Block grant');
assert.equal(player.stacks.empower, 3, 'Hyper Hedgehog adds its source Empower grant at the inherited threshold');
assert.equal(ctx.events.at(-1)?.meta?.miniActivate, true, 'Hyper Hedgehog records the inherited mini activation after grants');

handler.onCooldownEffect(hyper, ctx);
assert.equal(dummy.hp, 185, 'Hyper Hedgehog deals fixed min damage plus current Spikes and Empower scaling');
assert.equal(ctx.events.at(-1)?.itemId, 'hyper_hedgehog', 'Hyper Hedgehog activates after effect damage');

const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroDummy = createActor('dummy', { maxHp: 200 });
const zeroHyper = piece({
  params: { healtht: 0, p3: 0, spikes: 0, p4: 0, dam_spikes: 0, p2: 0, dam_empower: 0, p5: 0, empower: 0, p6: 0 },
  damageMin: 0,
  damageMax: 0,
});
const zeroCtx = context(zeroPlayer, zeroDummy, [zeroHyper]);
handler.onPrepare(zeroHyper, zeroCtx);
handler.onCooldownEffect(zeroHyper, zeroCtx);
assert.equal(zeroPlayer.block, 0, 'Hyper Hedgehog honors explicit zero low-health Block');
assert.equal(zeroDummy.hp, 200, 'Hyper Hedgehog honors explicit zero damage parameters');

console.log('OK Hyper Hedgehog source-backed inherited threshold, Spikes/Block/Empower grants, effect damage scaling, activation ordering, and zero parameters');
