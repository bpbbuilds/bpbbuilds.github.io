/**
 * Smoke tests for draft history attach / last-round publish helpers.
 * Run: node scripts/_test-publish-history.mjs
 */

import assert from 'node:assert/strict';
import {
  emptyDraft,
  lastRoundPlacementsFromHistory,
  normalizeDraft,
  normalizeDraftHistory,
} from '../js/pages/create/draft-io.js';

const sample = {
  runId: 42,
  rounds: [
    {
      round: 1,
      result: 'win',
      placements: [{ id: 'leather_bag', x: 1, y: 2, r: 0, key: 'a' }],
    },
    {
      round: 2,
      result: 'loss',
      placements: [
        { id: 'leather_bag', x: 1, y: 2, r: 0 },
        { id: 'wooden_sword', x: 3, y: 4, r: 1, gems: ['chipped_ruby'] },
      ],
    },
  ],
};

const hist = normalizeDraftHistory(sample);
assert.ok(hist);
assert.equal(hist.runId, 42);
assert.equal(hist.rounds.length, 2);
assert.equal(hist.rounds[0].placements[0].id, 'leather_bag');
assert.equal(hist.rounds[1].placements[1].gems[0], 'chipped_ruby');
// keys stripped
assert.equal(hist.rounds[0].placements[0].key, undefined);

assert.equal(normalizeDraftHistory(null), null);
assert.equal(normalizeDraftHistory({ rounds: [] }), null);
assert.equal(
  normalizeDraftHistory({ rounds: Array.from({ length: 41 }, (_, i) => ({
    round: i + 1,
    result: 'win',
    placements: [{ id: 'a', x: 0, y: 0, r: 0 }],
  })) }),
  null,
);

const last = lastRoundPlacementsFromHistory(hist, [
  { id: 'wooden_sword', x: 3, y: 4, r: 1, key: 'k', priority: 'needed' },
]);
assert.equal(last.length, 2);
assert.equal(last[1].id, 'wooden_sword');
assert.equal(last[1].priority, 'needed');
assert.equal(last[0].priority, null);

const draft = normalizeDraft({
  ...emptyDraft(),
  title: 'Test',
  history: sample,
  placements: last,
});
assert.ok(draft.history);
assert.equal(draft.history.runId, 42);
assert.equal(draft.history.rounds.length, 2);

const cleared = normalizeDraft({ ...draft, history: null });
assert.equal(cleared.history, null);

console.log('ok — publish history helpers');
