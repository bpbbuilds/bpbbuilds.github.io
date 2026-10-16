import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getScriptHandler } from '../js/pages/sim/engine/scripts/registry.js';

const raw = JSON.parse(fs.readFileSync('scripts/_cache/game-items.json', 'utf8'));
const catalog = Array.isArray(raw) ? raw : raw.items;
const byId = new Map(catalog.map((item) => [item.id, structuredClone(item)]));
const source = fs.readFileSync(
  'tools/game-extract-full/Items/Exclusive/RelicCase.gd',
  'utf8',
);
const port = fs.readFileSync(
  'js/pages/sim/engine/scripts/ports-ai-f.js',
  'utf8',
);
const relicPort = port.slice(
  port.indexOf('export const relicCasePort'),
  port.indexOf('/** @type {Record<string, ScriptHandler>} */', port.indexOf('export const relicCasePort')),
);

assert.match(source, /extends Bag/);
assert.match(source, /func canApplyEffect\(toItem\):[\s\S]*return toItem\.isWeapon\(\)/);
assert.match(
  source,
  /func doCooldownEffect\(\):[\s\S]*getAffectedItemsInside\(\)[\s\S]*addBonusDamageFactor\(damBonusFactor\)[\s\S]*changeStaminaFactor\( - staminaReduction\)[\s\S]*activate\(\)/,
);
assert.match(relicPort, /itemHasType\(ctx\.itemsById\.get\(other\.itemId\), 'weapon'\)/);
assert.match(relicPort, /getPName\(piece\.params, 'bonusdam', getP1\(piece\.params, 0\)\)/);
assert.match(relicPort, /-getPName\(piece\.params, 'stamina', getP2\(piece\.params, 0\)\) \/ 100/);
assert(
  relicPort.indexOf("pushActivate(piece, ctx, 'relic_case'") >
    relicPort.indexOf('for (const key of inside)'),
  'Relic Case activation follows inside-item effects',
);

function item(id, overrides = {}) {
  const base = byId.get(id);
  assert.ok(base, `catalog item ${id} exists`);
  return {
    ...base,
    ...overrides,
    itemId: id,
    placementKey: overrides.placementKey || id,
    cells: overrides.cells || [id],
    alive: true,
  };
}

function graphFor(bag, ...cargo) {
  return {
    pieces: new Map([
      [bag.placementKey, { key: bag.placementKey, id: bag.itemId, cells: bag.cells, affectCells: [] }],
      ...cargo.map((piece) => [
        piece.placementKey,
        { key: piece.placementKey, id: piece.itemId, cells: piece.cells, affectCells: [] },
      ]),
    ]),
    filled: new Map(cargo.flatMap((piece) => piece.cells.map((cell) => [cell, piece.placementKey]))),
  };
}

const bag = item('relic_case', {
  placementKey: 'case',
  cells: ['weapon-cell', 'pet-cell'],
  params: { bonusdam: 5, p1: 5, stamina: 5, p2: 5 },
});
const weapon = item('wooden_sword', {
  placementKey: 'weapon',
  cells: ['weapon-cell'],
  kind: 'weapon',
  damageMin: 5,
  damageMax: 10,
  staminaCost: 10,
  baseStaminaCost: 10,
  staminaFactor: 1,
  bonusDamageFactor: 1,
  empowerable: true,
});
const damageBearingPet = {
  id: 'probe_pet',
  name: 'Probe Pet',
  type: 'Pet',
  damageMin: 99,
  damageMax: 99,
  itemId: 'probe_pet',
  placementKey: 'pet',
  cells: ['pet-cell'],
  kind: 'pet',
  staminaCost: 10,
  baseStaminaCost: 10,
  staminaFactor: 1,
  bonusDamageFactor: 1,
  empowerable: true,
  alive: true,
};
byId.set('probe_pet', damageBearingPet);

const events = [];
const ctx = {
  pieces: [bag, weapon, damageBearingPet],
  graph: graphFor(bag, weapon, damageBearingPet),
  itemsById: byId,
  events,
  t: 8,
};
const handler = getScriptHandler('relic_case');
assert.equal(handler?.handlerId, 'relic_case');

handler.onCooldownEffect(bag, ctx);
assert.equal(weapon.bonusDamageFactor, 1.05, 'source bonusdam applies as a damage factor to weapons');
assert.equal(weapon.staminaFactor, 0.95, 'source stamina reduction applies as a signed fraction');
assert.equal(weapon.staminaCost, 9.5, 'stamina cost refreshes from the reduced factor');
assert.equal(damageBearingPet.bonusDamageFactor, 1, 'damage-bearing non-weapons are excluded by isWeapon');
assert.equal(damageBearingPet.staminaFactor, 1, 'damage-bearing non-weapons keep their stamina factor');
assert.equal(events.at(-1)?.type, 'activate', 'Relic Case activates after inside-item effects');
assert.equal(events.at(-1)?.itemId, 'relic_case');

const sparseBag = item('relic_case', {
  placementKey: 'sparse-case',
  cells: ['sparse-weapon-cell'],
  params: {},
});
const sparseWeapon = item('wooden_sword', {
  placementKey: 'sparse-weapon',
  cells: ['sparse-weapon-cell'],
  kind: 'weapon',
  damageMin: 5,
  damageMax: 10,
  staminaCost: 10,
  baseStaminaCost: 10,
  staminaFactor: 1,
  bonusDamageFactor: 1,
});
const sparseEvents = [];
handler.onCooldownEffect(sparseBag, {
  ...ctx,
  pieces: [sparseBag, sparseWeapon],
  graph: graphFor(sparseBag, sparseWeapon),
  events: sparseEvents,
});
assert.equal(sparseWeapon.bonusDamageFactor, 1, 'missing bonusdam does not fabricate a damage bonus');
assert.equal(sparseWeapon.staminaFactor, 1, 'missing stamina does not fabricate a stamina change');
assert.equal(sparseEvents.at(-1)?.type, 'activate');

console.log('OK Relic Case source and handler regression');
