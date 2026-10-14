#!/usr/bin/env node

/** Static contract smoke for Home build-animation description item icons. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const caption = await readFile(new URL('../js/pages/home/home-promo-caption.js', import.meta.url), 'utf8');
const assemble = await readFile(new URL('../js/pages/home/home-promo-assemble.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../js/pages/home/home-promo-band.css', import.meta.url), 'utf8');

assert.match(caption, /from ['"]\.\.\/\.\.\/shared\/item-mentions\.js['"]/, 'Promo caption uses the shared mention renderer');
assert.match(caption, /export function promoInfoDescriptionHtml/, 'Promo caption exposes a pure mention rendering contract');
assert.match(caption, /String\(build\.notes \|\| ''\).*String\(build\.blurb \|\| ''\)/s, 'Promo prefers current notes while preserving legacy blurbs');
assert.match(assemble, /id, slug, title, hero_class, blurb, notes,/, 'Promo query selects current notes');
assert.match(assemble, /loadPromoMentionItems/, 'Promo loads mentions missing from board placements');
assert.match(assemble, /mentionItemsById/, 'Promo passes the complete mention catalog to the description');
assert.match(styles, /\.home-promo__info-desc \.bpb-mention/, 'Promo description styles item icons responsively');

console.log('Home promo item mention smoke passed.');
