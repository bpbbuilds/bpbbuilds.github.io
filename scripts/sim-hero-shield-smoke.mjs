import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/Exclusive/HeroShield.gd', 'utf8');
const parent = fs.readFileSync('tools/game-extract-full/Items/WoodenBuckler.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /extends "res:\/\/Items\/WoodenBuckler\.gd"/);
assert.match(source, /func canAffect\(item\):[\s\S]*return item\.canBeEmpowered\(\)/);
assert.match(source, /onready var flatDam: = getP\("dam"\)[\s\S]*onready var damFactor: = getP\("damfactor"\) \/ 100\.0/);
assert.match(source, /func onCombatStart\(\):[\s\S]*item\.addBonusDamage\(flatDam\)[\s\S]*item\.addBonusDamageFactor\(damFactor\)[\s\S]*activate\(\)/);
assert.match(parent, /func afterBlock\(\):[\s\S]*drainStamina\(getP2\(\), blockedDamageRes\.event\)[\s\S]*activate\(\)/);
assert.equal(inventory.byId.hero_shield?.file, 'Exclusive/HeroShield.gd');
assert.equal(getScriptHandler('hero_shield')?.handlerId, 'hero_shield');

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item.displayName || item.name || id,
    params: item.params || {},
    side: 'you',
    kind: id === 'hero_shield' ? 'shield' : 'weapon',
    damageMin: item.damageMin ?? 0,
    damageMax: item.damageMax ?? 0,
    alive: true,
    ...overrides,
  };
}

function context(player, pieces, sourceKey = 'you:hero-shield') {
  return {
    player,
    dummy: createActor('dummy', { maxHp: 200 }),
    events: [],
    t: 2.5,
    pieces,
    graph: {
      pieces: new Map([
        [sourceKey, { id: 'hero_shield', affectCells: [{ cell: 'sword-star', color: 'primary' }], cells: [] }],
        ['you:weapon', { id: 'wooden_sword', affectCells: [], cells: ['sword-star'] }],
      ]),
      filled: new Map([['sword-star', 'you:weapon']]),
    },
    itemsById: byId,
    canAffect: null,
  };
}

const handler = getScriptHandler('hero_shield');
const player = createActor('player', { maxHp: 200 });
const shield = piece('hero_shield', 'you:hero-shield');
const weapon = piece('wooden_sword', 'you:weapon');
const ctx = context(player, [shield, weapon]);
handler.onCombatStart(shield, ctx);
assert.equal(weapon.bonusDamage, 2, 'Hero Shield grants source flat damage to an empowerable weapon');
assert.equal(weapon.bonusDamageFactor, 1.15, 'Hero Shield grants source damage factor to an empowerable weapon');
assert.equal(player._shields?.length, 1, 'Hero Shield inherits Wooden Buckler combat blocking');
assert.equal(player._shields[0].chance, 30, 'Hero Shield uses its source chance');
assert.equal(player._shields[0].damblock, 15, 'Hero Shield uses its source damblock parameter');
assert.equal(ctx.events.at(-1)?.itemId, 'hero_shield', 'Hero Shield activates after aura and shield setup');
const staminaBefore = player.stamina;
player._shields[0].afterBlock({ t: 3 });
assert.equal(player.stamina, staminaBefore - 0.4, 'Hero Shield inherits Wooden Buckler stamina drain');
assert.equal(ctx.events.at(-1)?.itemId, 'hero_shield', 'Hero Shield activates after inherited afterBlock');

const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroShield = piece('hero_shield', 'you:zero-shield', {
  params: { damblock: 0, p1: 0, stamina: 0, p2: 0, dam: 0, p3: 0, damfactor: 0, p4: 0 },
});
const zeroWeapon = piece('wooden_sword', 'you:weapon');
const zeroCtx = context(zeroPlayer, [zeroShield, zeroWeapon], 'you:zero-shield');
zeroCtx.graph.pieces.set('you:weapon', { id: 'wooden_sword', affectCells: [], cells: ['sword-star'] });
handler.onCombatStart(zeroShield, zeroCtx);
assert.equal(zeroWeapon.bonusDamage || 0, 0, 'Hero Shield honors an explicit zero flat damage bonus');
assert.equal(zeroWeapon.bonusDamageFactor || 1, 1, 'Hero Shield honors an explicit zero damage factor');
assert.equal(zeroCtx.player._shields[0].damblock, 0, 'Hero Shield honors an explicit zero damblock');
const zeroStamina = zeroPlayer.stamina;
zeroCtx.player._shields[0].afterBlock({ t: 3 });
assert.equal(zeroPlayer.stamina, zeroStamina, 'Hero Shield honors an explicit zero stamina drain');

console.log('OK Hero Shield source-backed empowerable aura, inherited block/drain behavior, activation ordering, and zero parameters');
