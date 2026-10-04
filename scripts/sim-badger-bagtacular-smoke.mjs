import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { takeDamage } from '../js/pages/sim/engine/damage.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { prepareGemSockets } from '../js/pages/sim/engine/gem-sockets.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { simulateEngine } from '../js/pages/sim/engine/simulate.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(
  [
    'badger_rune',
    'bagtacular',
    'fanny_pack',
    'stamina_sack',
    'potion_belt',
    'protective_purse',
    'wooden_sword',
  ]
    .map((id) => [id, catalog.find((item) => item.id === id)])
    .filter(([, item]) => item),
);

const badgerSource = inventory.byId.badger_rune;
assert.equal(badgerSource.file, 'Exclusive/BadgerRune.gd');
assert.equal(badgerSource.extends, 'Gem');
assert.deepEqual(
  badgerSource.sourceMethods,
  [
    'prepareWeapon',
    'prepareArmor',
    'hasCooldown',
    'prepareInventory',
    'onHotSwapHoverWithGemEnd',
  ],
);
const bagtacularSource = inventory.byId.bagtacular;
assert.equal(bagtacularSource.file, 'Exclusive/Bagtacular.gd');
assert.equal(bagtacularSource.extends, 'Item');
assert.deepEqual(bagtacularSource.sourceMethods, ['canAffect_global']);

const badger = getScriptHandler('badger_rune');
const bagtacular = getScriptHandler('bagtacular');
assert.equal(badger?.presenceOnly, true);
assert.equal(bagtacular?.presenceOnly, true);
assert.equal(typeof badger?.onPrepare, 'function');
assert.equal(bagtacular?.onCombatStart, undefined, 'Bagtacular must not invent an activation');

// Loose Badger Rune runs during Item.prepare, before costs are used.
const loosePieces = buildCombatPieces(
  [
    { id: 'badger_rune', key: 'rune', x: 0, y: 0, r: 0 },
    { id: 'wooden_sword', key: 'sword', x: 2, y: 0, r: 0 },
  ],
  byId,
);
assert.deepEqual(loosePieces.map((piece) => piece.itemId), ['badger_rune', 'wooden_sword']);
const looseCtx = { pieces: loosePieces };
badger.onPrepare(loosePieces[0], looseCtx);
assert.equal(loosePieces[1].staminaCost, 0.9, 'Badger Rune reduces inventory stamina by 10%');

// Socketed weapon Badger Rune adds 3% speed only after a successful attack.
const [weapon] = buildCombatPieces(
  [{ id: 'wooden_sword', key: 'weapon', x: 0, y: 0, r: 0, gems: ['badger_rune'] }],
  byId,
);
const weaponBus = createCombatBus();
prepareGemSockets(weapon, {
  player: createActor('player'),
  dummy: createActor('dummy'),
  bus: weaponBus,
  t: 0,
  itemsById: byId,
});
weaponBus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: false } });
assert.equal(weapon.speedScale, 0, 'A missed attack must not proc Badger Rune speed');
weaponBus.emit('piece_dealt_damage', { piece: weapon, hit: { hit: true, damage: 4 } });
assert.equal(weapon.speedScale, 0.03, 'A hit must add Badger Rune speed');
const [opponentWeapon] = buildCombatPieces(
  [{ id: 'wooden_sword', key: 'opp:weapon', x: 0, y: 0, r: 0, side: 'them', gems: ['badger_rune'] }],
  byId,
);
const opponentWeaponBus = createCombatBus();
prepareGemSockets(opponentWeapon, {
  player: createActor('dummy'),
  dummy: createActor('player'),
  bus: opponentWeaponBus,
  t: 0,
  itemsById: byId,
});
opponentWeaponBus.emit('piece_dealt_damage', {
  piece: opponentWeapon,
  hit: { hit: true, damage: 4 },
});
assert.equal(opponentWeapon.speedScale, 0.03, 'Opponent Badger Rune weapon must proc on its hit');

// Socketed armor Badger Rune applies flat DR at pre_take_damage while raging.
const armor = {
  id: 'leather_armor',
  name: 'Leather Armor',
  displayName: 'Leather Armor',
  type: 'Armor',
  block: 0,
  params: {},
  shape: [[1]],
};
byId.set(armor.id, armor);
const [armorPiece] = buildCombatPieces(
  [{ id: armor.id, key: 'armor', x: 0, y: 0, r: 0, gems: ['badger_rune'] }],
  byId,
);
const defender = createActor('player');
defender.battleRage = true;
const attacker = createActor('dummy');
const armorBus = createCombatBus();
prepareGemSockets(armorPiece, {
  player: defender,
  dummy: attacker,
  bus: armorBus,
  t: 0,
  itemsById: byId,
});
const reduced = takeDamage(defender, attacker, {
  amount: 20,
  canMiss: false,
  canCrit: false,
  isAttack: true,
  isMelee: true,
  nowT: 1,
  bus: armorBus,
  rng: () => 0.5,
});
assert.equal(reduced.damage, 13);
assert.equal(reduced.reduced, 7);
assert.deepEqual(reduced.reductionSources, [{ itemId: 'badger_rune', placementKey: 'armor', amount: 7 }]);

