import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../js/pages/builds/builds.css', import.meta.url), 'utf8');
const row = await readFile(new URL('../js/pages/builds/post-row.js', import.meta.url), 'utf8');
assert.match(
  css,
  /\.builds-post:not\(\.builds-post--compact\):not\(\.builds-post--grid\)\s*\{[\s\S]*?background-image:\s*url\([^)]*bg-dark-textured\.webp[^)]*\)/,
  'Card view wraps its full header and body in the dark textured surface',
);
assert.match(
  css,
  /\.builds-post__body,\s*\.builds-post__compact,\s*\.builds-post__grid\s*\{[\s\S]*?border-radius:\s*1\.5rem/,
  'Compact and grid view content wrappers share the Home promo corner radius',
);
assert.doesNotMatch(
  css,
  /\.builds-post__body::before,\s*\.builds-post__compact::before,\s*\.builds-post__grid::before\s*\{/,
  'Public Builds view surfaces no longer paint a Patch3 shadow layer',
);
assert.match(
  css,
  /\.builds-post:not\(\.builds-post--compact\):not\(\.builds-post--grid\)\s*>\s*\.builds-post__body\s*\{[\s\S]*?background:\s*transparent/,
  'Card body lets the parent surface show behind its header and content',
);
assert.doesNotMatch(
  css,
  /\.builds-post\s*\{[\s\S]*?border-bottom:\s*1px/s,
  'Build listings no longer use separator borders',
);
assert.match(
  css,
  /\.builds-post__body > \*,\s*\.builds-post__compact > \*,\s*\.builds-post__grid > \*\s*\{[\s\S]*?z-index:\s*1/,
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

console.log('Public Builds view textured-surface smoke passed.');
