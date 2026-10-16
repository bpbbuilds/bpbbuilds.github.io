#!/usr/bin/env node

/** Regression for the public Builds hashtag tag preset and filter links. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const css = await readFile(new URL('../js/pages/builds/builds.css', import.meta.url), 'utf8');
const row = await readFile(new URL('../js/pages/builds/post-row.js', import.meta.url), 'utf8');

assert.match(css, /\.builds-post__flair\s*\{[\s\S]*?position:\s*relative;[\s\S]*?background:\s*transparent;/,
  'tag preset uses a transparent host for the masked scribble');
assert.match(css, /\.builds-post__flair::before\s*\{[\s\S]*?Patch3\.png/,
  'tag preset reuses the Items Patch3 scribble mask');
assert.match(css, /\.builds-post__flair--op\s*\{[\s\S]*?--builds-tag-fill:/,
  'OP tags have a category fill token');
assert.match(css, /\.builds-post__flair--event\s*\{[\s\S]*?--builds-tag-fill:/,
  'event tags have a category fill token');
assert.match(css, /\.builds-post__flair--featured\s*\{[\s\S]*?--builds-tag-fill:/,
  'featured tags have a category fill token');
assert.match(css, /\.builds-post__flair:is\(a,\s*button\):hover[\s\S]*?transform:/,
  'clickable tags have a hover affordance');

assert.match(row, /f\.href\s*\|\|\s*`\$\{base\}builds\/\?tags=\$\{encodeURIComponent\(String\(f\.kind/,
  'OP tag links to the Builds OP filter');
assert.match(row, /href:\s*`\$\{base\}builds\/\?event=\$\{encodeURIComponent\(eventSlug\)\}`/,
  'event tag links to the Builds event filter');
assert.match(row, /const label = `#\$\{f\.label\}`/,
  'rendered tags use the hashtag presentation');
assert.match(row, /Filter builds tagged \$\{escapeAttr\(f\.label\)\}/,
  'build tag links expose a filter label');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;background:#8b5d3b;--bpb-cursor-pointer:pointer}</style><style>${css}</style></head><body>
    <div class="builds-post__flairs">
      <a class="builds-post__flair builds-post__flair--op" href="#" data-tag="op">#OP</a>
      <a class="builds-post__flair builds-post__flair--event" href="#" data-tag="event">#HDS I</a>
      <a class="builds-post__flair builds-post__flair--featured" href="#" data-tag="featured">#Featured</a>
    </div>
  </body></html>`);

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'short-desktop', width: 1080, height: 720 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const { before, overflowX } = await page.evaluate(() => ({
      before: [...document.querySelectorAll('[data-tag]')].map((el) => {
        const style = getComputedStyle(el);
        const shade = getComputedStyle(el, '::before');
        const rect = el.getBoundingClientRect();
        return {
          background: style.backgroundColor,
          shadeBackground: shade.backgroundColor,
          shadeMask: shade.webkitMaskBoxImage,
          cursor: style.cursor,
          width: rect.width,
          height: rect.height,
        };
      }),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    if (before.some((tag) => tag.background !== 'rgba(0, 0, 0, 0)')) throw new Error(`${viewport.name}: tag host is opaque`);
    if (before.some((tag) => tag.shadeBackground === 'rgba(0, 0, 0, 0)' || !tag.shadeMask.includes('Patch3.png'))) throw new Error(`${viewport.name}: tag scribble is missing`);
    if (before.some((tag) => tag.cursor !== 'pointer' || tag.width <= 0 || tag.height <= 0)) throw new Error(`${viewport.name}: tag affordance collapsed`);
    if (overflowX > 1) throw new Error(`${viewport.name}: tag row overflows horizontally`);

    await page.locator('[data-tag="op"]').hover();
    const hoverTransform = await page.locator('[data-tag="op"]').evaluate((el) => getComputedStyle(el).transform);
    if (hoverTransform === 'none') throw new Error(`${viewport.name}: hover affordance does not move the tag`);
  }
  console.log('Builds tag preset responsive smoke passed.');
} finally {
  await browser.close();
}
