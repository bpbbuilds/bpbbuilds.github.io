#!/usr/bin/env node

/** Verify the Build-view More by creator rail switches to a roomy two-column grid below the reference desktop. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const themeCss = fs.readFileSync(path.join(root, 'css/theme.css'), 'utf8');
const sharedCss = fs.readFileSync(path.join(root, 'css/shared.css'), 'utf8');
const buildCss = fs.readFileSync(path.join(root, 'js/pages/build/build.css'), 'utf8');

const viewports = [
  { name: '1440p-reference', width: 2560, height: 1440, scale: 1, columns: 3 },
  { name: '1080p-short-desktop', width: 1920, height: 1080, scale: 0.75, columns: 2 },
  { name: '900p-short-desktop', width: 1600, height: 900, scale: 0.625, columns: 2 },
  { name: 'tablet', width: 1024, height: 900, scale: 1, columns: 2 },
  { name: 'mobile', width: 390, height: 844, scale: 1, columns: 2 },
];

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});

try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>${themeCss}\n${sharedCss}\n${buildCss}</style></head><body class="page-build page-build-view">
    <main class="build-main"><div class="build-layout">
      <aside class="build-author"><section class="build-author__more">
        <h3 class="build-author__more-title">More by creator</h3>
        <ul class="build-author__more-list">${'<li class="build-author__more-item"><a class="build-author__thumb" href="#"><div class="build-author__thumb-grid"></div><div class="build-author__thumb-meta"><span class="build-author__more-name">Build</span></div></a></li>'.repeat(6)}</ul>
      </section></aside>
    </div></main>
  </body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate((scale) => {
      document.body.style.setProperty('--build-desktop-scale', String(scale));
    }, viewport.scale);

    const result = await page.evaluate(() => {
      const list = document.querySelector('.build-author__more-list');
      const items = [...document.querySelectorAll('.build-author__more-item')];
      if (!(list instanceof HTMLElement) || !items.length) throw new Error('More-by-creator fixture missing');
      const xPositions = new Set(items.map((item) => item.getBoundingClientRect().left.toFixed(2)));
      const style = getComputedStyle(list);
      const rects = items.map((item) => item.getBoundingClientRect());
      const horizontalGaps = [];
      for (let i = 1; i < rects.length; i += 1) {
        if (Math.abs(rects[i].top - rects[i - 1].top) < 1) {
          horizontalGaps.push(rects[i].left - (rects[i - 1].right));
        }
      }
      return {
        columns: xPositions.size,
        gridTemplateColumns: style.gridTemplateColumns,
        minHorizontalGap: horizontalGaps.length ? Math.min(...horizontalGaps) : null,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    assert.equal(result.columns, viewport.columns, `${viewport.name}: expected ${viewport.columns} More-by-creator columns, got ${result.columns} (${result.gridTemplateColumns})`);
    assert.ok(result.minHorizontalGap == null || result.minHorizontalGap > 0, `${viewport.name}: More-by-creator cards are touching or overlapping`);
    assert.ok(result.overflowX <= 1, `${viewport.name}: More-by-creator grid overflows horizontally by ${result.overflowX}px`);
    results.push({ ...viewport, ...result });
  }

  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
