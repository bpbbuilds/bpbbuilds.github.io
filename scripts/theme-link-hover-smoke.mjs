#!/usr/bin/env node

/** Responsive regression for the shared text-link hover color. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const theme = await readFile(new URL('../css/theme.css', import.meta.url), 'utf8');

assert.match(theme, /a:hover\s*\{[\s\S]*?color:\s*#eac914/, 'text links use the navigation Patches gold on hover');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>${theme}</style></head><body>
    <a href="#profile">Someone</a>
  </body></html>`);

  for (const width of [1440, 1080, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const link = page.locator('a');
    await link.hover();
    const style = await link.evaluate((el) => ({
      color: getComputedStyle(el).color,
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height,
    }));
    assert.equal(style.color, 'rgb(234, 201, 20)', `text link uses Patches gold on hover at ${width}px`);
    assert.ok(style.width > 0 && style.height > 0, `text link remains visible at ${width}px`);
  }
} finally {
  await browser.close();
}

console.log('Theme link hover smoke passed.');
