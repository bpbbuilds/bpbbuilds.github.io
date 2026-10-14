#!/usr/bin/env node

/** Focused contracts for the Items-page P1 live-art and spotlight deferral. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFile(path.join(root, file), 'utf8');
const [live, liveCss, pieces, spotlight, builds, audit] = await Promise.all([
  read('js/shared/item-live-art/index.js'),
  read('js/shared/item-live-art/item-live-art.css'),
  read('js/shared/backpack-grid/item-pieces.js'),
  read('js/pages/items/spotlight.js'),
  read('js/pages/items/spotlight-builds.js'),
  read('docs/performance/items-page-performance-audit.md'),
]);

assert.match(live, /document\.addEventListener\(\s*['"]visibilitychange/);
assert.match(live, /bpb-live-art-paused/);
assert.match(live, /browse: Boolean\(/);
assert.match(live, /staticArt = reduced \|\| st\.decorative \|\| \(st\.browse && !st\.active\)/);
assert.match(live, /Itemiary browse nodes attach live layers only when the user focuses/);
assert.match(liveCss, /\.bpb-live\.is-live \.bpb-live__glow--pulse/);
assert.match(liveCss, /html\.bpb-live-art-paused[\s\S]*animation-play-state: paused/);
assert.match(pieces, /setLiveArtActive\(itemEl, true\)/);
assert.match(pieces, /setLiveArtActive\(itemEl, false\)/);
assert.match(spotlight, /deferLiveArt: true/);
assert.match(spotlight, /requestAnimationFrame\(\(\) => \{[\s\S]*opts\.recipes\?\.showFor[\s\S]*opts\.builds\?\.showFor/);
assert.match(builds, /const BUILD_CACHE_MAX = 24/);
assert.match(builds, /function cacheBuilds\(itemId, builds\)/);
assert.match(audit, /- \[x\] Defer live-art layers and keep only focused\/spotlight animation active; pause when hidden\./);
assert.match(audit, /- \[x\] Open spotlight immediately and defer full art\/build queries behind a skeleton\/cache\./);

console.log('items P1 live-art/spotlight smoke passed');
