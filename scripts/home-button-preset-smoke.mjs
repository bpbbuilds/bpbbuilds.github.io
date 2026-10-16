#!/usr/bin/env node

/** Regression coverage for the shared homepage button preset. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const presetCss = await readFile(new URL('js/shared/button-preset.css', root), 'utf8');
const sectionCss = await Promise.all([
  readFile(new URL('js/pages/home/featured-stage.css', root), 'utf8'),
  readFile(new URL('js/pages/home/home-promo-band.css', root), 'utf8'),
  readFile(new URL('js/pages/home/home-items-explore.css', root), 'utf8'),
  readFile(new URL('js/pages/home/home-builds-vault.css', root), 'utf8'),
]);
const files = await Promise.all([
  readFile(new URL('js/pages/home/featured-stage.js', root), 'utf8'),
  readFile(new URL('js/pages/home/home-promo-band.js', root), 'utf8'),
  readFile(new URL('js/pages/home/home-items-explore.js', root), 'utf8'),
  readFile(new URL('js/pages/home/home-builds-vault.js', root), 'utf8'),
]);

assert.match(presetCss, /\.home-preset-button\s*,[\s\S]*?\{/, 'shared homepage button preset exists');
assert.match(presetCss, /border-radius:\s*999px/, 'shared preset uses the pill shape');
for (const variant of ['crimson', 'blue', 'forest', 'gold']) {
  assert.match(
    presetCss,
    new RegExp(`\\.home-preset-button\\.home-preset-button--${variant}\\s*\\{[\\s\\S]*?linear-gradient`),
    `${variant} preset variant exists`,
  );
}
assert.match(presetCss, /\.home-preset-button:hover\s*,[\s\S]*box-shadow:/, 'preset keeps the accent shadow on hover');
assert.doesNotMatch(presetCss, /ui-btn-(?:crimson|steel)\.png/, 'shared preset does not depend on raster button backgrounds');
assert.doesNotMatch(sectionCss[0], /\.fs-btn:hover\s*\{/, 'Featured buttons use the shared hover treatment');
assert.doesNotMatch(sectionCss[2], /\.home-items__cta:hover\s*\{/, 'Explore buttons use the shared hover treatment');

for (const [name, source] of [
  ['Featured builds', files[0]],
  ['Create promo', files[1]],
  ['Explore items', files[2]],
  ['Curated builds', files[3]],
]) {
  assert.match(source, /home-preset-button/, `${name} uses the shared homepage preset`);
}

assert.doesNotMatch(files[0], /ui-btn-(?:crimson|steel)\.png/, 'Featured buttons no longer use raster backgrounds');
assert.doesNotMatch(files[2], /home-items__cta[\s\S]*ui-btn-steel\.png/, 'Explore items CTA markup is not tied to the old raster preset');
assert.doesNotMatch(files[2], /home-preset-button home-preset-button--tab home-items__tab/, 'Explore item category tabs keep their original text treatment');
assert.match(sectionCss[2], /\.home-items__tab\s*\{[\s\S]*color:\s*rgb\(255, 226, 56\)/, 'Explore item category tabs retain the original yellow text');
assert.doesNotMatch(files[3], /ui-btn-(?:crimson|steel)\.png/, 'Curated build buttons no longer use raster backgrounds');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent(`<!doctype html><html><head><style>${[presetCss, ...sectionCss].join('\n')}</style></head><body>
    <div class="fs-focus" style="--fs-btn-h: 2.8rem; --fs-text-btn: 1rem;">
      <a class="home-preset-button home-preset-button--gold fs-btn fs-btn--watch" href="#">Watch</a>
      <a class="home-preset-button home-preset-button--blue fs-btn fs-btn--build" href="#">View build</a>
    </div>
    <div class="home-promo home-promo--create">
      <a class="home-preset-button home-preset-button--crimson home-promo__cta" href="#">Create</a>
      <a class="home-preset-button home-preset-button--blue home-promo__cta home-promo__cta--remix" href="#">Remix</a>
    </div>
    <div class="home-items__panel">
      <button class="home-items__tab is-active" type="button">Weapons</button>
      <a class="home-preset-button home-preset-button--forest home-items__cta" href="#">View items</a>
    </div>
    <div class="home-vault__actions">
      <a class="home-preset-button home-preset-button--gold home-vault__cta" href="#">Browse OP builds</a>
      <a class="home-preset-button home-preset-button--forest home-vault__cta" href="#">Explore the catalog</a>
    </div>
  </body></html>`);

  for (const width of [1440, 1080, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const buttons = await page.locator('.home-preset-button').evaluateAll((els) =>
      els.map((el) => {
        const style = getComputedStyle(el);
        return {
          className: el.className,
          width: el.getBoundingClientRect().width,
          height: el.getBoundingClientRect().height,
          radius: style.borderRadius,
          backgroundImage: style.backgroundImage,
        };
      }),
    );
    const exploreControls = await page.evaluate(() => {
      const tab = document.querySelector('.home-items__tab');
      const cta = document.querySelector('.home-items__cta');
      const tabStyle = tab instanceof HTMLElement ? getComputedStyle(tab) : null;
      const ctaStyle = cta instanceof HTMLElement ? getComputedStyle(cta) : null;
      return {
        tabColor: tabStyle?.color || '',
        tabRadius: tabStyle?.borderRadius || '',
        tabBackground: tabStyle?.backgroundImage || '',
        ctaRadius: ctaStyle?.borderRadius || '',
      };
    });
    assert.equal(buttons.length, 7, `all homepage action controls use the preset at ${width}px`);
    assert.deepEqual(
      [...new Set(buttons.flatMap((button) => [...button.className.matchAll(/home-preset-button--(crimson|blue|forest|gold)/g)].map((match) => match[1])))].sort(),
      ['blue', 'crimson', 'forest', 'gold'],
      `all four banner colors are represented at ${width}px`,
    );
    assert.equal(exploreControls.tabColor, 'rgb(255, 226, 56)', `category tabs keep yellow text at ${width}px`);
    assert.equal(exploreControls.tabRadius, '0px', `category tabs keep their original flat shape at ${width}px`);
    assert.equal(exploreControls.tabBackground, 'none', `category tabs keep a transparent background at ${width}px`);
    assert.equal(exploreControls.ctaRadius, '999px', `View items keeps the preset at ${width}px`);
    for (const button of buttons) {
      assert.ok(button.width > 0 && button.height > 0, `button remains visible at ${width}px`);
      assert.equal(button.radius, '999px', `button remains pill-shaped at ${width}px`);
      assert.doesNotMatch(button.backgroundImage, /url\(/, `button has no raster background at ${width}px`);
    }

    const hoverStates = [];
    for (const button of await page.locator('.home-preset-button').all()) {
      await button.hover();
      await page.waitForTimeout(200);
      hoverStates.push(await button.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          color: style.color,
          filter: style.filter,
          transform: style.transform,
          boxShadow: style.boxShadow,
        };
      }));
    }
    assert.equal(
      new Set(hoverStates.map((state) => JSON.stringify(state))).size,
      1,
      `all preset variants share the same hover treatment at ${width}px`,
    );
  }
} finally {
  await browser.close();
}

console.log('Home button preset smoke passed.');
