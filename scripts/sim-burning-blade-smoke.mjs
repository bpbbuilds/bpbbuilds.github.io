import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createActor } from '../js/pages/sim/engine/actor.js';
import { grantStacks } from '../js/pages/sim/engine/buff-economy.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/BurningBlade.gd', 'utf8');
const parent = fs.readFileSync('tools/game-extract-full/Items/Exclusive/BurningSword.gd', 'utf8');
assert.match(source, /extends .*BurningSword\.gd/);
assert.match(source, /onPreDealDamage_early/);
assert.match(parent, /func onPrepare\(\)/);
assert.match(parent, /character_heat_changed/);

const handler = getScriptHandler('burning_blade');
assert.equal(handler?.handlerId, 'burning_blade');
assert.equal(typeof handler?.onPrepare, 'function');
assert.equal(typeof handler?.onPreDealDamageEarly, 'function');

const player = createActor('player');
const dummy = createActor('dummy');
const piece = {
  itemId: 'burning_blade',
  name: 'Burning Blade',
  placementKey: 'blade',
  side: 'you',
  kind: 'weapon',
  params: { heat: 1, p1: 1, heatt: 6, p2: 6, bonusdam: 1, p3: 1 },
  chance: 100,
  damageMin: 8,
  damageMax: 8,
  accuracy: 100,
  staminaCost: 1,
  alive: true,
  bonusDamage: 0,
};
const ctx = {
  player,
  dummy,
  pieces: [piece],
  graph: { pieces: new Map([['blade', { id: 'burning_blade', cells: ['0,0'], affectCells: [] }]]), filled: new Map([['0,0', 'blade']]) },
  itemsById: new Map([['burning_blade', { id: 'burning_blade', type: 'Melee Weapon' }]]),
  canAffect: null,
  events: [],
  rng: () => 0,
  t: 2,
};

handler.onPrepare(piece, ctx);
grantStacks(player, 'heat', 6, { originKey: 'heat-source', originId: 'heat-source' });
assert.equal(piece.bonusDamage, 1, 'inherited Burning Sword heat bank applies bonus damage');
handler.onPreDealDamageEarly(piece, ctx, { hit: true });
assert.equal(player.stacks.heat, 7, 'Burning Blade gives inherited heat on a hit');

console.log('OK Burning Blade focused smoke');
