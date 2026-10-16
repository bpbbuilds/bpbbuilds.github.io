#!/usr/bin/env node

/** Regression for the Builds using this item signature scrollbar. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const css = await fs.readFile(
  new URL('../js/pages/items/spotlight.css', import.meta.url),
  'utf8',
);

assert.match(
  css,
  /\.il-spotlight-builds__scroll\s*\{[\s\S]*scrollbar-width:\s*auto[\s\S]*scrollbar-color:\s*auto/,
  'Builds using this item must leave the standard scrollbar colors automatic',
);
assert.match(
  css,
  /\.il-spotlight-builds__scroll::-webkit-scrollbar-track\s*\{[\s\S]*track-horizontal\.png/,
  'Builds using this item must use the horizontal signature image track',
);
assert.match(
  css,
  /\.il-spotlight-builds__scroll::-webkit-scrollbar-thumb\s*\{[\s\S]*thumb-horizontal\.png[\s\S]*border:\s*0/,
  'Builds using this item must use the horizontal signature image thumb',
);
assert.match(
  css,
  /\.il-spotlight-builds__scroll::-webkit-scrollbar-button\s*\{[\s\S]*display:\s*none/,
  'Signature scrollbar buttons must remain hidden',
);
assert.match(
  css,
  /@supports\s+not\s+selector\(::-webkit-scrollbar\)[\s\S]*\.il-spotlight-builds__scroll\s*\{[\s\S]*scrollbar-color:\s*#eac914\s+#472a24/,
  'Non-WebKit browsers must receive the signature scrollbar palette fallback',
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.setContent(`
    <style>${css}</style>
    <aside class="il-spotlight-builds">
      <div class="il-spotlight-builds__scroll">
        <div style="width: 1800px; height: 80px"></div>
      </div>
    </aside>
  `);

  for (const viewport of [
    { width: 2560, height: 1440 },
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const style = await page.locator('.il-spotlight-builds__scroll').evaluate((el) => ({
      scrollbar: getComputedStyle(el, '::-webkit-scrollbar'),
      track: getComputedStyle(el, '::-webkit-scrollbar-track'),
      thumb: getComputedStyle(el, '::-webkit-scrollbar-thumb'),
      button: getComputedStyle(el, '::-webkit-scrollbar-button'),
      overflow: el.scrollWidth > el.clientWidth,
    }));
    assert.equal(style.scrollbar.width, '18px', `Signature scrollbar width must remain 18px at ${viewport.width}x${viewport.height}`);
    assert.match(style.track.backgroundImage, /track-horizontal\.png/, `Horizontal signature track missing at ${viewport.width}x${viewport.height}`);
    assert.match(style.thumb.backgroundImage, /thumb-horizontal\.png/, `Horizontal signature thumb missing at ${viewport.width}x${viewport.height}`);
    assert.equal(style.button.display, 'none', `Signature scrollbar buttons must be hidden at ${viewport.width}x${viewport.height}`);
    assert.equal(style.overflow, true, `Build strip must remain horizontally scrollable at ${viewport.width}x${viewport.height}`);
  }

  console.log('Items spotlight scrollbar smoke passed.');
} finally {
  await browser.close();
}
