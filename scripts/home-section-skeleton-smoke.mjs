#!/usr/bin/env node

/** Static contract smoke for Home/nav first-paint skeleton ownership. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const index = await readFile(new URL('index.html', root), 'utf8');
const navMarkup = await readFile(new URL('js/shared/nav/markup.js', root), 'utf8');
const navCss = await readFile(new URL('js/shared/nav.css', root), 'utf8');
const skeleton = await readFile(new URL('js/shared/skeleton.js', root), 'utf8');
const promo = await readFile(new URL('js/pages/home/home-promo-band.js', root), 'utf8');
const featured = await readFile(new URL('js/pages/home/featured-stage.js', root), 'utf8');
const heroes = await readFile(new URL('js/pages/home/home-class-showcase.js', root), 'utf8');
const items = await readFile(new URL('js/pages/home/home-items-explore.js', root), 'utf8');
const vault = await readFile(new URL('js/pages/home/home-builds-vault.js', root), 'utf8');
const homeBoot = await readFile(new URL('js/pages/home/index.js', root), 'utf8');
const theme = await readFile(new URL('css/theme.css', root), 'utf8');

assert.equal((index.match(/site-nav__skel-surface/g) || []).length, 1, 'static nav has one skeleton surface');
assert.doesNotMatch(index, /site-nav__skel-(banner|shelf|logo|builds|social|events|market|challenges)/, 'static nav has no child skeleton fragments');

for (const [id, label] of [
  ['featured-stage', 'featured builds'],
  ['home-promo-band', 'create promo'],
  ['home-class-showcase', 'hero classes'],
  ['home-items-explore', 'item library'],
  ['home-builds-vault', 'build vault'],
]) {
  const section = index.match(new RegExp(`<section id="${id}"[\\s\\S]*?<\\/section>`))?.[0] || '';
  assert.match(section, /bpb-skel-region/, `${label} has a static first-paint skeleton region`);
  assert.match(section, /bpb-skel(?:\s|\")/, `${label} has a static first-paint skeleton surface`);
}

const footer = index.match(/<div id="site-footer">[\s\S]*?<\/div>/)?.[0] || '';
assert.match(footer, /bpb-skel-region/, 'footer has a static first-paint skeleton region');
assert.match(footer, /bpb-skel(?:\s|\")/, 'footer has a static first-paint skeleton surface');

assert.match(theme, /body\.page-home[\s\S]*?background-image:\s*url\(/, 'Home has a CSS background fallback before the scene mounts');
assert.match(homeBoot, /initHomeFallingItemsBackground\(\);\s*if \(\!\(await initNav\(\)\)\)/, 'Home paints the background before waiting for navigation');

assert.match(skeleton, /export function skelSection/, 'shared section skeleton helper exists');
assert.match(navMarkup, /site-nav__skel-surface/, 'dynamic nav uses one skeleton surface');
assert.doesNotMatch(navMarkup, /site-nav__skel-(banner|shelf|logo|builds|social|events|market|challenges)/, 'dynamic nav has no child skeleton fragments');
assert.match(promo, /data-promo-section-skeleton/, 'promo owns one section skeleton');
assert.doesNotMatch(promo, /home-promo__skel-(item|section|board|class|title)/, 'promo has no nested skeleton fragments');
assert.match(featured, /fs-section-skeleton/, 'featured stage owns one section skeleton');
assert.match(heroes, /home-mobs__section-skeleton/, 'hero showcase owns one section skeleton');
assert.match(items, /home-items__section-skeleton/, 'item showcase owns one section skeleton');
assert.match(vault, /home-vault__section-skeleton/, 'build vault owns one section skeleton');
assert.match(navCss, /\.site-nav__skel-surface/, 'nav skeleton surface has scoped styling');

console.log('Home/nav section skeleton smoke passed.');
