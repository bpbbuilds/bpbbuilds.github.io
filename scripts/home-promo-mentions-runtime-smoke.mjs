#!/usr/bin/env node

/** Runtime regression for Home build-animation description item icons. */

import assert from 'node:assert/strict';
import { promoInfoDescriptionHtml } from '../js/pages/home/home-promo-caption.js';

const item = {
  id: 'wooden_sword',
  name: 'Wooden Sword',
  image: 'WoodenSword.png',
};
const html = promoInfoDescriptionHtml(
  'Pair it with [[wooden_sword]] for extra damage.',
  {
    itemsById: new Map([[item.id, item]]),
    getSpriteUrl: (row) => `/assets/item-sprites/${row.image}`,
  },
);

assert.match(html, /class="bpb-mention"/, 'Promo mention renders an image chip');
assert.match(html, /data-item-id="wooden_sword"/, 'Promo chip keeps the item id');
assert.match(html, /src="\/assets\/item-sprites\/WoodenSword\.png"/, 'Promo chip uses the item sprite URL');
assert.match(html, /Pair it with /, 'Promo description text is retained');
assert.doesNotMatch(html, /<script/i, 'Promo description stays escaped');

console.log('Home promo item mention runtime smoke passed.');
