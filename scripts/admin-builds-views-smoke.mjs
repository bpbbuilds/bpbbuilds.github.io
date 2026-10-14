import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  adminBuildsFiltersHtml,
  defaultAdminBuildsFilters,
} from '../js/pages/admin/builds-filters.js';
import { applyBuildAction } from '../js/pages/admin/build-action-state.js';
import { actionsForBuild, buildCardHtml } from '../js/pages/admin/row.js';

const state = defaultAdminBuildsFilters();
assert.equal(state.view, 'compact', 'Compact remains the admin default');

const filterHtml = adminBuildsFiltersHtml('/', state, 3);
for (const view of ['card', 'grid', 'compact']) {
  assert.match(filterHtml, new RegExp(`data-admin-builds-view="${view}"`));
}
assert.match(filterHtml, /data-admin-builds-view-trigger/);
assert.ok(
  filterHtml.indexOf('data-build-search') < filterHtml.indexOf('data-admin-builds-list="all"'),
  'Collection buttons follow Search',
);
assert.ok(
  filterHtml.indexOf('data-admin-builds-list="all"') < filterHtml.indexOf('data-admin-builds-view-root'),
  'Collection buttons precede View',
);
assert.match(filterHtml, /data-admin-builds-list="pending_op"[\s\S]*Pending OP/);
assert.match(filterHtml, /data-admin-builds-list="all"[\s\S]*Uploaded builds/);
assert.ok(
  filterHtml.indexOf('data-admin-builds-view-root') < filterHtml.indexOf('data-admin-builds-list="featured"'),
  'Status filters follow View',
);

const adminCss = await readFile(new URL('../js/pages/admin/admin.css', import.meta.url), 'utf8');
assert.match(adminCss, /\.admin-builds-filters\.items-filters > \.admin-builds-filters__menus/);
assert.match(adminCss, /\.admin-builds-filters__menus[\s\S]*z-index:\s*20/);
assert.match(adminCss, /\.admin-builds-filters__menus \.il-filter__grouping:has\(\.il-filter__group-menu:not\(\[hidden\]\)\)/);
const adminShell = await readFile(new URL('../js/pages/admin/shell.js', import.meta.url), 'utf8');
assert.doesNotMatch(adminShell, /mountPendingQueue/);

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

const gridActions = buildCardHtml(build, '/', ['set_featured', 'hide'], { view: 'grid' });
assert.doesNotMatch(gridActions, /admin-btn--view[^>]*>View build/);
assert.match(gridActions, /data-admin-action="set_featured"[^>]*>Feature/);
assert.match(gridActions, /data-admin-action="hide"[^>]*>Hide/);

const actionState = applyBuildAction({ is_featured: false, is_public: true }, 'set_featured');
assert.equal(actionState.is_featured, true);
assert.equal(actionState.is_public, true);
assert.equal(applyBuildAction(actionState, 'hide').is_public, false);

const pendingActions = actionsForBuild(
  { op_requested: true, is_op: false, is_featured: false, is_public: true },
  'pending_op',
);
assert.deepEqual(pendingActions, ['approve_op', 'deny_op', 'set_featured', 'hide']);

console.log('Admin Builds view smoke passed.');
