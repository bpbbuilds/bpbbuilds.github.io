import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPromoSpriteCache } from '../js/pages/home/home-promo-sprite-cache.js';

const root = new URL('../', import.meta.url);
const assemble = await readFile(new URL('js/pages/home/home-promo-assemble.js', root), 'utf8');

assert.match(assemble, /createPromoSpriteCache\(/, 'assembler uses the bounded sprite cache');
assert.match(assemble, /if \(playerInfoMode\) retainBuildSprites\(firstBuild, firstNextBuild\)/, 'Player Info retains its initial current/next window');
assert.match(assemble, /await cacheBuildSprites\(firstNextBuild\)/, 'Player Info warms the initial next build');
assert.match(assemble, /if \(playerInfoMode\) \{[\s\S]*?await cacheBuildSprites\(nextBuild\)/, 'Player Info warms each next build before painting');
assert.match(assemble, /if \(!playerInfoMode\) \{[\s\S]*?cacheBuildSprites\(nextBuild\)/, 'non-Player promo paths keep their existing background prefetch');

const decodeEvents = [];
class FakeImage {
  set src(value) {
    this.url = value;
  }

  decode() {
    decodeEvents.push(this.url);
    return Promise.resolve();
  }
}

const cache = createPromoSpriteCache({
  maxBuilds: 2,
  maxEntries: 4,
  createImage: () => new FakeImage(),
});
const builds = {
  alpha: ['alpha-a', 'alpha-b'],
  bravo: ['bravo-a', 'bravo-b'],
  charlie: ['charlie-a', 'charlie-b'],
  delta: ['delta-a', 'delta-b'],
};

cache.retainBuilds(['alpha', 'bravo']);
await cache.warmBuild('alpha', builds.alpha);
await cache.warmBuild('bravo', builds.bravo);
assert.equal(cache.snapshot().size, 4, 'initial current/next window fits the configured bound');
assert.equal(cache.isBuildWarm('alpha'), true, 'current build is warmed');
assert.equal(cache.isBuildWarm('bravo'), true, 'next build is warmed before its first paint');

const paintEvents = [];
for (let cycle = 0; cycle < 20; cycle += 1) {
  const names = Object.keys(builds);
  const current = names[cycle % names.length];
  const next = names[(cycle + 1) % names.length];
  cache.retainBuilds([current, next]);
  await cache.warmBuild(current, builds[current]);
  await cache.warmBuild(next, builds[next]);
  assert.equal(cache.isBuildWarm(next), true, `cycle ${cycle + 1}: next build is warm before paint`);
  const snapshot = cache.snapshot();
  assert.ok(snapshot.size <= 4, `cycle ${cycle + 1}: sprite cache stays bounded`);
  assert.deepEqual(snapshot.retainedBuilds, [current, next], `cycle ${cycle + 1}: current/next retention is ordered`);
  assert.ok(snapshot.buildCount <= 2, `cycle ${cycle + 1}: build metadata stays bounded`);
  paintEvents.push(next);
}

assert.equal(paintEvents.length, 20, 'all repeated cycles reached the paint boundary');
assert.ok(decodeEvents.length > 0, 'sprite decode work was exercised');
assert.equal(cache.isBuildWarm('bravo'), false, 'evicted build is no longer reported warm');

console.log('Home promo sprite cache smoke passed.');
