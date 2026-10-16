#!/usr/bin/env node

/** Responsive browser smoke for Builds feed content-to-scrollbar spacing. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildsCss = fs.readFileSync(path.join(root, 'js/pages/builds/builds.css'), 'utf8');
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'short-desktop', width: 1080, height: 720 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true, executablePath: edgePath });
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>
    *,*::before,*::after{box-sizing:border-box}
    html,body{margin:0;min-height:100%;background:#201717}
    #root{width:min(calc(100% - 32px), 720px);margin:0 auto;padding:24px 0}
    ${buildsCss}
    .builds-feed__list-host{height:180px!important;min-height:0!important;width:100%;}
    .fixture-content{width:100%;height:620px;background:#5a4535}
  </style></head><body class="page-builds"><main id="root"><div class="builds-feed__list-host"><div class="fixture-content"></div></div></main></body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const result = await page.evaluate(() => {
      const feed = document.querySelector('.builds-feed__list-host');
      const content = document.querySelector('.fixture-content');
      if (!(feed instanceof HTMLElement) || !(content instanceof HTMLElement)) throw new Error('Builds feed fixture missing');
      const feedStyle = getComputedStyle(feed);
      const feedRect = feed.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      return {
        paddingInlineEnd: feedStyle.paddingInlineEnd,
        paddingRight: feedStyle.paddingRight,
        scrollHeight: feed.scrollHeight,
        clientHeight: feed.clientHeight,
        horizontalOverflow: feed.scrollWidth - feed.clientWidth,
        contentToEdge: feedRect.right - contentRect.right,
      };
    });
    const padding = Number.parseFloat(result.paddingInlineEnd);
    assert.ok(padding >= 5.5, `${viewport.name}: scrollbar-side spacing is too small (${JSON.stringify(result)})`);
    assert.equal(result.paddingRight, result.paddingInlineEnd, `${viewport.name}: LTR inline-end spacing must resolve to the right side`);
    assert.ok(result.scrollHeight > result.clientHeight, `${viewport.name}: fixture must remain vertically scrollable`);
    assert.ok(result.horizontalOverflow <= 1, `${viewport.name}: spacing introduced horizontal overflow (${JSON.stringify(result)})`);
    assert.ok(result.contentToEdge >= padding - 0.5, `${viewport.name}: content still touches the scrollbar edge (${JSON.stringify(result)})`);
    results.push({ ...viewport, ...result });
  }

  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
