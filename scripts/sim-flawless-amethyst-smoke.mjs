/**
 * Flawless Amethyst fidelity — explicit tier alias over Amethyst.gd:
 * inventory cleanse, source int() buff removal, and GemPower armor reduction.
 *   node scripts/sim-flawless-amethyst-smoke.mjs
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
const sourceGem = catalog.find((entry) => entry.id === 'flawless_amethyst');
const swordItem = catalog.find((entry) => entry.id === 'wooden_sword');
const armorItem = catalog.find((entry) => entry.id === 'leather_armor');
assert.ok(sourceGem && swordItem && armorItem);

const inventory = JSON.parse(fs.readFileSync('assets/data/sim-item-inventory.json', 'utf8'));
const row = inventory.byId.flawless_amethyst;
assert.equal(row?.sceneFile, 'Gems/FlawlessAmethyst.tscn');
assert.equal(row?.file, 'Gems/Amethyst.gd');
assert.equal(row?.extends, 'Gem');

const amethystSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Amethyst.gd', 'utf8');
const gemSource = fs.readFileSync('tools/game-extract-full/Items/Gems/Gem.gd', 'utf8');
assert.match(amethystSource, /onready var healReduction: = getP1\(\) \/ 100\.0/);
assert.match(amethystSource, /onready var buffRemoval: = int\(getP2\(\)/);
assert.match(amethystSource, /cleanseRandomDebuffs\(1\)\s*\n\s*activate\(\)/);
assert.match(amethystSource, /removeRandomBuffs\(buffRemoval, damageRes\.event\)/);
assert.match(amethystSource, /opponent\(\)\.reduceHealingEfficiency\(getGemPower\(\) \* healReduction\)/);
assert.match(gemSource, /var gemPower = 1\.0/);

const gem = {
  ...sourceGem,
  shape: sourceGem.shape || [[1]],
  params: { p1: 30, p2: 1.9, buffs: 1.9 },
  chance: 100,
  gemPower: 2,
};
const byId = new Map([
  ['flawless_amethyst', gem],
  ['wooden_sword', { ...swordItem, shape: swordItem.shape || [[1]] }],
  ['leather_armor', { ...armorItem, shape: armorItem.shape || [[1]] }],
]);

const handler = getScriptHandler('flawless_amethyst');
assert.equal(handler?.handlerId, 'flawless_amethyst');
const owner = createActor('player');
const foe = createActor('dummy');
owner.stacks.poison = 1;
const events = [];
handler.onCooldownEffect(
  { itemId: 'flawless_amethyst', placementKey: 'inventory', name: 'Flawless Amethyst', params: gem.params, alive: true },
  { player: owner, dummy: foe, events, t: 5, rng: () => 0 },
);
assert.equal(owner.stacks.poison, 0, 'Flawless Amethyst inventory cleanses one debuff');
assert.equal(events.at(-1)?.type, 'activate', 'Flawless Amethyst inventory activates after cleanse');

const [weapon] = buildCombatPieces(
  [{ id: 'wooden_sword', key: 'weapon', x: 0, y: 0, r: 0, gems: ['flawless_amethyst'] }],
  byId,
);
const weaponFoe = createActor('dummy');
weaponFoe.stacks.lucky = 1;
weaponFoe.stacks.empower = 1;
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
assert.equal(weaponFoe.stacks.lucky + weaponFoe.stacks.empower, 1, 'Flawless Amethyst source int() removes one buff');

const [armor] = buildCombatPieces(
  [{ id: 'leather_armor', key: 'armor', x: 0, y: 0, r: 0, gems: ['flawless_amethyst'] }],
  byId,
);
const armorFoe = createActor('dummy');
prepareGemSockets(armor, {
  player: createActor('player'),
  dummy: armorFoe,
  bus: createCombatBus(),
  itemsById: byId,
  rng: () => 0,
  t: 0,
});
assert.equal(armorFoe._healAmp, -0.6, 'Flawless Amethyst armor applies source GemPower scaling');

console.log('OK Flawless Amethyst source alias and socket regression');
