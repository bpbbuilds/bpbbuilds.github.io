import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/HeavyDrinking.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onPrepare\(\):[\s\S]*addSpeed\(getNumDistinctAffectedItems\(\) \* potionSpeed\)/);
assert.match(source, /for item in inventory\.getItems\(\):[\s\S]*item\.hasType\(Type\.Potion\) and item != self/);
assert.match(source, /func doCooldownEffect\(\):[\s\S]*potionToTrigger\.triggerPotion\(\)[\s\S]*potionToTrigger\.miniActivate\(\)[\s\S]*activate\(\)/);
assert.match(source, /func onItemRoll\(descr\):[\s\S]*boostedPotions > 0[\s\S]*multiplyWeight\(1\.5\)/);

assert.equal(inventory.byId.heavy_drinking?.file, 'Exclusive/HeavyDrinking.gd');
assert.equal(getScriptHandler('heavy_drinking')?.handlerId, 'heavy_drinking');

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item.displayName || item.name || id,
    params: item.params || {},
    side: key.startsWith('them:') ? 'them' : 'you',
    kind: id === 'heavy_drinking' ? 'skill' : 'consumable',
    alive: true,
    baseCooldown: item.cooldown || 0,
    ...overrides,
  };
}

function context(player, pieces) {
  const dummy = createActor('dummy', { maxHp: 200 });
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    player,
    dummy,
    bus,
    events: [],
    t: 5,
    rng: () => 0.99,
    pieces,
    graph: {
      pieces: new Map([
        ['you:heavy', { id: 'heavy_drinking', affectCells: [{ cell: 'star', color: 'primary' }], cells: [] }],
        ['you:linked-potion', { id: 'health_potion', affectCells: [], cells: ['star'] }],
      ]),
      filled: new Map([['star', 'you:linked-potion']]),
    },
    itemsById: byId,
    canAffect: null,
  };
}

const handler = getScriptHandler('heavy_drinking');
const player = createActor('player', { maxHp: 200 });
const heavy = piece('heavy_drinking', 'you:heavy');
const linkedPotion = piece('health_potion', 'you:linked-potion');
const unrelatedPotion = piece('health_potion', 'you:unrelated-potion');
const opponentPotion = piece('health_potion', 'them:opponent-potion');
const ctx = context(player, [heavy, linkedPotion, unrelatedPotion, opponentPotion]);
let triggered = 0;
linkedPotion._potionTrigger = () => { triggered += 1; };
unrelatedPotion._potionTrigger = () => { triggered += 10; };
opponentPotion._potionTrigger = () => { triggered += 100; };

handler.onPrepare(heavy, ctx);
assert.equal(heavy.speedScale, 0.9, 'Heavy Drinking speed uses distinct affected potion count');
assert.deepEqual(heavy._drinkPotions, ['you:linked-potion', 'you:unrelated-potion'], 'Heavy Drinking only stores same-inventory potions');

handler.onCooldownEffect(heavy, ctx);
assert.equal(triggered, 10, 'Heavy Drinking triggers the selected potion without consuming it');
assert.equal(ctx.events.at(-1)?.itemId, 'heavy_drinking', 'Heavy Drinking activates after the nested potion effect');
assert.equal(ctx.events.some((event) => event.meta?.miniActivate && event.meta?.triggeredBy === 'heavy_drinking'), true, 'Heavy Drinking records the potion mini activation');

const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroHeavy = piece('heavy_drinking', 'you:zero-heavy', { params: { speed: 0, p1: 0 } });
const zeroCtx = context(zeroPlayer, [zeroHeavy]);
handler.onPrepare(zeroHeavy, zeroCtx);
assert.equal(zeroHeavy.speedScale || 0, 0, 'Heavy Drinking honors an explicit zero speed');

console.log('OK Heavy Drinking source-backed preparation count, same-inventory potion trigger, activation ordering, and zero speed');
