import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync('tools/game-extract-full/Items/RibSawBlade.gd', 'utf8');
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-ap-perm.js',
  'utf8',
);
const ribPort = port.slice(
  port.indexOf('const ribSawBladePort'),
  port.indexOf('/** Torch.gd', port.indexOf('const ribSawBladePort')),
);

assert.match(source, /extends Weapon/);
assert.match(
  source,
  /func onPrepare\(\):[\s\S]*opponent\(\)\.INVENTORY\.getItems\(\)[\s\S]*item\.canBeEmpowered\(\)/,
);
assert.match(
  source,
  /func onPreDealDamage_early\(damageRes: DamageResult\):[\s\S]*damageRes\.hasHit\(\)[\s\S]*weapon\.purgeDamage\(removeDam\)[\s\S]*addBonusDamage\(bonusDam\)/,
);
assert.match(ribPort, /itemHasType\(item, 'weapon'\)/);
assert.match(ribPort, /Number\(item\.damageMin\) > 0 \|\| itemHasType\(item, 'lifesteal'\)/);
assert.match(ribPort, /getPName\(piece\.params, 'dam', getP1\(piece\.params, 0\)\)/);
assert.match(ribPort, /getPName\(piece\.params, 'bonusdam', getP2\(piece\.params, 0\)\)/);
assert.match(ribPort, /return weaponStrike\(piece, ctx, 'rib_saw_blade'\)/);

function item(id, overrides = {}) {
  const base = byId.get(id);
  assert.ok(base, `catalog item ${id} exists`);
  return {
    ...base,
    ...overrides,
    itemId: id,
    placementKey: overrides.placementKey || id,
    side: overrides.side || 'you',
    alive: true,
  };
}

const blade = item('rib_saw_blade', {
  params: { dam: 1, p1: 1, bonusdam: 0.5, p2: 0.5 },
  kind: 'weapon',
});
const removableWeapon = item('wooden_sword', {
  side: 'dummy',
  kind: 'weapon',
  damageMin: 5,
  damageMax: 7,
  bonusDamage: 4,
  removableBonusDamage: 2,
  _removableBonusDamageInitialized: true,
});
const lifestealWeapon = item('manathirst', {
  side: 'dummy',
  kind: 'weapon',
  bonusDamage: 2,
  removableBonusDamage: 2,
  _removableBonusDamageInitialized: true,
});
const zeroDamageWeapon = item('shell_totem', {
  side: 'dummy',
  kind: 'weapon',
  damageMin: 0,
  damageMax: 0,
  bonusDamage: 3,
  removableBonusDamage: 3,
  _removableBonusDamageInitialized: true,
});
const damagePet = {
  ...item('power_puppy', { side: 'dummy', kind: 'pet' }),
  damageMin: 20,
  damageMax: 20,
  bonusDamage: 3,
  removableBonusDamage: 3,
  _removableBonusDamageInitialized: true,
};
const allyWeapon = item('wooden_sword', {
  placementKey: 'ally-weapon',
  side: 'you',
  kind: 'weapon',
  bonusDamage: 3,
  removableBonusDamage: 3,
  _removableBonusDamageInitialized: true,
});

const ctx = {
  allPieces: [blade, removableWeapon, lifestealWeapon, zeroDamageWeapon, damagePet, allyWeapon],
  itemsById: byId,
  events: [],
  t: 2,
};
const handler = getScriptHandler('rib_saw_blade');
assert.equal(handler?.handlerId, 'rib_saw_blade');

handler.onPrepare(blade, ctx);
assert.deepEqual(
  blade._ribOppWeapons.map((piece) => piece.itemId),
  ['wooden_sword', 'manathirst'],
  'prepare snapshots only opponent canBeEmpowered weapons, including lifesteal weapons',
);

handler.onPreDealDamageEarly(blade, ctx, { hit: false });
assert.equal(removableWeapon.bonusDamage, 4, 'misses do not purge opponent damage');
assert.equal(blade.bonusDamage || 0, 0, 'misses do not grant self damage');

handler.onPreDealDamageEarly(blade, ctx, { hit: true });
assert.equal(removableWeapon.bonusDamage, 3, 'a hit purges one removable damage from a normal weapon');
assert.equal(lifestealWeapon.bonusDamage, 1, 'a hit purges one removable damage from a lifesteal weapon');
assert.equal(zeroDamageWeapon.bonusDamage, 3, 'zero-damage weapons are not canBeEmpowered targets');
assert.equal(damagePet.bonusDamage, 3, 'non-weapons are not canBeEmpowered targets');
assert.equal(allyWeapon.bonusDamage, 3, 'allied weapons are not snapped');
assert.equal(blade.bonusDamage, 0.5, 'a hit adds the named bonusdam amount');
assert.equal(blade.removableBonusDamage, 0.5);

const sparse = item('rib_saw_blade', {
  placementKey: 'sparse-blade',
  params: {},
  kind: 'weapon',
});
const sparseTarget = item('wooden_sword', {
  placementKey: 'sparse-target',
  side: 'dummy',
  kind: 'weapon',
  bonusDamage: 2,
  removableBonusDamage: 2,
  _removableBonusDamageInitialized: true,
});
const sparseCtx = {
  allPieces: [sparse, sparseTarget],
  itemsById: byId,
  events: [],
  t: 4,
};
handler.onPrepare(sparse, sparseCtx);
handler.onPreDealDamageEarly(sparse, sparseCtx, { hit: true });
assert.equal(sparseTarget.bonusDamage, 2, 'omitted dam does not fabricate purge strength');
assert.equal(sparse.bonusDamage || 0, 0, 'omitted bonusdam does not fabricate self damage');

console.log('OK Rib Saw Blade source and handler regression');
