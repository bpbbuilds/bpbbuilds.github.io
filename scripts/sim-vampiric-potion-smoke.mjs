import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/VampiricPotion.gd', 'utf8');
const strongSource = fs.readFileSync('tools/game-extract-full/Items/Exclusive/StrongVampiricPotion.gd', 'utf8');
const simulateSource = fs.readFileSync('js/pages/sim/engine/simulate.js', 'utf8');
const rawCatalog = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.items;
const itemsById = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func onPrepare\(\):[\s\S]*connectForCombat\(character\(\), "character_damaged", "onPlayerDamaged"\)[\s\S]*connectForCombat\(opponent\(\), "character_damaged", "onPlayerDamaged"\)/);
assert.match(source, /func onPlayerDamaged\(_healthChange, event\):[\s\S]*relHealth < healthThreshold[\s\S]*relHealth2 < healthThreshold[\s\S]*consumePotion\(\)/);
assert.match(source, /func onTriggerPotion\(triggerEvent = null\):[\s\S]*stealLife\(dam, getP_m\("lifesteal"\) \/ 100\.0, triggerEvent\)[\s\S]*giveVampirism\(vampirism, triggerEvent\)/);
assert.match(strongSource, /\.onPrepare\(\)[\s\S]*connectForCombat\(opponent\(\), "character_attacked", "onOpponentDamaged"\)/);
assert.match(strongSource, /func onTriggerPotion\(triggerEvent = null\):[\s\S]*getP_m\("lifesteal"\)[\s\S]*lifestealTimer\.start\(getP_m\("dur"\)\)[\s\S]*giveVampirism\(getP2\(\), triggerEvent\)/);
assert.match(strongSource, /func onOpponentDamaged\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*damageRes\.damageSource\.canApplyLifesteal\(\)[\s\S]*heal\(ceil\(damageRes\.damage \* curLifesteal\), damageRes\.event\)/);
assert.match(strongSource, /func onCombatEnd\(\):[\s\S]*lifestealTimer\.stop\(\)/);
assert.match(simulateSource, /piece\._vampiricLifestealUntil != null/);

const handler = getScriptHandler('vampiric_potion');
const strongHandler = getScriptHandler('strong_vampiric_potion');
assert.equal(handler?.handlerId, 'vampiric_potion');
assert.equal(strongHandler?.handlerId, 'strong_vampiric_potion');

function makePiece(itemId, params, key = itemId, side = 'you') {
  return {
    itemId,
    placementKey: key,
    name: itemsById.get(itemId)?.name || itemId,
    kind: 'consumable',
    side,
    params,
    alive: true,
    charges: 1,
    cooldown: 999,
    triggerTime: 999,
  };
}

function makeContext(piece, { playerHp = 40, dummyHp = 40, pieces = [piece] } = {}) {
  const player = createActor('player', { maxHp: 100 });
  const dummy = createActor('dummy', { maxHp: 100 });
  player.hp = playerHp;
  dummy.hp = dummyHp;
  const bus = createCombatBus();
  player._combatBus = bus;
  dummy._combatBus = bus;
  return {
    t: 2,
    player,
    dummy,
    events: [],
    bus,
    pieces,
    itemsById,
    rng: () => 0,
    graph: { pieces: new Map(), filled: new Map() },
  };
}

const normal = makePiece('vampiric_potion', { p1: 80, p2: 3, p3: 15, p4: 100 });
const normalCtx = makeContext(normal);
handler.onPrepare(normal, normalCtx);
normalCtx.bus.emit('character_damaged', { actor: normalCtx.player, hit: true, healthDamage: 0, t: 2 });
assert.equal(normal.alive, false, 'Vampiric Potion consumes when both characters are below threshold');
assert.equal(normalCtx.dummy.hp, 25, 'Vampiric Potion uses source p3 effect damage');
assert.equal(normalCtx.player.hp, 55, 'Vampiric Potion steals source lifesteal percentage');
assert.equal(normalCtx.player.stacks.vampirism, 3, 'Vampiric Potion grants source p2 Vampirism');

