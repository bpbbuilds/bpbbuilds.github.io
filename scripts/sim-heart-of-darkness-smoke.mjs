import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/HeartofDarkness.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onPrepare\(\):[\s\S]*setState\(false\)[\s\S]*connectForCombat\(character\(\), "character_regeneration_changed", "onRegenChanged"\)[\s\S]*addSpeed\(getNumAffectedItems\(\) \* getP\("darkspeed"\) \/ 100\.0\)/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*stealRandomBuff\(numStealedBuffs, null, Game\.getBuffs\(\), Game\.EventType\.Regeneration\)[\s\S]*activate\(\)/);
assert.match(source, /func onRegenChanged\(amount, event\):[\s\S]*useRegeneration\(regenNeeded, event\)[\s\S]*giveMaxHealth\(getP_m\("maxhealth"\), event\)[\s\S]*giveEmpower\(getP\("empower"\), event\)[\s\S]*reduceHealingEfficiency\(getP\("healreduction"\) \/ 100\.0\)/);
assert.equal(inventory.byId.heart_of_darkness?.file, 'HeartofDarkness.gd');
assert.equal(getScriptHandler('heart_of_darkness')?.handlerId, 'heart_of_darkness');

function piece(overrides = {}) {
  const item = byId.get('heart_of_darkness');
  return {
    ...item,
    itemId: 'heart_of_darkness',
    placementKey: 'you:heart-of-darkness',
    name: item.displayName,
    params: item.params,
    side: 'you',
    kind: 'accessory',
    alive: true,
    ...overrides,
  };
}

function context(player, dummy = createActor('dummy', { maxHp: 200 })) {
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    player,
    dummy,
    bus,
    rng: () => 0,
    events: [],
    t: 4,
    pieces: [],
    graph: {
      pieces: new Map(),
      filled: new Map(),
    },
    itemsById: byId,
    canAffect: null,
  };
}

const handler = getScriptHandler('heart_of_darkness');
const player = createActor('player', { maxHp: 100 });
const dummy = createActor('dummy', { maxHp: 200 });
const ctx = context(player, dummy);
const heart = piece();
ctx.graph.pieces.set(heart.placementKey, {
  id: heart.itemId,
  affectCells: [{ cell: 'dark-cell', color: 'primary' }],
  cells: [],
});
ctx.graph.pieces.set('you:dark-item', { id: 'dark_lantern', affectCells: [], cells: [] });
ctx.graph.filled.set('dark-cell', 'you:dark-item');
handler.onPrepare(heart, ctx);
assert.equal(heart.speedScale, 0.2, 'Heart of Darkness adds source Dark-item speed during preparation');

grantStacks(dummy, 'regeneration', 2, { originKey: 'dummy:regen', originId: 'dummy:regen' });
grantStacks(dummy, 'empower', 1, { originKey: 'dummy:empower', originId: 'dummy:empower' });
handler.onCooldownEffect(heart, ctx);
assert.equal(player.stacks.regeneration, 2, 'Heart of Darkness prioritizes stealing Regeneration');
assert.equal(dummy.stacks.regeneration, 0, 'Heart of Darkness removes stolen Regeneration');
assert.equal(ctx.events.at(-1)?.type, 'activate', 'Heart of Darkness activates after stealing buffs');

grantStacks(player, 'regeneration', 5, { originKey: 'test', originId: 'test' });
assert.equal(player.stacks.regeneration, 0, 'Heart of Darkness spends the source regeneration threshold');
assert.equal(player.maxHp, 200, 'Heart of Darkness gives source max health');
assert.equal(player.hp, 200, 'Heart of Darkness heals by its max-health gain');
assert.equal(player.stacks.empower, 4, 'Heart of Darkness gives source Empower');
assert.equal(dummy.unhealing, 0.4, 'Heart of Darkness reduces the opponent healing efficiency');
assert.ok(ctx.events.some((event) => event.type === 'stat' && event.meta?.stat === 'unhealing'), 'Heart of Darkness emits the healing-reduction stat event');

const zeroPlayer = createActor('player', { maxHp: 100 });
const zeroDummy = createActor('dummy', { maxHp: 200 });
const zeroCtx = context(zeroPlayer, zeroDummy);
const zero = piece({
  placementKey: 'you:heart-of-darkness-zero',
  params: {
    regent: 0,
    p1: 0,
    healreduction: 0,
    p2: 0,
    empower: 0,
    p3: 0,
    maxhealth: 0,
    p4: 0,
    buffsteal: 0,
    p5: 0,
    darkspeed: 0,
    p6: 0,
  },
});
handler.onPrepare(zero, zeroCtx);
grantStacks(zeroPlayer, 'regeneration', 1, { originKey: 'test', originId: 'test' });
assert.equal(zeroPlayer.maxHp, 100, 'Heart of Darkness honors explicit zero max health');
assert.equal(zeroPlayer.stacks.empower, 0, 'Heart of Darkness honors explicit zero Empower');
assert.equal(zeroDummy.unhealing, 0, 'Heart of Darkness honors explicit zero healing reduction');
grantStacks(zeroDummy, 'regeneration', 1, { originKey: 'dummy:regen', originId: 'dummy:regen' });
handler.onCooldownEffect(zero, zeroCtx);
assert.equal(zeroPlayer.stacks.regeneration, 1, 'Heart of Darkness honors explicit zero buff steal');
assert.equal(zeroDummy.stacks.regeneration, 1, 'Heart of Darkness does not steal with an explicit zero count');
assert.equal(zeroCtx.events.at(-1)?.type, 'activate', 'Heart of Darkness still activates with zero values');

console.log('OK Heart of Darkness source-backed preparation, Dark speed, priority steal, threshold conversion, stat logging, and zero parameters');
