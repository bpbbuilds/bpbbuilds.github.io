#!/usr/bin/env node

/** Contract for the card-view-only Builds Alt + Play preview. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [postRow, boardThumbs, animation, css, todo] = await Promise.all([
  readFile(new URL('js/pages/builds/post-row.js', root), 'utf8'),
  readFile(new URL('js/pages/builds/board-thumbs.js', root), 'utf8'),
  readFile(new URL('js/pages/build/build-tip-animation.js', root), 'utf8'),
  readFile(new URL('js/pages/builds/builds.css', root), 'utf8'),
  readFile(new URL('docs/todo.md', root), 'utf8'),
]);

assert.match(postRow, /data-feed-card-preview/, 'card markup exposes the preview control');
assert.match(postRow, /aria-keyshortcuts="Alt"/, 'card preview advertises the Alt shortcut');
assert.match(postRow, /Play_normal\.png/, 'card preview uses the game play icon');
const compactBranch = postRow.slice(postRow.indexOf("if (view === 'compact')"), postRow.indexOf("if (view === 'grid')"));
const gridBranch = postRow.slice(postRow.indexOf("if (view === 'grid')"), postRow.indexOf("const rankKey"));
assert.doesNotMatch(compactBranch, /data-feed-card-preview/, 'compact markup does not render the card control');
assert.doesNotMatch(gridBranch, /data-feed-card-preview/, 'grid markup does not render the card control');
assert.match(boardThumbs, /registerCardBuildPreview/, 'card boards register their preview data');
assert.match(boardThumbs, /bindCardBuildPreviews/, 'card boards bind their preview lifecycle');
assert.match(boardThumbs, /page-builds/, 'card preview is scoped to the Builds page');
assert.match(animation, /Number\(opts\.cellPx\)/, 'preview renderer accepts the card board cell size');
assert.match(css, /\.builds-post:not\([^)]*compact[^)]*\):not\([^)]*grid[^)]*\):hover[\s\S]*?builds-post__card-preview/s, 'indicator is revealed only for card hover');
assert.match(css, /builds-post__card-preview-live[\s\S]*?pointer-events:\s*none/s, 'live preview overlay does not intercept card interaction');
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/, 'card preview has reduced-motion coverage');
assert.match(todo, /\[x\] on the builds page, in card view only/, 'todo is marked after the feature is complete');

console.log('Builds card preview smoke passed.');
