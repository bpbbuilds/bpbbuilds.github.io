import assert from 'node:assert/strict';

globalThis.Element = class {};
globalThis.HTMLElement = globalThis.Element;
globalThis.document = { body: { dataset: {} } };
const [{ parkedFromPlacement }, { normalizeDraft }, { commitTryAdd }, { ringEffectsFromPersistent }] = await Promise.all([
  import('../js/pages/create/park-strip.js'),
  import('../js/pages/create/draft-io.js'),
  import('../js/pages/create/drag-commit.js'),
  import('../js/shared/ring-config.js'),
]);

const effects = [
  { trigger: 0, stack: 'blind' },
  { trigger: 2, stack: 'mana' },
];
const configured = {
  id: 'magic_ring', x: 1, y: 1, r: 0, key: 'ring-parked',
  instance: { persistent: { magicRing: 548, effects } },
};
const parked = parkedFromPlacement(configured);
const restoredDraft = normalizeDraft({ parked: [parked] });
assert.deepEqual(
  ringEffectsFromPersistent(restoredDraft?.parked[0]?.instance?.persistent, 'magic_ring'),
  effects,
  'Parked entries must retain configured ring effects after draft restore',
);

let placements = [{ id: 'leather_bag', x: 0, y: 0, r: 0, key: 'bag-1' }];
const state = {
  getDraft: () => ({ placements }),
  setPlacements: (next) => { placements = next; },
  appendParked() {},
};
const result = commitTryAdd({
  cur: { mode: 'place', itemId: 'magic_ring', r: 0, placeKey: parked.key, instance: parked.instance },
  tryAdd: { origin: { x: 2, y: 2 }, collisions: [] },
  clientX: 0,
  clientY: 0,
  state,
  itemsById: new Map([
    ['magic_ring', { id: 'magic_ring', shape: [[1]] }],
    ['leather_bag', { id: 'leather_bag', type: 'Bag', shape: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] }],
  ]),
  editMode: 'default',
  multiMoveKeys: null,
  endDragHard() {},
  beginHotswapFromPlacement() {},
});
assert.equal(result, 'done', 'parked ring can return to an empty board');
assert.deepEqual(
  ringEffectsFromPersistent(placements.find((p) => p.id === 'magic_ring')?.instance?.persistent, 'magic_ring'),
  effects,
  'Returning a configured ring from Parked must restore its effects',
);

console.log('ring parked roundtrip smoke: ok');
