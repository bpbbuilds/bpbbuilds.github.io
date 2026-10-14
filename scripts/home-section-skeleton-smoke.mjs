#!/usr/bin/env node

/** Static contract smoke for the Home page's no-skeleton loading policy. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const index = await read('index.html');
const homeBoot = await read('js/pages/home/index.js');
const nav = await read('js/shared/nav.js');
const homeFiles = [
  'js/pages/home/featured-stage.js',
  'js/pages/home/home-promo-band.js',
  'js/pages/home/home-promo-assemble.js',
  'js/pages/home/home-class-showcase.js',
  'js/pages/home/home-items-explore.js',
  'js/pages/home/home-builds-vault.js',
  'js/pages/home/featured-stage.css',
  'js/pages/home/home-promo-band.css',
  'js/pages/home/home-class-showcase.css',
  'js/pages/home/home-items-explore.css',
  'js/pages/home/home-builds-vault.css',
];

assert.doesNotMatch(
  index,
  /(?:class|data-[^=]+|aria-label)="[^"]*(?:bpb-skel|home-first-paint|skeleton|skel)[^"]*"/i,
  'Home does not ship page-level skeleton markup',
);

for (const id of [
  'featured-stage',
  'home-promo-band',
  'home-class-showcase',
  'home-items-explore',
  'home-builds-vault',
]) {
  const section = index.match(new RegExp(`<section id="${id}"[\\s\\S]*?<\\/section>`))?.[0] || '';
  assert.ok(section, `${id}: Home host exists`);
  assert.doesNotMatch(section, /bpb-skel|data-.*skeleton|skel/i, `${id}: Home host starts without a skeleton`);
}

for (const file of homeFiles) {
  const source = await read(file);
  assert.doesNotMatch(source, /shared\/skeleton\.js/, `${file}: does not import shared skeleton helpers`);
  assert.doesNotMatch(source, /\bskel(?:Block|Section|Region)\b|bpb-skel|data-[\w-]*skeleton|__skeleton|__skel/, `${file}: contains no skeleton markup or styles`);
}

assert.match(nav, /const\s+showSkeleton\s*=\s*!document\.body\?\.classList\.contains\(['"]page-home['"]\)/, 'shared nav can skip its placeholder on Home');
assert.match(nav, /if\s*\(showSkeleton\s*&&\s*!host\.querySelector\('\.site-nav--skel'\)\)/, 'shared nav only mounts a placeholder outside Home');
assert.match(homeBoot, /initHomeFallingItemsBackground\(\);\s*if\s*\(!\(await initNav\(\)\)\)/, 'Home still paints its background before async nav boot');

console.log('Home no-skeleton smoke passed.');
