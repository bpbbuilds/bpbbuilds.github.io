import assert from 'node:assert/strict';
import {
  defaultFeedFilterState,
  feedFiltersHtml,
} from '../js/pages/builds/feed-filters.js';

const state = defaultFeedFilterState();
const anonymous = feedFiltersHtml('../', state, 0, { canPersonal: false });
assert.match(anonymous, /data-feed-personal-filters hidden/);
assert.match(anonymous, /aria-hidden="true"/);

const signedIn = feedFiltersHtml('../', state, 0, { canPersonal: true });
assert.doesNotMatch(signedIn, /data-feed-personal-filters hidden/);
assert.equal(signedIn.includes('data-feed-mine'), true);
assert.equal(signedIn.includes('data-feed-liked'), true);

console.log('build personal filter visibility smoke: ok');
