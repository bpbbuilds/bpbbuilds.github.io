import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const row = inventory.byId.crossblades;
assert.ok(row);
assert.equal(row.file, 'Crossblades.gd');
assert.equal(row.extends, 'Weapon');
assert.deepEqual(row.overrides, ['onCombatStart', 'onPreDealDamage_early']);
const source = fs.readFileSync('tools/game-extract-full/Items/Crossblades.gd', 'utf8');
assert.match(source, /func canAffect\(item\):[\s\S]*canBeEmpowered/);
assert.match(source, /func canAffect_secondary\(item\):[\s\S]*hasCooldown/);
assert.match(source, /getAffectedItems\(Affected\.Primary\)[\s\S]*addBonusDamage\(getP1\(\)/);
assert.match(source, /getAffectedItems\(Affected\.Secondary\)[\s\S]*addSpeed\(getP2\(\) \/ 100\.0\)/);
assert.match(source, /func onPreDealDamage_early[\s\S]*damageRes\.hasHit\(\)/);
assert.equal(getScriptHandler('crossblades')?.handlerId, 'crossblades');

const cross = {
  itemId: 'crossblades',
  placementKey: 'cross',
  name: 'Crossblades',
  kind: 'weapon',
  side: 'you',
  alive: true,
  params: { p1: 10, p2: 65, p3: 1, p4: 4 },
};
const primary = {
  itemId: 'wooden_sword',
  placementKey: 'primary',
  kind: 'weapon',
  alive: true,
  empowerable: true,
  bonusDamage: 0,
  speedScale: 0,
  cooldown: 1,
};
const secondary = {
  itemId: 'wooden_sword',
  placementKey: 'secondary',
  kind: 'weapon',
  alive: true,
  empowerable: false,
  bonusDamage: 0,
  speedScale: 0,
  cooldown: 2,
};
const ignored = {
  itemId: 'wooden_sword',
  placementKey: 'ignored',
  kind: 'weapon',
  alive: true,
  empowerable: false,
  bonusDamage: 0,
  speedScale: 0,
  cooldown: 0,
};
const ctx = {
  player: createActor('player'),
  dummy: createActor('dummy'),
  t: 3,
  events: [],
  pieces: [cross, primary, secondary, ignored],
  itemsById: new Map([
    ['crossblades', { id: 'crossblades', params: cross.params }],
    ['wooden_sword', { id: 'wooden_sword', type: 'Melee Weapon' }],
  ]),
  graph: {
    pieces: new Map([
      ['cross', { key: 'cross', id: 'crossblades', affectCells: [] }],
      ['primary', { key: 'primary', id: 'wooden_sword', affectCells: [] }],
      ['secondary', { key: 'secondary', id: 'wooden_sword', affectCells: [] }],
      ['ignored', { key: 'ignored', id: 'wooden_sword', affectCells: [] }],
    ]),
    filled: new Map(),
  },
  canAffect: null,
  rng: () => 0,
};
ctx.graph.pieces.get('cross').affectCells = [
  { cell: '1,0', color: 'primary' },
  { cell: '2,0', color: 'secondary' },
  { cell: '3,0', color: 'primary' },
];
ctx.graph.filled.set('1,0', 'primary');
ctx.graph.filled.set('2,0', 'secondary');
ctx.graph.filled.set('3,0', 'ignored');

const handler = getScriptHandler('crossblades');
handler.onCombatStart(cross, ctx);
assert.equal(primary.bonusDamage, 10);
assert.equal(secondary.speedScale, 0.65);
assert.equal(ignored.bonusDamage, 0);
assert.ok(ctx.events.some((event) => event.type === 'activate'));

handler.onPreDealDamageEarly(cross, ctx, { hit: false });
assert.equal(cross.bonusDamage || 0, 0);
handler.onPreDealDamageEarly(cross, ctx, { hit: true });
assert.equal(cross.bonusDamage, 1);
assert.equal(cross.speedScale, 0.04);

console.log('OK Crossblades source port');
