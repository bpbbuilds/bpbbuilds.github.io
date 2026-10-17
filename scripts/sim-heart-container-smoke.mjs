import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/HeartContainer.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onPrepare\(\):[\s\S]*setState\(false\)[\s\S]*connectForCombat\(character\(\), "character_regeneration_changed", "onRegenChanged"\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*giveRegeneration\(getP1\(\)\)[\s\S]*activate\(\)/);
assert.match(source, /func onRegenChanged\(amount, event\):[\s\S]*useRegeneration\(regenNeeded, event\)[\s\S]*giveMaxHealth\(getP_m\("maxhealth"\), event\)[\s\S]*giveEmpower\(getP4\(\), event\)[\s\S]*addHealingEfficiency\(getP5\(\) \/ 100\.0\)/);
assert.equal(inventory.byId.heart_container?.file, 'HeartContainer.gd');
assert.equal(getScriptHandler('heart_container')?.handlerId, 'heart_container');

function piece(overrides = {}) {
  const item = byId.get('heart_container');
  return {
    ...item,
    itemId: 'heart_container',
    placementKey: 'you:heart-container',
    name: item.displayName,
    params: item.params,
    side: 'you',
    kind: 'accessory',
    alive: true,
    ...overrides,
  };
}

function context(player) {
  const dummy = createActor('dummy', { maxHp: 200 });
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    player,
    dummy,
    bus,
    events: [],
    t: 3,
    pieces: [],
    graph: { pieces: new Map(), filled: new Map() },
    itemsById: byId,
    canAffect: null,
  };
}

const handler = getScriptHandler('heart_container');
const player = createActor('player', { maxHp: 100 });
const ctx = context(player);
const heart = piece();
handler.onPrepare(heart, ctx);
handler.onCooldownEffect(heart, ctx);
assert.equal(player.stacks.regeneration, 1, 'Heart Container gives source P1 Regeneration');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Heart Container activates after its regeneration grant');

grantStacks(player, 'regeneration', 6, { originKey: 'test', originId: 'test' });
assert.equal(player.stacks.regeneration, 0, 'Heart Container spends the source regeneration threshold');
assert.equal(player.maxHp, 200, 'Heart Container gives source max health');
assert.equal(player.hp, 200, 'Heart Container heals by its max-health gain');
assert.equal(player.stacks.empower, 2, 'Heart Container gives source Empower');
assert.equal(player._healAmp, 0.15, 'Heart Container gives source healing efficiency');

const zeroPlayer = createActor('player', { maxHp: 100 });
const zeroCtx = context(zeroPlayer);
const zero = piece({
  placementKey: 'you:heart-container-zero',
  params: {
    regen: 0,
    p1: 0,
    regent: 0,
    p2: 0,
    maxhealth: 0,
    p3: 0,
    empower: 0,
    p4: 0,
    healamp: 0,
    p5: 0,
  },
});
handler.onPrepare(zero, zeroCtx);
handler.onCooldownEffect(zero, zeroCtx);
assert.equal(zeroPlayer.stacks.regeneration, 0, 'Heart Container honors explicit zero regeneration');
grantStacks(zeroPlayer, 'regeneration', 1, { originKey: 'test', originId: 'test' });
assert.equal(zeroPlayer.maxHp, 100, 'Heart Container honors explicit zero max health');
assert.equal(zeroPlayer.stacks.empower, 0, 'Heart Container honors explicit zero Empower');
assert.equal(zeroPlayer._healAmp, 0, 'Heart Container honors explicit zero healing efficiency');
assert.equal(zeroCtx.events.at(-1)?.type, 'activate', 'Heart Container still activates with zero values');

console.log('OK Heart Container source-backed regeneration, threshold conversion, activation ordering, and zero parameters');
