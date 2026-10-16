import assert from 'node:assert/strict';
import { computeCoverage } from '../js/pages/sim/engine/coverage.js';
import { hydrateSimCoverage } from '../js/pages/sim/engine/scripts/registry.js';

hydrateSimCoverage(
  {
    byId: {
      wooden_sword: { status: 'dedicated' },
      leather_bag: { status: 'dedicated' },
    },
  },
  { byId: { wooden_sword: { family: 'basic_weapon' }, leather_bag: { family: 'bag' } } },
  {
    byId: {
      wooden_sword: 'verified_1to1',
      leather_bag: 'evidence_pending',
    },
    totals: { items: 2, verified_1to1: 1 },
  },
);

const coverage = computeCoverage(
  [
    { id: 'wooden_sword', key: 'sword' },
    { id: 'leather_bag', key: 'bag' },
  ],
  new Map([
    ['wooden_sword', { id: 'wooden_sword', type: 'Weapon', cooldown: 2 }],
    ['leather_bag', { id: 'leather_bag', type: 'Bag', cooldown: 0 }],
  ]),
);

assert.equal(coverage.fidelityKnown, true);
assert.equal(coverage.verified, 1);
assert.equal(coverage.verifiedPct, 50);
assert.equal(coverage.scripted, 1);

console.log('OK sim verified coverage: board percentage only counts retained 1:1 verdicts');
