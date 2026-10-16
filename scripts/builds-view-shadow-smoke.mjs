import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../js/pages/builds/builds.css', import.meta.url), 'utf8');
const row = await readFile(new URL('../js/pages/builds/post-row.js', import.meta.url), 'utf8');
assert.match(
  css,
  /\.builds-post:not\(\.builds-post--compact\):not\(\.builds-post--grid\),\s*\.builds-post__body,\s*\.builds-post__compact,\s*\.builds-post__grid\s*\{[\s\S]*?--builds-post-body-shade\s*:/,
  'All public Builds listing surfaces share the dark shade token',
);
assert.match(
  css,
  /\.builds-post:not\(\.builds-post--compact\):not\(\.builds-post--grid\)::before,\s*\.builds-post__compact::before,\s*\.builds-post__grid::before\s*\{[\s\S]*?Patch3\.png/,
  'All public Builds listing surfaces share the Items Patch3 shade layer',
);
assert.match(
  css,
  /\.builds-post:not\(\.builds-post--compact\):not\(\.builds-post--grid\),\s*\.builds-post__body,\s*\.builds-post__compact,\s*\.builds-post__grid\s*\{[\s\S]*?background:\s*transparent/,
  'Builds listing surfaces remove the opaque black fill',
);
assert.doesNotMatch(
  css,
  /\.builds-post:not\(\.builds-post--compact\):not\(\.builds-post--grid\),\s*\.builds-post__body,\s*\.builds-post__compact,\s*\.builds-post__grid\s*\{[\s\S]*?background(?:-color|-image):\s*(?:#111|url\([^)]*bg-dark-textured\.webp)/,
  'Builds listing surfaces do not restore the old black/texture fill',
);
assert.doesNotMatch(
  css,
  /\.builds-post\s*\{[\s\S]*?border-bottom:\s*1px/s,
  'Build listings no longer use separator borders',
);
assert.match(
  css,
  /\.builds-post:not\(\.builds-post--compact\):not\(\.builds-post--grid\)\s*>\s*\*,\s*\.builds-post__body\s*>\s*\*,\s*\.builds-post__compact\s*>\s*\*,\s*\.builds-post__grid\s*>\s*\*\s*\{[\s\S]*?z-index:\s*1/,
  'View content remains above its shared surface layer',
);

for (const view of ['card', 'compact', 'grid']) {
  if (view === 'card') assert.match(row, /builds-post__body/);
  else assert.match(row, new RegExp(`builds-post__${view}`));
}
assert.ok(
  row.indexOf('class="builds-post__top"') < row.indexOf('class="builds-post__body"'),
  'Card view renders the header before the body so the shared surface includes both',
);

console.log('Public Builds view dark-shade smoke passed.');
