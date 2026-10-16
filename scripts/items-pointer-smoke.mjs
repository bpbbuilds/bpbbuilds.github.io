import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url);
const [filtersCss, gridCss, spotlightCss, drawerCss] = await Promise.all([
  fs.readFile(new URL('./js/pages/items/filters.css', root), 'utf8'),
  fs.readFile(new URL('./js/shared/backpack-grid/backpack-grid.css', root), 'utf8'),
  fs.readFile(new URL('./js/pages/items/spotlight.css', root), 'utf8'),
  fs.readFile(new URL('./js/shared/filter-drawer.css', root), 'utf8'),
]);

assert.match(filtersCss, /cursor:\s*var\(--bpb-cursor-pointer,\s*pointer\)/, 'Items filters need a native pointer fallback');
assert.match(filtersCss, /cursor:\s*var\(--bpb-cursor-default,\s*default\)/, 'Items disabled filters need a native default fallback');
assert.match(gridCss, /\.bpb-bg__hit-pad\s*\{[\s\S]*cursor:\s*var\(--bpb-cursor-pointer,\s*pointer\)/, 'Items hit pads need an explicit native pointer fallback');
assert.match(spotlightCss, /cursor:\s*var\(--bpb-cursor-pointer,\s*pointer\)/, 'Items recipe controls need a native pointer fallback');
assert.match(drawerCss, /cursor:\s*var\(--bpb-cursor-pointer,\s*pointer\)/, 'Items filter drawer controls need a native pointer fallback');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.setContent(`
    <style>${filtersCss}</style>
    <style>${gridCss}</style>
    <style>${spotlightCss}</style>
    <style>${drawerCss}</style>
    <main class="bpb-filter-drawer">
      <button class="il-filter__reset" type="button">Reset</button>
      <button class="il-filter__group-trigger" type="button">Grouping</button>
      <button class="il-filter__group-option" type="button">Shop</button>
      <button class="il-filter__group-option is-disabled" type="button" disabled>Disabled</button>
      <button class="il-filter__icon-btn" type="button">Search</button>
      <button class="il-filter__check" type="button">Check</button>
      <button class="bpb-bg__hit" type="button"><span class="bpb-bg__hit-pad"></span></button>
      <span class="bpb-bg__mark--socket bpb-bg__mark--gem"></span>
      <div class="bpb-bg__item--bag"><span class="bpb-bg__sprite"></span></div>
      <button class="il-spotlight-recipes__item" type="button">Recipe</button>
      <button class="bpb-filter-drawer__toggle" type="button">Filters</button>
      <button class="bpb-filter-drawer__close" type="button">Close</button>
      <button class="bpb-filter-drawer__backdrop" type="button">Backdrop</button>
    </main>
  `);

  const catalogSelectors = [
    '.il-filter__reset',
    '.il-filter__group-trigger',
    '.il-filter__group-option',
    '.il-filter__icon-btn',
    '.il-filter__check',
    '.bpb-bg__hit',
    '.bpb-bg__hit-pad',
    '.bpb-bg__mark--gem',
    '.bpb-bg__item--bag .bpb-bg__sprite',
    '.il-spotlight-recipes__item',
  ];

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1080, height: 720 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const cursors = await page.evaluate((selectors) => ({
      active: selectors.map((selector) => getComputedStyle(document.querySelector(selector)).cursor),
      drawer: [
        '.bpb-filter-drawer__toggle',
        '.bpb-filter-drawer__close',
        '.bpb-filter-drawer__backdrop',
      ].map((selector) => getComputedStyle(document.querySelector(selector)).cursor),
      disabled: getComputedStyle(document.querySelector('.il-filter__group-option.is-disabled')).cursor,
    }), catalogSelectors);
    assert.deepEqual(
      cursors.active,
      Array(cursors.active.length).fill('pointer'),
      `Items controls must use the native pointer at ${viewport.width}x${viewport.height}: ${JSON.stringify(cursors)}`,
    );
    if (viewport.width < 1240) {
      assert.deepEqual(
        cursors.drawer,
        ['pointer', 'pointer', 'pointer'],
        `Items filter-drawer controls must use the native pointer at ${viewport.width}x${viewport.height}: ${JSON.stringify(cursors)}`,
      );
    }
    assert.equal(
      cursors.disabled,
      'default',
      `Disabled Items filters must use the native default cursor at ${viewport.width}x${viewport.height}: ${JSON.stringify(cursors)}`,
    );
  }

  console.log('items pointer smoke: ok');
} finally {
  await browser.close();
}
