#!/usr/bin/env node

/** Responsive regression for the Builds Tags filter group. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const filterHtml = await readFile(new URL('../js/pages/builds/feed-filters.js', import.meta.url), 'utf8');
const buildsCss = await readFile(new URL('../js/pages/builds/builds.css', import.meta.url), 'utf8');
const itemsCss = await readFile(new URL('../js/pages/items/filters.css', import.meta.url), 'utf8');
const presetCss = await readFile(new URL('../js/shared/filter-preset.css', import.meta.url), 'utf8');

assert.match(filterHtml, /class="il-filter__shade builds-feed-filters__tags"/, 'Tags has a named filter shade');
assert.match(filterHtml, /class="builds-feed-filters__tag-grid"/, 'Tags uses a dedicated grid wrapper');
assert.match(filterHtml, /builds-feed-filters__tag builds-feed-filters__tag--\$\{t\}/, 'tag buttons apply a category modifier from the allow-listed tag value');
for (const tag of ['op', 'feasible', 'theory', 'real', 'featured']) {
  assert.match(buildsCss, new RegExp(`builds-feed-filters__tag--${tag}[\\s\\S]*?--builds-tag-fill:`), `${tag} has a category fill`);
}
assert.match(buildsCss, /\.builds-feed-filters__tag-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  'Tags use a two-column responsive grid');
assert.match(buildsCss, /\.builds-feed-filters__tag::before\s*\{[\s\S]*?Patch3\.png/,
  'Tags reuse the Items Patch3 scribble surface');

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head>
    <style>html,body{margin:0;background:#8b5d3b;--bpb-cursor-pointer:pointer}</style>
    <style>${itemsCss}</style>
    <style>${presetCss}</style>
    <style>${buildsCss}</style>
  </head><body><aside class="items-filters il-filter bpb-filter-preset builds-feed-filters">
    <div class="il-filter__shade builds-feed-filters__tags"><p class="il-filter__sticker">Tags</p>
      <div class="builds-feed-filters__tag-grid" role="group" aria-label="Build tags">
        <button type="button" class="il-filter__check builds-feed-filters__tag builds-feed-filters__tag--op" data-feed-tag="op"><span class="il-filter__box"></span><span class="il-filter__check-label">OP</span></button>
        <button type="button" class="il-filter__check builds-feed-filters__tag builds-feed-filters__tag--feasible" data-feed-tag="feasible"><span class="il-filter__box"></span><span class="il-filter__check-label">Feasible</span></button>
        <button type="button" class="il-filter__check builds-feed-filters__tag builds-feed-filters__tag--theory" data-feed-tag="theory"><span class="il-filter__box"></span><span class="il-filter__check-label">Theory</span></button>
        <button type="button" class="il-filter__check builds-feed-filters__tag builds-feed-filters__tag--real" data-feed-tag="real"><span class="il-filter__box"></span><span class="il-filter__check-label">Real</span></button>
        <button type="button" class="il-filter__check builds-feed-filters__tag builds-feed-filters__tag--featured" data-feed-tag="featured"><span class="il-filter__box"></span><span class="il-filter__check-label">Featured</span></button>
      </div>
    </div>
  </aside></body></html>`);

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'short-desktop', width: 1080, height: 720 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const result = await page.evaluate(() => {
      const grid = document.querySelector('.builds-feed-filters__tag-grid');
      const tags = [...document.querySelectorAll('.builds-feed-filters__tag')];
      const gridStyle = grid ? getComputedStyle(grid) : null;
      return {
        columns: gridStyle?.gridTemplateColumns || '',
        tags: tags.map((tag) => {
          const style = getComputedStyle(tag);
          const shade = getComputedStyle(tag, '::before');
          const rect = tag.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            cursor: style.cursor,
            surface: shade.backgroundColor,
            mask: shade.webkitMaskBoxImage || shade.maskBorderSource,
          };
        }),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (result.columns.split(' ').length !== 2) throw new Error(`${viewport.name}: Tags is not two columns (${result.columns})`);
    if (result.tags.length !== 5 || result.tags.some((tag) => tag.width <= 0 || tag.height <= 0)) {
      throw new Error(`${viewport.name}: one or more tag controls collapsed`);
    }
    if (result.tags.some((tag) => tag.cursor !== 'pointer')) throw new Error(`${viewport.name}: tag cursor is not clickable`);
    if (result.tags.some((tag) => tag.surface === 'rgba(0, 0, 0, 0)' || !String(tag.mask).includes('Patch3.png'))) {
      throw new Error(`${viewport.name}: one or more category scribble surfaces are missing`);
    }
    if (new Set(result.tags.map((tag) => tag.surface)).size < 3) {
      throw new Error(`${viewport.name}: category colors are not differentiated`);
    }
    if (result.overflowX > 1) throw new Error(`${viewport.name}: horizontal overflow ${result.overflowX}px`);
  }
  console.log('Builds filter tags responsive smoke passed.');
} finally {
  await browser.close();
}
