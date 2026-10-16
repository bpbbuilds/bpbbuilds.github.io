/**
 * Flawless Emerald fidelity — explicit Emerald.gd tier alias with actual
 * inventory, weapon, and armor values.
 *   node scripts/sim-flawless-emerald-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const sourceGem = catalog.find((entry) => entry.id === 'flawless_emerald');
const swordItem = catalog.find((entry) => entry.id === 'wooden_sword');
const armorItem = catalog.find((entry) => entry.id === 'leather_armor');
assert.ok(sourceGem && swordItem && armorItem);

const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
const row = inventory.byId.flawless_emerald;
assert.equal(row?.sceneFile, 'Gems/FlawlessEmerald.tscn');
assert.equal(row?.file, 'Gems/Emerald.gd');
assert.equal(row?.extends, 'Gem');

const emeraldSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Emerald.gd', 'utf8');
assert.match(emeraldSource, /giveRegeneration\(getP3\(\)\)/);
assert.match(emeraldSource, /connectForCombat\(socket\.getItem\(\), "attacked", "onAttack"\)/);
assert.match(emeraldSource, /inflictPoison\(getP1\(\), damageRes\.event\)/);
assert.match(emeraldSource, /changeResistChance\(Game\.EventType\.Poison, getGemPower\(\) \* getP2\(\)\)/);

const gem = {
  ...sourceGem,
  shape: sourceGem.shape || [[1]],
  chance: 100,
  gemPower: 2,
};
const byId = new Map([
  ['flawless_emerald', gem],
  ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
  ['leather_armor', { ...armorItem, shape: armorItem.shape || [[1]] }],
]);

const handler = getScriptHandler('flawless_emerald');
assert.equal(handler?.handlerId, 'flawless_emerald');
const owner = createActor('player');
const foe = createActor('dummy');
const events = [];
handler.onCooldownEffect(
  { itemId: 'flawless_emerald', placementKey: 'inventory', name: 'Flawless Emerald', params: gem.params, alive: true },
  { player: owner, dummy: foe, events, t: 5, rng: () => 0 },
);
assert.equal(owner.stacks.regeneration, 4, 'Flawless Emerald inventory gives source p3 regeneration');
assert.equal(events.at(-1)?.type, 'activate', 'Flawless Emerald inventory activates after regeneration');

const [weapon] = buildCombatPieces(
  [{ id: 'wooden_sword', key: 'weapon', x: 0, y: 0, r: 0, gems: ['flawless_emerald'] }],
  byId,
);
const weaponFoe = createActor('dummy');
const weaponBus = createCombatBus();
prepareGemSockets(weapon, {
  player: createActor('player'),
  dummy: weaponFoe,
  bus: weaponBus,
  itemsById: byId,
  rng: () => 0,
  t: 0,
});
weaponBus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true, damage: 4 }, t: 1 });
assert.equal(weaponFoe.stacks.poison, 2, 'Flawless Emerald weapon applies source p1 poison');

const [armor] = buildCombatPieces(
  [{ id: 'leather_armor', key: 'armor', x: 0, y: 0, r: 0, gems: ['flawless_emerald'] }],
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
assert.equal(armorOwner.stackResist.poison, 50, 'Flawless Emerald armor applies source GemPower times p2');

console.log('OK Flawless Emerald source alias and socket regression');
