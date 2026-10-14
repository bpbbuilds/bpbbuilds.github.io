#!/usr/bin/env node

/** Responsive contract for the Home build-animation Create CTA. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = await fs.readFile(path.join(root, 'js', 'pages', 'home', 'home-promo-band.css'), 'utf8');
const markup = await fs.readFile(path.join(root, 'js', 'pages', 'home', 'home-promo-band.js'), 'utf8');

assert.match(markup, /class="home-promo__cta"/, 'promo keeps a real navigational CTA element');
assert.doesNotMatch(css, /ui-btn-crimson\.png/, 'Create CTA does not depend on an image button');
assert.match(css, /\.home-promo__cta\s*\{[\s\S]*border-radius:\s*999px/, 'Create CTA is pill-shaped');
assert.match(css, /\.home-promo__cta\s*\{[\s\S]*--home-promo-cta-gold/, 'Create CTA defines its gold inset accent');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>
    <a class="home-promo__cta" href="/create/"><span>Create</span></a>
  </body></html>`);
  for (const width of [1440, 1080, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const style = await page.locator('.home-promo__cta').evaluate((el) => {
      const computed = getComputedStyle(el);
      const inner = getComputedStyle(el, '::before');
      return {
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
        radius: computed.borderRadius,
        backgroundImage: computed.backgroundImage,
        beforeBorder: inner.borderTopColor,
      };
    });
    assert.ok(style.width > 0 && style.height > 0, `CTA is visible at ${width}px`);
    assert.equal(style.radius, '999px', `CTA remains pill-shaped at ${width}px`);
    assert.doesNotMatch(style.backgroundImage, /url\(/, `CTA has no image background at ${width}px`);
    assert.notEqual(style.beforeBorder, 'rgba(0, 0, 0, 0)', `CTA keeps its inset outline at ${width}px`);
  }
} finally {
  await browser.close();
}

console.log('Home promo Create CTA smoke passed.');
