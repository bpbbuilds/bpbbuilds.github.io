import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCardHtml } from '../js/pages/admin/row.js';

const css = await readFile(new URL('../js/pages/admin/admin.css', import.meta.url), 'utf8');
const selector = '.admin-builds-col .admin-cards > .admin-card';
const ruleStart = css.indexOf(selector);
assert.ok(ruleStart >= 0, 'Build cards have a shared view-level shadow selector');

const rule = css.slice(ruleStart, css.indexOf('}', ruleStart) + 1);
assert.match(rule, /--admin-build-card-shadow\s*:/, 'Build-card shadow is a shared token');
assert.match(rule, /box-shadow\s*:\s*var\(--admin-build-card-shadow\)/, 'Build cards use the shared shadow');
assert.match(rule, /clamp\(/, 'Build-card shadow scales with the viewport');

const build = { slug: 'shadow-smoke', title: 'Shadow smoke', author_name: 'Admin' };
for (const view of ['compact', 'card', 'grid']) {
  const html = buildCardHtml(build, '/', ['hide'], { view });
  assert.match(html, new RegExp(`admin-card--${view}`));
}

for (const breakpoint of ['max-width: 1080px', 'max-width: 720px']) {
  assert.match(css, new RegExp(`@media \\(${breakpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`));
}

console.log('Admin Builds shadow smoke passed.');
