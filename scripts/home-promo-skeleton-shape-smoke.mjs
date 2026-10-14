#!/usr/bin/env node

/** Static contract proving the Home Player Info stack has been removed. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const js = await readFile(new URL('js/pages/home/home-promo-band.js', root), 'utf8');
const css = await readFile(new URL('js/pages/home/home-promo-band.css', root), 'utf8');
const assemble = await readFile(new URL('js/pages/home/home-promo-assemble.js', root), 'utf8');

for (const [source, label] of [[js, 'promo markup'], [css, 'promo styles'], [assemble, 'promo assembler']]) {
  assert.doesNotMatch(
    source,
    /shared\/skeleton\.js|\bskel(?:Block|Section|Region)\b|bpb-skel|data-promo-skeleton|__skeleton|__skel/i,
    `${label}: no skeleton surface remains`,
  );
}

console.log('Home Player Info no-skeleton shape smoke passed.');
