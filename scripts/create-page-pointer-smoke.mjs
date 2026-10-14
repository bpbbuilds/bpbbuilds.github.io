import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url);
const cssFiles = [
  './js/shared/backpack-grid/backpack-grid.css',
  './js/pages/items/filters.css',
  './js/shared/filter-drawer.css',
  './js/pages/build/build.css',
  './js/pages/create/create.css',
  './js/pages/create/history-panel.css',
  './js/pages/create/rail-chrome.css',
];
const css = (await Promise.all(cssFiles.map((file) => fs.readFile(new URL(file, root), 'utf8')))).join('\n');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.setContent(`
    <style>${css}</style>
    <body class="page-create">
      <main>
        <button class="create-board__toggle" type="button">Toolbar</button>
        <button class="cr-tab" type="button">Filters</button>
        <button class="cr-submit" type="button">Submit</button>
        <button class="cr-submit" type="button" disabled>Disabled submit</button>
        <button class="cr-tag" type="button">Tag</button>
        <button class="cr-tag" type="button" disabled>Disabled tag</button>
        <button class="cr-tag-info" type="button">i</button>
        <button class="cr-ess__drop" type="button">Drop</button>
        <button class="create-history__row" type="button" role="option">History row</button>
        <button class="create-history__dd-option" type="button">History option</button>
        <button class="create-history__close" type="button">Close history</button>
        <button class="create-onboard__icon-btn" type="button">Hero</button>
        <button class="bpb-ring-config" type="button">i</button>
        <div class="build-info__ess-grid">
          <button class="build-info__tier" type="button">Needs</button>
          <button class="build-info__tier is-armed" type="button">Armed needs</button>
        </div>
        <a class="create-board__play" href="#sim">Play</a>
        <button class="bpb-bg__hit" type="button">Item hit</button>
        <button class="create-board__park-chip" type="button">Parked</button>
        <div class="create-col--catalog"><div class="bpb-bg__item">Catalog item</div></div>
      </main>
    </body>
  `);

  const selectors = {
    '.create-board__toggle': 'pointer',
    '.cr-tab': 'pointer',
    '.cr-submit': 'pointer',
    '.cr-tag': 'pointer',
    '.cr-tag-info': 'pointer',
    '.cr-ess__drop': 'pointer',
    '.create-history__row': 'pointer',
    '.create-history__dd-option': 'pointer',
    '.create-history__close': 'pointer',
    '.create-onboard__icon-btn': 'pointer',
    '.bpb-ring-config': 'pointer',
    '.build-info__tier': 'default',
    '.build-info__tier.is-armed': 'pointer',
    '.create-board__play': 'pointer',
    '.bpb-bg__hit': 'pointer',
    '.create-board__park-chip': 'grab',
    '.create-col--catalog .bpb-bg__item': 'grab',
  };

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1080, height: 720 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const cursors = await page.evaluate((entries) =>
      Object.fromEntries(
        Object.entries(entries).map(([selector]) => [
          selector,
          getComputedStyle(document.querySelector(selector)).cursor,
        ]),
      ), selectors);
    for (const [selector, expected] of Object.entries(selectors)) {
      assert.equal(
        cursors[selector],
        expected,
        `Create ${selector} cursor must be ${expected} at ${viewport.width}x${viewport.height}: ${JSON.stringify(cursors)}`,
      );
    }
    assert.equal(
      cursors['.cr-submit'],
      'pointer',
      `Active Create submit must remain clickable at ${viewport.width}x${viewport.height}`,
    );
    const disabled = await page.evaluate(() => getComputedStyle(document.querySelector('.cr-submit:disabled')).cursor);
    assert.equal(
      disabled,
      'not-allowed',
      `Disabled Create submit must retain its disabled cursor at ${viewport.width}x${viewport.height}`,
    );
  }

  console.log('create page pointer smoke: ok');
} finally {
  await browser.close();
}
