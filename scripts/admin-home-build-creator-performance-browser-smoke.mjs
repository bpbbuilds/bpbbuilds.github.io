#!/usr/bin/env node

/** Responsive browser smoke for the isolated Home board-animation controls. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'js/pages/admin/build-creator-animation-test.css'), 'utf8');
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
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body class="page-admin-build-creator-animation-test">
    <main id="main"><section class="build-creator-animation-test">
      <header class="build-creator-animation-test__intro"><h1>Build creator animation</h1></header>
      <div class="build-creator-animation-test__toolbar">
        <div class="build-creator-animation-test__control-group"><span class="build-creator-animation-test__control-label">Animation source</span><div class="build-creator-animation-test__controls"><button class="build-creator-animation-test__tab">Catalog</button><button class="build-creator-animation-test__tab">Chest preset</button><button class="build-creator-animation-test__tab">Creator wave</button></div></div>
        <div class="build-creator-animation-test__control-group"><span class="build-creator-animation-test__control-label">Preview style</span><div class="build-creator-animation-test__controls"><button class="build-creator-animation-test__tab">Home skin</button><button class="build-creator-animation-test__tab">Performance</button><button class="build-creator-animation-test__tab">Wireframe</button></div></div>
      </div>
      <section id="build-creator-animation" data-animation-preview data-style="wireframe"><div class="home-promo home-promo--create"><div class="home-promo__band"><div class="home-promo__card"><div>Board animation</div></div></div></div></section>
    </section></main>
  </body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const result = await page.evaluate(() => {
      const toolbar = document.querySelector('.build-creator-animation-test__toolbar');
      const preview = document.querySelector('[data-animation-preview]');
      const card = document.querySelector('.home-promo__card');
      const toolbarRect = toolbar?.getBoundingClientRect();
      const previewRect = preview?.getBoundingClientRect();
      const contentStyle = card?.firstElementChild ? getComputedStyle(card.firstElementChild) : null;
      return {
        toolbarWidth: toolbarRect?.width || 0,
        viewportWidth: document.documentElement.clientWidth,
        centered: toolbarRect ? Math.abs((toolbarRect.left + toolbarRect.width / 2) - document.documentElement.clientWidth / 2) < 1 : false,
        previewWidth: previewRect?.width || 0,
        style: preview?.dataset.style || '',
        wireframeFilter: contentStyle?.filter || '',
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (result.toolbarWidth <= 0 || result.toolbarWidth > result.viewportWidth) throw new Error(`${viewport.name}: toolbar overflows viewport`);
    if (!result.centered) throw new Error(`${viewport.name}: toolbar is not centered (${JSON.stringify(result)})`);
    if (result.previewWidth <= 0) throw new Error(`${viewport.name}: animation preview collapsed`);
    if (!result.wireframeFilter.includes('grayscale')) throw new Error(`${viewport.name}: wireframe style was not applied`);
    if (result.overflowX > 1) throw new Error(`${viewport.name}: horizontal overflow ${result.overflowX}px`);
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
