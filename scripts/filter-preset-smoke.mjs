#!/usr/bin/env node

/** Regression for the shared Items-derived filter surface preset. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const sharedCss = await readFile(new URL('js/shared/filter-preset.css', root), 'utf8');
const pages = [
  'items/index.html',
  'builds/index.html',
  'create/index.html',
  'events/index.html',
  'admin/index.html',
  'sim/index.html',
  'u/index.html',
];
const roots = [
  'js/pages/items/catalog-filters.js',
  'js/pages/items/catalog/shell.js',
  'js/pages/builds/feed-filters.js',
  'js/pages/builds/feed.js',
  'js/pages/events/event-filters.js',
  'js/pages/events/events-skeleton.js',
  'js/pages/admin/builds-filters.js',
  'js/pages/admin/events-filters.js',
  'js/pages/admin/cosmetics-filters.js',
  'js/pages/admin/report-filters.js',
  'js/pages/u/tab-builds.js',
  'js/pages/u/tab-inventory.js',
  'js/pages/u/tab-settings.js',
  'js/pages/u/blob/wardrobe-markup.js',
  'js/pages/create/rail-tabs.js',
];

assert.match(sharedCss, /Items-derived shared filter preset/i, 'shared preset should identify its Items baseline');
assert.match(sharedCss, /Patch3\.png/, 'shared preset should use the Items Patch3 mask');
assert.match(sharedCss, /--il-shade:\s*rgba\(14\s*,\s*15\s*,\s*16\s*,\s*0\.09\)/, 'shared preset should retain the Items shade token');
assert.match(sharedCss, /\.bpb-filter-preset[^}]*background:\s*transparent/s, 'shared preset should keep the filter host transparent');
assert.match(sharedCss, /\.bpb-filter-preset[^}]*::before[^}]*content:\s*none/s, 'shared preset should remove outer slabs');

for (const pagePath of pages) {
  const html = await readFile(new URL(pagePath, root), 'utf8');
  assert.match(html, /js\/shared\/filter-preset\.css/, `${pagePath} should load the shared filter preset`);
}

for (const rootPath of roots) {
  const source = await readFile(new URL(rootPath, root), 'utf8');
  assert.match(source, /bpb-filter-preset/, `${rootPath} should opt its filter surface into the shared preset`);
}

const buildsCss = await readFile(new URL('js/pages/builds/builds.css', root), 'utf8');
const simBrowserCss = await readFile(new URL('js/pages/sim/foe/sim-build-browser.css', root), 'utf8');
assert.doesNotMatch(buildsCss, /builds-feed-filters \.il-filter__shade::before/, 'Builds should not suppress shared section bands');
assert.doesNotMatch(simBrowserCss, /Restore Item Library.*Patch3 bands/s, 'Sim should consume the shared section bands');

const itemsCss = await readFile(new URL('js/pages/items/filters.css', root), 'utf8');
const eventsCss = await readFile(new URL('js/pages/events/events.css', root), 'utf8');
const adminCss = await readFile(new URL('js/pages/admin/admin.css', root), 'utf8');
const inventoryCss = await readFile(new URL('js/pages/u/inventory.css', root), 'utf8');
const pageCases = [
  {
    name: 'items',
    css: itemsCss,
    markup: '<aside class="items-filters il-filter bpb-filter-preset"><div class="il-filter__shade">Items</div></aside>',
  },
  {
    name: 'builds',
    css: `${itemsCss}\n${buildsCss}`,
    markup: '<aside class="items-filters il-filter bpb-filter-preset builds-feed-filters"><div class="il-filter__shade">Builds</div></aside>',
  },
  {
    name: 'events',
    css: `${itemsCss}\n${eventsCss}`,
    markup: '<aside class="items-filters il-filter bpb-filter-preset events-filters"><div class="il-filter__shade">Events</div></aside>',
  },
  {
    name: 'admin',
    css: `${itemsCss}\n${adminCss}`,
    markup: '<aside class="items-filters il-filter bpb-filter-preset admin-report-filters"><div class="il-filter__shade">Admin</div></aside>',
  },
  {
    name: 'profile',
    css: `${itemsCss}\n${inventoryCss}`,
    markup: '<aside class="profile-inv-filters items-filters il-filter bpb-filter-preset"><div class="il-filter__shade">Profile</div></aside>',
  },
  {
    name: 'sim',
    css: `${itemsCss}\n${buildsCss}\n${simBrowserCss}`,
    markup: '<aside class="items-filters il-filter bpb-filter-preset builds-feed-filters sim-build-browser"><div class="il-filter__shade">Sim</div></aside>',
  },
];

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head>
    <style>html,body{margin:0;background:#8b5d3b} .bpb-filter-preset{background:rgba(0,0,0,.6);border:3px solid red} .bpb-filter-preset .il-filter__shade::before{content:none}</style>
    <style>${sharedCss}</style>
  </head><body>
    <aside class="items-filters il-filter bpb-filter-preset" aria-label="Filter items">
      <div class="il-filter__head"><p>Filters</p></div>
      <div class="il-filter__shade"><span>Section</span></div>
    </aside>
  </body></html>`);

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'short-desktop', width: 1080, height: 720 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const result = await page.evaluate(() => {
      const host = document.querySelector('.bpb-filter-preset');
      const band = document.querySelector('.il-filter__shade');
      const hostStyle = getComputedStyle(host);
      const bandStyle = getComputedStyle(band);
      const pseudo = getComputedStyle(band, '::before');
      return {
        hostBackground: hostStyle.backgroundColor,
        hostBorder: hostStyle.borderTopStyle,
        outerPseudo: getComputedStyle(host, '::before').content,
        bandBackground: bandStyle.backgroundColor,
        bandPseudoBackground: pseudo.backgroundColor,
        bandMask: pseudo.webkitMaskBoxImage,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert.equal(result.hostBackground, 'rgba(0, 0, 0, 0)', `${viewport.name}: host should be transparent`);
    assert.equal(result.hostBorder, 'none', `${viewport.name}: host should not add a frame`);
    assert.equal(result.outerPseudo, 'none', `${viewport.name}: outer slab should be disabled`);
    assert.equal(result.bandBackground, 'rgba(0, 0, 0, 0)', `${viewport.name}: band host should be transparent`);
    assert.equal(result.bandPseudoBackground, 'rgba(14, 15, 16, 0.09)', `${viewport.name}: Items shade should be applied`);
    assert.match(result.bandMask, /Patch3\.png/, `${viewport.name}: Patch3 mask should be applied`);
    assert.ok(result.overflowX <= 1, `${viewport.name}: filter preset should not overflow horizontally`);
  }

  for (const pageCase of pageCases) {
    const css = `${pageCase.css.replace(/@import[^;]+;/g, '')}\n${sharedCss}`;
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;background:#8b5d3b}</style><style>${css}</style></head><body>${pageCase.markup}</body></html>`);
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'short-desktop', width: 1080, height: 720 },
      { name: 'tablet', width: 768, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      const result = await page.evaluate(() => {
        const host = document.querySelector('.bpb-filter-preset');
        const band = document.querySelector('.bpb-filter-preset .il-filter__shade');
        const hostStyle = getComputedStyle(host);
        const pseudo = getComputedStyle(band, '::before');
        return {
          hostBackground: hostStyle.backgroundColor,
          hostBorder: hostStyle.borderTopStyle,
          outerPseudo: getComputedStyle(host, '::before').content,
          bandPseudoBackground: pseudo.backgroundColor,
          bandMask: pseudo.webkitMaskBoxImage,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      assert.equal(result.hostBackground, 'rgba(0, 0, 0, 0)', `${pageCase.name}/${viewport.name}: host should be transparent`);
      assert.equal(result.hostBorder, 'none', `${pageCase.name}/${viewport.name}: host should not add a frame`);
      assert.equal(result.outerPseudo, 'none', `${pageCase.name}/${viewport.name}: outer slab should be disabled`);
      assert.equal(result.bandPseudoBackground, 'rgba(14, 15, 16, 0.09)', `${pageCase.name}/${viewport.name}: Items shade should win`);
      assert.match(result.bandMask, /Patch3\.png/, `${pageCase.name}/${viewport.name}: Patch3 mask should win`);
      assert.ok(result.overflowX <= 1, `${pageCase.name}/${viewport.name}: filter surface should not overflow`);
    }
  }
  console.log('Shared filter preset responsive smoke passed.');
} finally {
  await browser.close();
}
