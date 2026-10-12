import assert from 'node:assert/strict';

const { applyDefaultBag, createDefaultBagPlacements, DEFAULT_BAG_LAYOUT } = await import(
  '../js/pages/create/default-bag.js'
);

const items = new Map([
  ['leather_bag', { id: 'leather_bag', type: 'Bag', shape: [[1, 1], [1, 1]] }],
  ['stamina_sack', { id: 'stamina_sack', type: 'Bag', shape: [[1], [1], [1]] }],
]);

const placements = createDefaultBagPlacements(items, (index) => `default-${index}`);
assert.equal(placements.length, DEFAULT_BAG_LAYOUT.length);
assert.equal(placements.filter((p) => p.id === 'leather_bag').length, 12);
assert.equal(placements.filter((p) => p.id === 'stamina_sack').length, 5);
assert.deepEqual(
  placements.map(({ id, x, y, r }) => ({ id, x, y, r })),
  DEFAULT_BAG_LAYOUT,
);
assert.equal(new Set(placements.map((p) => p.key)).size, placements.length);

const fakeState = {
  draft: { placements: [{ id: 'wooden_sword', x: 1, y: 1, r: 0, key: 'old' }] },
  parked: [],
  getDraft() { return this.draft; },
  getParked() { return this.parked; },
  appendParked(entries) { this.parked.push(...entries); },
  setPlacements(next) { this.draft = { ...this.draft, placements: next }; },
};
const applied = await applyDefaultBag({
  state: fakeState,
  itemsById: items,
  confirm: async () => false,
});
assert.equal(applied, false);
assert.equal(fakeState.draft.placements[0].id, 'wooden_sword');
assert.equal(fakeState.parked.length, 0);

const replaced = await applyDefaultBag({
  state: fakeState,
  itemsById: items,
  confirm: async () => true,
  keyFactory: (index) => `new-${index}`,
  parkedFromPlacement: (placement) => ({ id: placement.id, key: placement.key, r: placement.r }),
  canFitParkEntries: () => true,
});
assert.equal(replaced, true);
assert.equal(fakeState.parked.length, 1);
assert.equal(fakeState.parked[0].id, 'wooden_sword');
assert.equal(fakeState.draft.placements.length, DEFAULT_BAG_LAYOUT.length);
assert.equal(fakeState.draft.placements[0].key, 'new-0');

console.log('create default bag smoke: ok');
