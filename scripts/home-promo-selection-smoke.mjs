import assert from 'node:assert/strict';
import { randomizeBuildSequence } from '../js/pages/home/home-promo-selection.js';

const builds = [
  { id: 'a1', author_id: 'author-a' },
  { id: 'a2', author_id: 'author-a' },
  { id: 'b1', author_id: 'author-b' },
  { id: 'c1', author_id: 'author-c' },
  { id: 'b2', author_id: 'author-b' },
];

let randomCalls = 0;
const sequence = randomizeBuildSequence(builds, {
  previousAuthorId: 'author-a',
  random: () => (randomCalls++ % 2 === 0 ? 0 : 0.99),
});

assert.equal(sequence.length, builds.length, 'random sequence keeps every eligible build');
assert.deepEqual(
  sequence.map((build) => build.id).sort(),
  builds.map((build) => build.id).sort(),
  'random sequence does not drop or duplicate builds',
);
assert.notEqual(sequence[0].author_id, 'author-a', 'first build avoids the previous creator');
for (let i = 1; i < sequence.length; i += 1) {
  assert.notEqual(
    sequence[i].author_id,
    sequence[i - 1].author_id,
    'adjacent builds use different creators when an alternative remains',
  );
}
const nextCycle = randomizeBuildSequence(builds, {
  previousAuthorId: sequence.at(-1).author_id,
  random: () => 0,
});
assert.notEqual(
  nextCycle[0].author_id,
  sequence.at(-1).author_id,
  'next cycle avoids the creator that ended the previous cycle',
);

const oneCreator = randomizeBuildSequence(
  [{ id: 'only-1', author_id: 'author-only' }, { id: 'only-2', author_id: 'author-only' }],
  { previousAuthorId: 'author-only', random: () => 0 },
);
assert.equal(oneCreator.length, 2, 'single-creator sets still render all builds');

console.log('Home promo selection smoke passed.');
