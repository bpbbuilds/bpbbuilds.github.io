import assert from 'node:assert/strict';
import {
  adminBuildsFiltersHtml,
  defaultAdminBuildsFilters,
} from '../js/pages/admin/builds-filters.js';
import { buildCardHtml } from '../js/pages/admin/row.js';

const state = defaultAdminBuildsFilters();
assert.equal(state.view, 'compact', 'Compact remains the admin default');

const filterHtml = adminBuildsFiltersHtml('/', state, 3);
for (const view of ['card', 'grid', 'compact']) {
  assert.match(filterHtml, new RegExp(`data-admin-builds-view="${view}"`));
}
assert.match(filterHtml, /data-admin-builds-view-trigger/);

const build = {
  slug: 'smoke-build',
  title: 'Smoke build',
  author_name: 'Admin',
  hero_class: 'Pyromancer',
  is_public: true,
};

for (const view of ['card', 'grid', 'compact']) {
  const html = buildCardHtml(build, '/', ['hide'], { view });
  assert.match(html, new RegExp(`admin-card--${view}`));
  assert.match(html, /data-feed-board="smoke-build"/);
  assert.match(html, /data-admin-action="hide"/);
}

console.log('Admin Builds view smoke passed.');
