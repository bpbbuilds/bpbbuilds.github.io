import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url);
const cssFiles = [
  './js/pages/home/featured-stage.css',
  './js/pages/home/home-class-showcase.css',
  './js/pages/home/home-items-explore.css',
  './js/pages/home/home-builds-vault.css',
  './js/pages/home/home-promo-band.css',
];
const css = (await Promise.all(cssFiles.map((file) => fs.readFile(new URL(file, root), 'utf8')))).join('\n');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.setContent(`
    <style>${css}</style>
    <main class="page-home">
      <section id="featured-stage">
        <div class="fs-track">
          <article class="fs-slide is-active">
            <div class="fs-focus__media">Preview</div>
            <div class="fs-focus__main">Active copy</div>
          </article>
          <article class="fs-slide"><div class="fs-focus__media">Side preview</div></article>
        </div>
      </section>
      <section class="home-mobs__snap" data-home-mobs-card>Hero</section>
      <button class="home-items__sprite" type="button">Item</button>
      <a class="home-vault__cell" href="/builds/view/?slug=test">Build</a>
      <a class="home-promo__board-link" href="/create/">Create board</a>
      <a class="home-promo__board-link">Empty board</a>
    </main>
  `);

  const selectors = {
    '.fs-slide.is-active .fs-focus__media': 'pointer',
    '.fs-slide.is-active .fs-focus__main': 'default',
    '.fs-slide:not(.is-active)': 'pointer',
    '.home-mobs__snap': 'pointer',
    '.home-items__sprite': 'pointer',
    '.home-vault__cell': 'pointer',
    '.home-promo__board-link[href]': 'pointer',
    '.home-promo__board-link:not([href])': 'default',
  };

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1080, height: 720 },
    { width: 768, height: 900 },
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
        `Home ${selector} cursor must be ${expected} at ${viewport.width}x${viewport.height}: ${JSON.stringify(cursors)}`,
      );
    }
  }

  console.log('home pointer smoke: ok (delegated click targets, responsive desktop/tablet)');
} finally {
  await browser.close();
}
