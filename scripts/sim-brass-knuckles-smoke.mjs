import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { createCombatBus } from '../js/pages/sim/engine/combat-bus.js';
import { startBattleRage, tickBattleRage } from '../js/pages/sim/engine/battle-rage.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/BrassKnuckles.gd', 'utf8');
assert.match(source, /func onPrepare\(\)/);
assert.match(source, /connectForCombat\(character\(\), "battle_rage_started"/);
assert.match(source, /addCritChancePercent\(getChance2\(\)\)/);
assert.match(source, /stun\(getP_m\("dur_stun"/);

const handler = getScriptHandler('brass_knuckles');
assert.equal(handler?.handlerId, 'brass_knuckles');
assert.equal(typeof handler?.onPrepare, 'function');

const player = createActor('player');
const dummy = createActor('dummy');
const bus = createCombatBus();
const piece = {
  itemId: 'brass_knuckles',
  name: 'Brass Knuckles',
  placementKey: 'knuckles',
  side: 'you',
  kind: 'weapon',
  params: { dur_stun: 0.3, p2: 5, p4: 50 },
  chance: 50,
  chance2: 5,
  accuracy: 90,
  critChance: 0,
  speedScale: 0,
  alive: true,
};
const allyWeapon = {
  itemId: 'wooden_sword',
  name: 'Wooden Sword',
  placementKey: 'sword',
  side: 'you',
  kind: 'weapon',
  accuracy: 90,
  critChance: 0,
};
const itemsById = new Map([
  ['brass_knuckles', { id: 'brass_knuckles', type: 'Melee Weapon', chance: 50, chance2: 5 }],
  ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon' }],
]);
const graph = {
  pieces: new Map([
    ['knuckles', { id: 'brass_knuckles', cells: ['0,0'], affectCells: [] }],
    ['sword', { id: 'wooden_sword', cells: ['1,0'], affectCells: [] }],
  ]),
  filled: new Map([['0,0', 'knuckles'], ['1,0', 'sword']]),
};
const events = [];
const ctx = {
  player,
  dummy,
  bus,
  events,
  graph,
  itemsById,
  pieces: [piece, allyWeapon],
  canAffect: null,
  rng: () => 0,
  t: 1,
};

handler.onPrepare(piece, ctx);
startBattleRage(player, 2, 1, { bus });
assert.equal(piece.speedScale, 0.5, 'battle rage start applies source speed');
tickBattleRage(player, 3, { bus });
assert.equal(piece.speedScale, 0, 'battle rage end removes source speed');

handler.onDealtDamage(piece, ctx, { hit: true, healthDamage: 3, damage: 3 });
assert.equal(piece.critChance, 5);
assert.equal(piece.bonusAccuracy, 5);
assert.equal(allyWeapon.critChance, 5);
assert.equal(allyWeapon.bonusAccuracy, 5);
assert.equal(dummy.stunnedUntil, 1.3);

console.log('OK Brass Knuckles focused smoke');
