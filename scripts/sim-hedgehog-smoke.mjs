import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/Hedgehog.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_damaged", "onDamaged"\)/);
assert.match(source, /func onDamaged\(_damage, event\):[\s\S]*relHealth = character\(\)\.getRelativeHealth\(\)[\s\S]*relHealth < healthThreshold/);
assert.match(source, /func onHPLow\(event\):[\s\S]*giveSpikes\(spikes, event\)[\s\S]*giveBlock\(getBlock\(\), true, event\)[\s\S]*spawnSpikeParticles\(\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*character\(\)\.getSpikes\(\) \* damagePerSpike[\s\S]*activate\(res\)/);
assert.match(source, /func getTriggerPriority\(\) -> int:[\s\S]*Priority\.High \+ 3/);

assert.equal(inventory.byId.hedgehog?.file, 'Exclusive/Hedgehog.gd');
assert.equal(getScriptHandler('hedgehog')?.handlerId, 'hedgehog');

function piece(overrides = {}) {
  const item = byId.get('hedgehog');
  return {
    ...item,
    itemId: 'hedgehog',
    placementKey: 'you:hedgehog',
    name: item.displayName || item.name,
    params: item.params || {},
    side: 'you',
    kind: 'pet',
    alive: true,
    damageMin: item.damageMin,
    damageMax: item.damageMax,
    blockGrant: item.block,
    ...overrides,
  };
}

function context(player, hedgehog) {
  const dummy = createActor('dummy', { maxHp: 200 });
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return { player, dummy, bus, events: [], t: 4, rng: () => 0.5, pieces: [hedgehog], itemsById: byId };
}

const handler = getScriptHandler('hedgehog');
const player = createActor('player', { maxHp: 100 });
const hedgehog = piece();
const ctx = context(player, hedgehog);
handler.onPrepare(hedgehog, ctx);

player.hp = 70;
ctx.bus.emit('character_damaged', { actor: player, hit: true, t: 4 });
assert.equal(player.stacks.spikes, 0, 'Hedgehog does not trigger at the strict source threshold boundary');
player.hp = 69;
ctx.bus.emit('character_damaged', { actor: player, hit: true, t: 4 });
assert.equal(player.stacks.spikes, 3, 'Hedgehog grants the source spike amount below the threshold');
assert.equal(player.block, 25, 'Hedgehog grants the item Block value below the threshold');
assert.equal(ctx.events.some((event) => event.type === 'info' && event.meta?.miniActivate && event.itemId === 'hedgehog'), true, 'Hedgehog records the source mini activation');

ctx.bus.emit('character_damaged', { actor: player, hit: true, t: 5 });
assert.equal(player.stacks.spikes, 3, 'Hedgehog low-HP trigger is one-shot');

const zeroPlayer = createActor('player', { maxHp: 100 });
const zeroHedgehog = piece({
  params: { healtht: 0, p3: 0, spikes: 0, p4: 0, dam_spikes: 0, p2: 0 },
  damageMin: 0,
  damageMax: 0,
  blockGrant: 0,
});
const zeroCtx = context(zeroPlayer, zeroHedgehog);
handler.onPrepare(zeroHedgehog, zeroCtx);
zeroPlayer.hp = 0;
zeroCtx.bus.emit('character_damaged', { actor: zeroPlayer, hit: true, t: 4 });
assert.equal(zeroPlayer.stacks.spikes || 0, 0, 'Hedgehog honors an explicit zero threshold/spike value');
handler.onCooldownEffect(zeroHedgehog, zeroCtx);
assert.equal(zeroCtx.events.filter((event) => event.type === 'damage').at(-1)?.amount || 0, 0, 'Hedgehog honors explicit zero damage inputs');

const strikePlayer = createActor('player', { maxHp: 100 });
strikePlayer.stacks.spikes = 4;
const strike = piece();
const strikeCtx = context(strikePlayer, strike);
handler.onCooldownEffect(strike, strikeCtx);
assert.equal(strikeCtx.events.find((event) => event.type === 'damage')?.amount, 12, 'Hedgehog damage scales by source damage-per-spike');

console.log('OK Hedgehog source-backed preparation threshold trigger, mini activation, one-shot behavior, damage scaling, and zero parameters');