const exact = makePiece('vampiric_potion', { p1: 80, p2: 3, p3: 15 }, 'exact');
const exactCtx = makeContext(exact, { playerHp: 80, dummyHp: 80 });
handler.onPrepare(exact, exactCtx);
exactCtx.bus.emit('character_damaged', { actor: exactCtx.player, hit: true, healthDamage: 1, t: 2 });
assert.equal(exact.alive, true, 'Vampiric Potion keeps the source strict below-threshold comparison');

const strong = makePiece(
  'strong_vampiric_potion',
  { p1: 80, p2: 5, lifesteal: 35, p3: 35, dur: 6, p4: 6 },
  'strong',
);
strong.paramMult = { dur: 2 };
const strongCtx = makeContext(strong);
strongHandler.onPrepare(strong, strongCtx);
strongCtx.bus.emit('character_damaged', { actor: strongCtx.player, hit: true, healthDamage: 1, t: 2 });
assert.equal(strong.alive, false, 'Strong Vampiric Potion consumes at the shared threshold');
assert.equal(strongCtx.dummy.hp, 40, 'Strong Vampiric Potion does not deal the normal immediate effect damage');
assert.equal(strongCtx.player.hp, 40, 'Strong Vampiric Potion does not heal immediately');
assert.equal(strongCtx.player.stacks.vampirism, 5, 'Strong Vampiric Potion grants source p2 Vampirism');
assert.equal(strong._vampiricLifestealUntil, 14, 'Strong Vampiric Potion uses placement-modified source duration');

strongHandler.onTick(strong, { ...strongCtx, t: 3 });
strongCtx.bus.emit('item_attacked', {
  piece: makePiece('shortbow', { p1: 1 }, 'opponent-attack', 'them'),
  hit: { hit: true, damage: 20, healthDamage: 10, canApplyLifesteal: true },
  t: 3,
});
assert.equal(strongCtx.player.hp, 47, 'Strong Vampiric Potion heals from full attack damage, not post-block damage');

strongCtx.bus.emit('item_attacked', {
  piece: makePiece('shortbow', { p1: 1 }, 'own-attack', 'you'),
  hit: { hit: true, damage: 20, healthDamage: 20, canApplyLifesteal: true },
  t: 4,
});
assert.equal(strongCtx.player.hp, 47, 'Strong Vampiric Potion ignores the owner side attacking');
strongCtx.bus.emit('item_attacked', {
  piece: makePiece('shortbow', { p1: 1 }, 'opponent-miss', 'them'),
  hit: { hit: false, damage: 20, healthDamage: 0, canApplyLifesteal: true },
  t: 5,
});
assert.equal(strongCtx.player.hp, 47, 'Strong Vampiric Potion ignores misses');

strongHandler.onTick(strong, { ...strongCtx, t: 14 });
assert.equal(strong._vampiricLifestealUntil, null, 'Strong Vampiric Potion expires its lifesteal timer');
strongCtx.bus.emit('item_attacked', {
  piece: makePiece('shortbow', { p1: 1 }, 'opponent-after', 'them'),
  hit: { hit: true, damage: 20, healthDamage: 20, canApplyLifesteal: true },
  t: 15,
});
assert.equal(strongCtx.player.hp, 47, 'Expired Strong Vampiric Potion no longer heals attacks');

const ended = makePiece('strong_vampiric_potion', { p1: 80, p2: 5, lifesteal: 35, p3: 35, dur: 6, p4: 6 }, 'ended');
const endedCtx = makeContext(ended);
strongHandler.onPrepare(ended, endedCtx);
endedCtx.bus.emit('character_damaged', { actor: endedCtx.player, hit: true, healthDamage: 1, t: 2 });
strongHandler.onCombatEnd(ended, endedCtx);
assert.equal(ended._vampiricLifestealUntil, null, 'Strong Vampiric Potion clears its timer at combat end');

console.log('OK Vampiric Potion and Strong Vampiric Potion source ports');
