#!/usr/bin/env node

/** Static regression for the Featured carousel's build-view destination. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/pages/home/featured-stage.js', import.meta.url), 'utf8');

assert.match(
  source,
  /builds\/view\/\?slug=.*encodeURIComponent\(build\.slug\)/s,
  'Featured View build links use the canonical build-view route with an encoded slug',
);
assert.doesNotMatch(
  source,
  /\$\{root\}builds\/\$\{build\.slug\}\//,
  'Featured does not point at the nonexistent static /builds/<slug>/ route',
);

console.log('Home Featured build link smoke passed.');
