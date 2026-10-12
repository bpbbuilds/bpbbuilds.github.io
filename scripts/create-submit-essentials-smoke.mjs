import assert from 'node:assert/strict';

// The validator's shared item-art module warms its catalog at import time;
// provide the smallest document surface needed for that browser-only warmup.
globalThis.Element = class {};
globalThis.HTMLElement = globalThis.Element;
globalThis.document = {
  body: { dataset: {} },
  querySelectorAll: () => [],
};
const { validateCreateDraft } = await import('../js/pages/create/submit-validate.js');

const base = {
  title: 'Essentials smoke',
  hero_class: 'Adventurer',
  build_tag: 'feasible',
  rank: 'bronze',
  starting_bag_id: 'bag_of_giving',
  route_r3_item_id: 'wooden_sword',
  route_r10_item_id: 'wooden_sword',
  placements: [
    { id: 'leather_bag', priority: 'needed' },
    { id: 'wooden_sword', priority: 'nice' },
    { id: 'banana', priority: 'optional' },
  ],
};

const complete = validateCreateDraft(base);
assert.equal(complete.ok, true);
assert.equal(complete.errors.some((e) => e.code === 'essentials'), false);

const missing = validateCreateDraft({
  ...base,
  placements: base.placements.slice(0, 2),
});
assert.equal(missing.ok, false);
assert.equal(missing.errors.some((e) => e.code === 'essentials'), true);

const op = validateCreateDraft({
  ...base,
  is_op: true,
  notes: 'A'.repeat(30),
});
assert.equal(op.ok, true);
assert.equal(op.errors.some((e) => e.code === 'op-essentials'), false);

console.log('create submit essentials smoke: ok (all builds and OP path)');
