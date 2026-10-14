#!/usr/bin/env node

/** Static contract smoke for Featured build description item chips. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/pages/home/featured-stage.js', import.meta.url), 'utf8');
const renderer = await readFile(new URL('../js/pages/home/featured-mentions.js', import.meta.url), 'utf8');

assert.match(source, /from ['"]\.\/featured-mentions\.js['"]/, 'Featured imports the shared item mention renderer');
assert.match(renderer, /notesToHtml/, 'Featured renderer uses the shared item mention contract');
assert.match(source, /blurb, notes,/, 'Featured selects the current notes description field');
assert.match(source, /build\.notes \|\| build\.blurb/, 'Featured prefers notes while preserving legacy blurbs');
assert.match(source, /loadFeaturedMentionData/, 'Featured loads the item data needed by description mentions');
assert.match(source, /featuredMentionData/, 'Featured passes mention data into every slide');

console.log('Home Featured item mention smoke passed.');
