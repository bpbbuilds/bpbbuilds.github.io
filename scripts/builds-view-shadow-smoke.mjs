import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../js/pages/builds/builds.css', import.meta.url), 'utf8');
const row = await readFile(new URL('../js/pages/builds/post-row.js', import.meta.url), 'utf8');
assert.match(
  css,
  /\.builds-post__body,\s*\.builds-post__compact,\s*\.builds-post__grid\s*\{[\s\S]*?--builds-post-body-shade\s*:/,
  'All public Builds view content wrappers share the Card surface token',
);
assert.match(
  css,
  /\.builds-post__body::before,\s*\.builds-post__compact::before,\s*\.builds-post__grid::before\s*\{[\s\S]*?Patch3\.png/,
  'All public Builds view content wrappers share the Patch3 surface',
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

console.log('Public Builds view shadow smoke passed.');