// Repeat the armor path with the opponent-side actor to prove side symmetry.
const opponentDefender = createActor('dummy');
opponentDefender.battleRage = true;
const opponentAttacker = createActor('player');
const opponentBus = createCombatBus();
prepareGemSockets(armorPiece, {
  player: opponentDefender,
  dummy: opponentAttacker,
  bus: opponentBus,
  t: 0,
  itemsById: byId,
});
const opponentReduced = takeDamage(opponentDefender, opponentAttacker, {
  amount: 20,
  canMiss: false,
  canCrit: false,
  isAttack: true,
  isMelee: true,
  nowT: 1,
  bus: opponentBus,
  rng: () => 0.5,
});
assert.equal(opponentReduced.damage, 13, 'Opponent Badger Rune must reduce the same hit');

// Bagtacular is global inventory state: its four affected bags consume its
// named params, and it does not produce a standalone combat activation.
const noBagtacular = simulateEngine({
  placements: [{ id: 'protective_purse', key: 'purse', x: 0, y: 0, r: 0 }],
  itemsById: byId,
  durationSec: 3,
  dummyAttacks: false,
});
const withBagtacular = simulateEngine({
  placements: [
    { id: 'bagtacular', key: 'bagtacular', x: 4, y: 4, r: 0 },
    { id: 'protective_purse', key: 'purse', x: 0, y: 0, r: 0 },
  ],
  itemsById: byId,
  durationSec: 3,
  dummyAttacks: false,
});
assert.equal(noBagtacular.snapshots.find((snap) => snap.t === 2.5).player.block, 15);
assert.equal(withBagtacular.snapshots.find((snap) => snap.t === 2.5).player.block, 22);
assert.equal(
  withBagtacular.events.some((event) => event.itemId === 'bagtacular' && event.type === 'activate'),
  false,
  'Bagtacular presence must not log a fabricated activation',
);

const fannyWithout = simulateEngine({
  placements: [
    { id: 'fanny_pack', key: 'fanny', x: 0, y: 0, r: 0 },
    { id: 'wooden_sword', key: 'sword', x: 0, y: 0, r: 0 },
  ],
  itemsById: byId,
  durationSec: 3,
  dummyAttacks: false,
});
const fannyWith = simulateEngine({
  placements: [
    { id: 'bagtacular', key: 'bagtacular', x: 4, y: 4, r: 0 },
    { id: 'fanny_pack', key: 'fanny', x: 0, y: 0, r: 0 },
    { id: 'wooden_sword', key: 'sword', x: 0, y: 0, r: 0 },
  ],
  itemsById: byId,
  durationSec: 3,
  dummyAttacks: false,
});
assert.equal(fannyWithout.pieceSnapshots.find((snap) => snap.t === 2.5).byKey.sword.speedScale, 0.1);
assert.equal(fannyWith.pieceSnapshots.find((snap) => snap.t === 2.5).byKey.sword.speedScale, 0.17);

const staminaWithout = simulateEngine({
  placements: [{ id: 'stamina_sack', key: 'sack', x: 0, y: 0, r: 0 }],
  itemsById: byId,
  durationSec: 3,
  dummyAttacks: false,
});
const staminaWith = simulateEngine({
  placements: [
    { id: 'bagtacular', key: 'bagtacular', x: 4, y: 4, r: 0 },
    { id: 'stamina_sack', key: 'sack', x: 0, y: 0, r: 0 },
  ],
  itemsById: byId,
  durationSec: 3,
  dummyAttacks: false,
});
assert.equal(staminaWithout.snapshots.find((snap) => snap.t === 2.5).player.combatStats.stamina_regen, 0);
assert.equal(staminaWith.snapshots.find((snap) => snap.t === 2.5).player.combatStats.stamina_regen, 7);

const potionPieces = buildCombatPieces(
  [
    { id: 'bagtacular', key: 'bagtacular', x: 4, y: 4, r: 0 },
    { id: 'potion_belt', key: 'belt', x: 0, y: 0, r: 0 },
  ],
  byId,
);
const potionPlayer = createActor('player');
const potionBus = createCombatBus();
const potionHandler = getScriptHandler('potion_belt');
assert.equal(typeof potionHandler?.onPrepare, 'function');
potionHandler.onPrepare(potionPieces.find((piece) => piece.itemId === 'potion_belt'), {
  player: potionPlayer,
  pieces: potionPieces,
  itemsById: byId,
  bus: potionBus,
  rng: () => 0,
});
potionBus.emit('potion_emptied', { piece: { itemId: 'health_potion' }, t: 0 });
assert.equal(
  Object.values(potionPlayer.stacks).reduce((sum, amount) => sum + amount, 0),
  3,
  'Bagtacular adds its named two buffs to Potion Belt first-consume buff',
);

const opponentBagtacular = simulateEngine({
  placements: [],
  opponentPlacements: [
    { id: 'bagtacular', key: 'bagtacular', x: 4, y: 4, r: 0 },
    { id: 'protective_purse', key: 'purse', x: 0, y: 0, r: 0 },
  ],
  itemsById: byId,
  durationSec: 3,
  dummyAttacks: false,
});
assert.equal(
  opponentBagtacular.snapshots.find((snap) => snap.t === 2.5).dummy.block,
  22,
  'Opponent Bagtacular must modify the opponent bag path',
);

console.log('OK Badger Rune / Bagtacular focused smoke');
