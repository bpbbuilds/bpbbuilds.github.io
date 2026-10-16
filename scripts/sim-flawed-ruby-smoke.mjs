/**
 * Flawed Ruby fidelity — inherited Ruby inventory stealLife, modified
 * lifesteal factor, weapon-hit healing, and armor GemPower scaling.
 *   node scripts/sim-flawed-ruby-smoke.mjs
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
const sourceGem = catalog.find((entry) => entry.id === 'flawed_ruby');
const swordItem = catalog.find((entry) => entry.id === 'wooden_sword');
const armorItem = catalog.find((entry) => entry.id === 'leather_armor');
assert.ok(sourceGem && swordItem && armorItem);

const rubySource = fs.readFileSync('tools/game-extract-full/Items/Gems/Ruby.gd', 'utf8');
const itemSource = fs.readFileSync('tools/game-extract-full/Items/Item.gd', 'utf8');
const gemSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Gem.gd', 'utf8');
assert.match(rubySource, /func doCooldownEffect\(\):\s*\n\s*stealLife\(getP3\(\), getP_m\("lifesteal_factor"\) \/ 100\.0\)/);
assert.match(rubySource, /func prepareWeapon\(\):\s*\n\s*connectForCombat\(socket\.getItem\(\), "attacked", "onAttack"\)/);
assert.match(rubySource, /heal\(ceil\(damageRes\.damage \* getP_m\("lifesteal_weapon"\) \/ 100\.0\), damageRes\.event\)/);
assert.match(rubySource, /character\(\)\.addHealingEfficiency\(getGemPower\(\) \* getP2\(\) \/ 100\.0\)/);
assert.match(itemSource, /func stealLife\(damage, lifestealFactor: float = 1\.0/);
assert.match(gemSource, /var gemPower = 1\.0/);

const gem = {
  ...sourceGem,
  shape: sourceGem.shape || [[1]],
  params: {
    p1: 12.5,
    p2: 15,
    p3: 0.4,
    lifesteal_weapon: 12.5,
    lifesteal_factor: 150,
  },
  paramMult: { lifesteal_factor: 2, lifesteal_weapon: 2 },
  gemPower: 2,
};
const byId = new Map([
  ['flawed_ruby', gem],
  ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
  ['leather_armor', { ...armorItem, shape: armorItem.shape || [[1]] }],
]);

const handler = getScriptHandler('flawed_ruby');
assert.equal(handler?.handlerId, 'flawed_ruby');
assert.equal(typeof handler?.onCooldownEffect, 'function');

const inventoryOwner = createActor('player');
const inventoryFoe = createActor('dummy');
inventoryOwner.hp = 50;
const inventoryEvents = [];
bindBuffCombatLog({ events: inventoryEvents, getT: () => 5, dummy: inventoryFoe });
try {
  handler.onCooldownEffect(
    {
      itemId: 'flawed_ruby',
      placementKey: 'inventory',
      name: 'Flawed Ruby',
      params: gem.params,
      paramMult: gem.paramMult,
      alive: true,
    },
    { player: inventoryOwner, dummy: inventoryFoe, events: inventoryEvents, t: 5, rng: () => 0 },
  );
} finally {
  unbindBuffCombatLog();
}
const inventoryDamage = inventoryEvents.find((event) => event.type === 'damage' && event.itemId === 'flawed_ruby');
assert.equal(inventoryDamage?.amount, 0, 'inventory Ruby keeps fractional source damage before downstream rounding');
assert.equal(inventoryOwner.hp, 50, 'zero rounded damage produces no lifesteal heal');
assert.equal(inventoryEvents.at(-1)?.type, 'activate', 'inventory Ruby activates after stealLife');

const [weapon] = buildCombatPieces(
  [{ id: 'wooden_sword', key: 'weapon', x: 0, y: 0, r: 0, gems: ['flawed_ruby'] }],
  byId,
);
const weaponOwner = createActor('player');
weaponOwner.hp = 90;
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
assert.equal(weaponOwner.hp, 92, 'weapon Ruby uses modified lifesteal percentage and source ceil');

const [armor] = buildCombatPieces(
  [{ id: 'leather_armor', key: 'armor', x: 0, y: 0, r: 0, gems: ['flawed_ruby'] }],
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
assert.equal(armorOwner._healAmp, 0.3, 'armor Ruby applies source GemPower times healing efficiency');

console.log('OK Flawed Ruby source, inventory, weapon, and armor regression');
