import assert from 'node:assert/strict';
import {
  VOTE_INTENT_KEY,
  clearVoteIntent,
  readVoteIntent,
  saveVoteIntent,
} from '../js/pages/build/vote-intent.js';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

const store = storage();
assert.equal(saveVoteIntent({ buildKey: 'demo-build', direction: 1 }, store, 1000), true);
assert.deepEqual(readVoteIntent(store, 1000), {
  buildKey: 'demo-build',
  direction: 1,
});
assert.equal(saveVoteIntent({ buildKey: '', direction: 1 }, store, 1000), false);
assert.equal(saveVoteIntent({ buildKey: 'demo-build', direction: 0 }, store, 1000), false);

assert.equal(saveVoteIntent({ buildKey: 'stale-build', direction: -1 }, store, 1000), true);
assert.equal(readVoteIntent(store, 1000 + 15 * 60 * 1000 + 1), null);
assert.equal(store.getItem(VOTE_INTENT_KEY), null);

saveVoteIntent({ buildKey: 'clear-me', direction: -1 }, store, 1000);
clearVoteIntent(store);
assert.equal(readVoteIntent(store, 1000), null);

console.log('build vote auth smoke: ok');
