/**
 * Smoke: matchHistoryRoundIndex for create history scrubber.
 * Run: node scripts/_test-create-history-scrubber.mjs
 */

import assert from 'node:assert/strict';
import { matchHistoryRoundIndex } from '../js/pages/create/history-scrubber.js';
import { normalizeDraftHistory } from '../js/pages/create/draft-io.js';
import { framesFromHistoryRun } from '../js/pages/build/round-scrubber.js';

const history = normalizeDraftHistory({
  runId: 1,
  rounds: [
    {
      round: 1,
      result: 'win',
      placements: [{ id: 'a', x: 0, y: 0, r: 0 }],
    },
    {
      round: 2,
      result: 'loss',
      placements: [
        { id: 'a', x: 0, y: 0, r: 0 },
        { id: 'b', x: 1, y: 1, r: 1 },
      ],
    },
  ],
});
assert.ok(history);
const frames = framesFromHistoryRun(history);
assert.equal(frames.length, 2);

assert.equal(
  matchHistoryRoundIndex(frames, [{ id: 'a', x: 0, y: 0, r: 0, key: 'k' }]),
  0,
);
assert.equal(
  matchHistoryRoundIndex(frames, [
    { id: 'b', x: 1, y: 1, r: 1, key: 'k2' },
    { id: 'a', x: 0, y: 0, r: 0, key: 'k1' },
  ]),
  1,
);
assert.equal(matchHistoryRoundIndex(frames, []), 1);

console.log('ok — create history scrubber match');
