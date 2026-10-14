import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildMatchesSearch, parseBuildSearchQuery } from '../js/shared/build-search.js';

const source = await fs.readFile(new URL('../js/pages/home/home-class-showcase.js', import.meta.url), 'utf8');
const css = await fs.readFile(new URL('../js/pages/home/home-class-showcase.css', import.meta.url), 'utf8');

assert.match(
  source,
  /Choose your hero to browse its builds, or click a starting bag to see every build that uses it\./,
  'Choose Your Hero must explain both hero and bag navigation',
);
assert.match(source, /<a\s+[\s\S]*class="home-mobs__bag"/, 'Starting bags must render as links');
assert.match(source, /q=.*\[\[\$\{id\}\]\]/, 'Bag links must use the resolved item-id search chip');
assert.doesNotMatch(source, /<button\s+[\s\S]*class="home-mobs__bag"/, 'Starting bags must not remain inert buttons');
assert.match(css, /\.home-mobs__bag\s*\{[\s\S]*cursor:\s*var\(--bpb-cursor-pointer,\s*pointer\)/, 'Bag links need the click cursor');

const parsed = parseBuildSearchQuery('[[leather_bag]]');
assert.deepEqual(parsed.itemIds, ['leather_bag'], 'Bag links must serialize an exact item id');
assert.equal(
  buildMatchesSearch(
    { placements: [{ item: { id: 'leather_bag', name: 'Leather Bag' } }] },
    parsed,
  ),
  true,
  'Builds containing the selected bag must match',
);
assert.equal(
  buildMatchesSearch(
    { placements: [{ item: { id: 'sewing_case', name: 'Sewing Case' } }] },
    parsed,
  ),
  false,
  'Builds without the selected bag must be filtered out',
);

console.log('Home Choose Your Hero bag-link smoke passed.');
