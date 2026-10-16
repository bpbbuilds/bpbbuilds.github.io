/**
 * Perfect Ruby fidelity — explicit Godly Ruby.gd tier alias with actual
 * inventory stealLife, weapon healing, and armor values.
 *   node scripts/sim-perfect-ruby-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { bindBuffCombatLog, unbindBuffCombatLog } from '../js/pages/sim/engine/buff-log.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const sourceGem = catalog.find((entry) => entry.id === 'perfect_ruby');
const swordItem = catalog.find((entry) => entry.id === 'wooden_sword');
const armorItem = catalog.find((entry) => entry.id === 'leather_armor');
assert.ok(sourceGem && swordItem && armorItem);

const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
const row = inventory.byId.perfect_ruby;
assert.equal(row?.sceneFile, 'Gems/PerfectRuby.tscn');
assert.equal(row?.file, 'Gems/Ruby.gd');
assert.equal(row?.extends, 'Gem');

const rubySource = fs.readFileSync('tools/game-extract-full/Items/Gems/Ruby.gd', 'utf8');
assert.match(rubySource, /stealLife\(getP3\(\), getP_m\("lifesteal_factor"\) \/ 100\.0\)/);
assert.match(rubySource, /heal\(ceil\(damageRes\.damage \* getP_m\("lifesteal_weapon"\) \/ 100\.0\), damageRes\.event\)/);
assert.match(rubySource, /addHealingEfficiency\(getGemPower\(\) \* getP2\(\) \/ 100\.0\)/);

const gem = { ...sourceGem, shape: sourceGem.shape || [[1]], gemPower: 2 };
const byId = new Map([
  ['perfect_ruby', gem],
  ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
  ['leather_armor', { ...armorItem, shape: armorItem.shape || [[1]] }],
]);

const handler = getScriptHandler('perfect_ruby');
assert.equal(handler?.handlerId, 'perfect_ruby');
const inventoryOwner = createActor('player');
const inventoryFoe = createActor('dummy');
inventoryOwner.hp = 50;
const inventoryEvents = [];
bindBuffCombatLog({ events: inventoryEvents, getT: () => 5, dummy: inventoryFoe });
try {
  handler.onCooldownEffect(
    { itemId: 'perfect_ruby', placementKey: 'inventory', name: 'Perfect Ruby', params: gem.params, alive: true },
    { player: inventoryOwner, dummy: inventoryFoe, events: inventoryEvents, t: 5, rng: () => 0 },
  );
} finally {
  unbindBuffCombatLog();
}
const inventoryDamage = inventoryEvents.find((event) => event.type === 'damage' && event.itemId === 'perfect_ruby');
const inventoryHeal = inventoryEvents.find((event) => event.type === 'heal' && event.itemId === 'perfect_ruby');
assert.equal(inventoryDamage?.amount, 35, 'Perfect Ruby inventory uses source p3 damage');
assert.equal(inventoryHeal?.amount, 53, 'Perfect Ruby inventory uses source factor and heal rounding');
assert.ok(inventoryEvents.indexOf(inventoryDamage) < inventoryEvents.indexOf(inventoryHeal));
assert.equal(inventoryEvents.at(-1)?.type, 'activate', 'Perfect Ruby activates after stealLife');

const [weapon] = buildCombatPieces(
  [{ id: 'wooden_sword', key: 'weapon', x: 0, y: 0, r: 0, gems: ['perfect_ruby'] }],
  byId,
);
const weaponOwner = createActor('player');
weaponOwner.hp = 100;
const weaponBus = createCombatBus();
prepareGemSockets(weapon, {
  player: weaponOwner,
  dummy: createActor('dummy'),
  bus: weaponBus,
  itemsById: byId,
  rng: () => 0,
  t: 0,
});
weaponBus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true, damage: 8 }, t: 1 });
assert.equal(weaponOwner.hp, 103, 'Perfect Ruby weapon heals ceil(damage × source percentage)');

const [armor] = buildCombatPieces(
  [{ id: 'leather_armor', key: 'armor', x: 0, y: 0, r: 0, gems: ['perfect_ruby'] }],
  byId,
);
const armorOwner = createActor('player');
prepareGemSockets(armor, {
  player: armorOwner,
  dummy: createActor('dummy'),
  bus: createCombatBus(),
  itemsById: byId,
  rng: () => 0,
  t: 0,
});
assert.equal(armorOwner._healAmp, 0.8, 'Perfect Ruby armor applies source GemPower times p2');

console.log('OK Perfect Ruby source alias and socket regression');
