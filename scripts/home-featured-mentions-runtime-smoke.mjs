#!/usr/bin/env node

/** Runtime regression for Featured description item-chip rendering. */

import assert from 'node:assert/strict';
import { featuredBlurbHtml } from '../js/pages/home/featured-mentions.js';

const item = {
  id: 'wooden_sword',
  name: 'Wooden Sword',
  image: 'WoodenSword.png',
};
const html = featuredBlurbHtml('Pair it with [[wooden_sword]] for extra damage.', {
  itemsById: new Map([[item.id, item]]),
  getSpriteUrl: (row) => `/assets/item-sprites/${row.image}`,
});

assert.match(html, /class="bpb-mention"/, 'Featured mention renders an image chip');
assert.match(html, /data-item-id="wooden_sword"/, 'Featured chip keeps the item id');
assert.match(html, /src="\/assets\/item-sprites\/WoodenSword\.png"/, 'Featured chip uses the item sprite URL');
assert.match(html, /Pair it with /, 'Featured description text is retained');
assert.doesNotMatch(html, /<script/i, 'Featured description stays escaped');

console.log('Home Featured item mention runtime smoke passed.');
