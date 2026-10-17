import assert from 'node:assert/strict';
import fs from 'node:fs';

import inventory from '../assets/data/sim-item-inventory.json' with { type: 'json' };
import { createActor } from '../js/pages/sim/engine/actor.js';
import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const source = fs.readFileSync('tools/game-extract-full/Items/HeroLongsword.gd', 'utf8');
const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, { ...item, shape: item.shape || [[1]] }]));

assert.match(source, /func canAffect\(item\):[\s\S]*return item\.canBeEmpowered\(\)/);
assert.match(source, /func onCombatStart\(\):[\s\S]*item\.addBonusDamage\(getP1\(\)\)[\s\S]*activate\(null, false\)/);
assert.equal(inventory.byId.hero_longsword?.file, 'HeroLongsword.gd');
assert.equal(getScriptHandler('hero_longsword')?.handlerId, 'hero_longsword');

function piece(id, key, overrides = {}) {
  const item = byId.get(id);
  return {
    ...item,
    itemId: id,
    placementKey: key,
    name: item.displayName || item.name || id,
    params: item.params || {},
    side: 'you',
    kind: id === 'hero_longsword' ? 'weapon' : item.type?.includes('Weapon') ? 'weapon' : 'pet',
    damageMin: item.damageMin ?? 0,
    damageMax: item.damageMax ?? 0,
    alive: true,
    ...overrides,
  };
}

function context(player, pieces, sourceKey = 'you:hero-longsword') {
  return {
    player,
    dummy: createActor('dummy', { maxHp: 200 }),
    events: [],
    t: 2.5,
    pieces,
    graph: {
      pieces: new Map([
        [sourceKey, { id: 'hero_longsword', affectCells: [{ cell: 'sword-star', color: 'primary' }, { cell: 'pet-star', color: 'primary' }], cells: [] }],
        ['you:weapon', { id: 'wooden_sword', affectCells: [], cells: ['sword-star'] }],
        ['you:pet', { id: 'hedgehog', affectCells: [], cells: ['pet-star'] }],
      ]),
      filled: new Map([
        ['sword-star', 'you:weapon'],
        ['pet-star', 'you:pet'],
      ]),
    },
    itemsById: byId,
    canAffect: null,
  };
}

const handler = getScriptHandler('hero_longsword');
const player = createActor('player', { maxHp: 200 });
const hero = piece('hero_longsword', 'you:hero-longsword');
const weapon = piece('wooden_sword', 'you:weapon');
const pet = piece('hedgehog', 'you:pet');
const ctx = context(player, [hero, weapon, pet]);
handler.onCombatStart(hero, ctx);
assert.equal(weapon.bonusDamage, 3, 'Hero Longsword grants source flat damage to an empowerable weapon');
assert.equal(pet.bonusDamage || 0, 0, 'Hero Longsword does not empower a non-weapon pet');
assert.equal(ctx.events.at(-1)?.itemId, 'hero_longsword', 'Hero Longsword activates after its aura grants');

const zeroPlayer = createActor('player', { maxHp: 200 });
const zeroHero = piece('hero_longsword', 'you:zero-hero', { params: { dam: 0, p1: 0 } });
const zeroWeapon = piece('wooden_sword', 'you:zero-weapon');
const zeroCtx = context(zeroPlayer, [zeroHero, zeroWeapon]);
zeroCtx.graph.pieces.delete('you:pet');
zeroCtx.graph.filled.delete('pet-star');
handler.onCombatStart(zeroHero, zeroCtx);
assert.equal(zeroWeapon.bonusDamage || 0, 0, 'Hero Longsword honors an explicit zero damage bonus');

console.log('OK Hero Longsword source-backed empowerable-weapon filter, flat damage aura, activation ordering, and zero parameter');
