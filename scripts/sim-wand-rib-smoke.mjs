import assert from 'node:assert/strict';

import { simulateEngine } from '../js/pages/sim/engine/simulate.js';
import { buildCombatPieces } from '../js/pages/sim/engine/pieces.js';
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';
import { formatLogLine } from '../js/pages/sim/log/sim-log-sentences.js';
import { buildMetricSources } from '../js/pages/sim/log/sim-meter-metrics.js';

function assertClose(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} !== ${expected}`);
}

const wand = {
  id: 'wand_of_dissonance',
  name: 'Wand of Dissonance',
  displayName: 'Wand of Dissonance',
  type: 'Accessory',
  extraTypes: ['Dark', 'Magic'],
  cooldown: 2.9,
  damageMin: 8,
  damageMax: 8,
  params: { healtht: 7, p1: 7, mana: 4, p2: 4, luck: 3, p3: 3, regen: 3, p4: 3, dam: 5, p5: 5 },
  shape: [[1]],
};
const darkSpell = {
  id: 'dark_spell',
  name: 'Dark Spell',
  displayName: 'Dark Spell',
  type: 'Spell',
  extraTypes: ['Dark'],
  cooldown: 999,
  damageMin: 0,
  damageMax: 0,
  params: {},
  shape: [[1]],
};
const wandItems = new Map([[wand.id, wand], [darkSpell.id, darkSpell]]);
const wandRun = simulateEngine({
  placements: [
    { id: wand.id, key: 'wand', x: 0, y: 0, r: 0 },
    { id: darkSpell.id, key: 'spell', x: 1, y: 0, r: 0 },
  ],
  itemsById: wandItems,
  durationSec: 10,
  seed: 7,
  dummyAttacks: false,
});
const wandFactor = wandRun.events.find(
  (ev) => ev.itemId === wand.id && ev.type === 'stat' && ev.meta?.stat === 'effect_dmg_factor',
);
assert.ok(wandFactor, 'Wand prepare must apply an effect-damage factor');
assertClose(wandFactor.amount, 10, 'Wand Dark Spell factor (5% doubled)');
const healthCost = wandRun.events.find(
  (ev) => ev.itemId === wand.id && ev.meta?.kind === 'self_health_cost',
);
assert.ok(healthCost, 'Wand activation must log its health cost');
assert.equal(healthCost.amount, 7);
const effectDamage = wandRun.events.find(
  (ev) => ev.itemId === wand.id && ev.meta?.effect === true,
);
assert.ok(effectDamage, 'Wand activation must deal effect damage');
assert.equal(effectDamage.amount, 9, '8 base damage scaled by 10%');
assert.equal(effectDamage.meta.parentId, healthCost.meta.eventId);
const buffGrant = wandRun.events.find(
  (ev) => ev.itemId === wand.id && ev.type === 'buff' && ev.meta?.stack,
);
assert.ok(buffGrant, 'Wand activation must grant one of its three buffs');
assert.equal(buffGrant.amount, 3);
assert.equal(buffGrant.meta.parentId, healthCost.meta.eventId);
assert.ok(
  wandRun.events.indexOf(healthCost) < wandRun.events.indexOf(effectDamage) &&
    wandRun.events.indexOf(effectDamage) < wandRun.events.indexOf(buffGrant),
  'Wand causal event order must be health cost → effect damage → buff',
);
assert.match(formatLogLine(healthCost, { itemsById: wandItems }).plain, /Lost 7 health \(Wand of Dissonance\)/);
const damageSources = buildMetricSources(wandRun.events, wandItems, 'damage');
assert.equal(
  damageSources.reduce((sum, source) => sum + source.total, 0),
  18,
  'Wand self-health costs must not count as Damage Dealt',
);
const opponentWandRun = simulateEngine({
  placements: [{ id: darkSpell.id, key: 'spell', x: 0, y: 0, r: 0 }],
  opponentPlacements: [
    { id: wand.id, key: 'wand', x: 0, y: 0, r: 0 },
    { id: darkSpell.id, key: 'spell', x: 1, y: 0, r: 0 },
  ],
  itemsById: wandItems,
  durationSec: 6,
  seed: 11,
  dummyAttacks: false,
});
const opponentWandDamage = opponentWandRun.events.find(
  (ev) => ev.itemId === wand.id && ev.meta?.effect === true,
);
assert.ok(opponentWandDamage, 'Opponent Wand must execute its effect chain');
assert.equal(opponentWandDamage.actor, 'dummy');
assert.equal(opponentWandDamage.target, 'player');
assert.ok(
  opponentWandRun.events.some(
    (ev) => ev.itemId === wand.id && ev.meta?.kind === 'self_health_cost' && ev.actor === 'dummy',
  ),
  'Opponent Wand must pay its own health cost',
);

const rib = {
  id: 'rib_saw_blade',
  name: 'Rib Saw Blade',
  displayName: 'Rib Saw Blade',
  type: 'Melee Weapon',
  cooldown: 1.8,
  damageMin: 8,
  damageMax: 10,
  params: { dam: 1, p1: 1, bonusdam: 0.5, p2: 0.5 },
  shape: [[1]],
};
const enemyWeapon = {
  id: 'enemy_weapon',
  name: 'Enemy Weapon',
  displayName: 'Enemy Weapon',
  type: 'Melee Weapon',
  cooldown: 2,
  damageMin: 10,
  damageMax: 12,
  params: {},
  shape: [[1]],
};
const ribItems = new Map([[rib.id, rib], [enemyWeapon.id, enemyWeapon]]);
const [ribPiece, enemyPiece] = buildCombatPieces([
  { id: rib.id, key: 'rib', x: 0, y: 0, r: 0 },
  { id: enemyWeapon.id, key: 'opp:enemy', x: 0, y: 0, r: 0, side: 'them' },
], ribItems);
const player = createActor('player');
const dummy = createActor('dummy');
const events = [];
player._eventLog = events;
dummy._eventLog = events;
player._simT = 2;
dummy._simT = 2;
ribPiece._owner = player;
enemyPiece._owner = dummy;
ribPiece._eventLog = events;
enemyPiece._eventLog = events;
enemyPiece.damageBonus = 4;
enemyPiece.bonusDamage = 3;
const ribHandler = getScriptHandler(rib.id);
assert.ok(ribHandler?.onPrepare && ribHandler?.onPreDealDamageEarly);
const ribCtx = {
  player,
  dummy,
  allPieces: [ribPiece, enemyPiece],
  events,
  t: 2,
  rng: () => 0.25,
};
ribHandler.onPrepare(ribPiece, ribCtx);
assert.deepEqual(ribPiece._ribOppWeapons.map((piece) => piece.itemId), [enemyPiece.itemId]);
ribHandler.onPreDealDamageEarly(ribPiece, ribCtx, { hit: true });
assert.equal(enemyPiece.bonusDamage, 2, 'Rib Saw Blade removes one removable damage');
assert.equal(enemyPiece.damageBonus, 4, 'Rib Saw Blade must preserve permanent/gem damage');
assert.equal(enemyPiece.damageMin, 8, 'Rib Saw Blade must preserve base damage');
assertClose(ribPiece.bonusDamage, 0.5, 'Rib Saw Blade adds its hit bonus');
assert.ok(events.some((ev) => ev.meta?.kind === 'damage_buff_purge'));
const reverseRib = { ...ribPiece, placementKey: 'opp:rib', side: 'them', _ribOppWeapons: [] };
const reverseWeapon = { ...enemyPiece, placementKey: 'player:weapon', side: 'you' };
ribHandler.onPrepare(reverseRib, { allPieces: [reverseRib, reverseWeapon] });
assert.deepEqual(reverseRib._ribOppWeapons.map((piece) => piece.itemId), [reverseWeapon.itemId]);

// Katana extends RibSawBlade.gd and must inherit its prepare-time target set.
const katana = {
  id: 'katana',
  name: 'Katana',
  displayName: 'Katana',
  type: 'Melee Weapon',
  cooldown: 1.8,
  damageMin: 7,
  damageMax: 9,
  params: { dam: 1, p1: 1, bonusdam: 1, p2: 1, buffst: 5, buffs: 2 },
  shape: [[1]],
};
const katanaItems = new Map([[katana.id, katana], [enemyWeapon.id, enemyWeapon]]);
const [katanaPiece, katanaEnemy] = buildCombatPieces([
  { id: katana.id, key: 'katana', x: 0, y: 0, r: 0 },
  { id: enemyWeapon.id, key: 'opp:katana-enemy', x: 0, y: 0, r: 0, side: 'them' },
], katanaItems);
const katanaHandler = getScriptHandler(katana.id);
assert.ok(katanaHandler?.onPrepare, 'Katana must inherit Rib Saw prepare behavior');
katanaHandler.onPrepare(katanaPiece, { allPieces: [katanaPiece, katanaEnemy] });
assert.deepEqual(katanaPiece._ribOppWeapons.map((piece) => piece.itemId), [katanaEnemy.itemId]);

console.log('OK wand/rib focused smoke');
