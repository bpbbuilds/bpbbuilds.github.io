#!/usr/bin/env node

/** Ensure Builds view desktop density matches the unscaled 1080 composition. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildCss = fs.readFileSync(path.join(root, 'js/pages/build/build.css'), 'utf8');
const viewports = [
  { name: '1440-desktop', width: 1440, height: 900, expectedMinStage: 680 },
  { name: '1920-short-desktop', width: 1920, height: 1080, expectedMinStage: 680 },
  { name: '2560-reference', width: 2560, height: 1440, expectedMinStage: 680 },
  { name: '1080-stacked', width: 1080, height: 720, expectedMinStage: 680 },
  { name: '768-tablet', width: 768, height: 900, expectedMinStage: 680 },
  { name: '390-mobile', width: 390, height: 844, expectedMinStage: 0 },
];

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>${buildCss}
    .smoke-main { width: 100%; }
    .smoke-layout { width: 100%; }
    .smoke-stage { min-height: 1px; }
  </style></head><body class="page-build page-build-view">
    <main class="build-main smoke-main"><div class="build-layout smoke-layout">
      <aside class="build-author"><div class="build-author__card">Author</div></aside>
      <section class="build-stage smoke-stage"><header class="build-stage__head"><div class="build-stage__identity"><h1 class="build-stage__title">Build title</h1><div class="build-stage__tags">Real</div></div><div class="build-stage__vote-slot"></div></header><div class="build-stage__media" style="height:560px"></div></section>
      <aside class="build-info">Info</aside>
    </div></main>
  </body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const result = await page.evaluate(() => {
      const stage = document.querySelector('.build-stage');
      const layout = document.querySelector('.build-layout');
      if (!(stage instanceof HTMLElement) || !(layout instanceof HTMLElement)) {
        throw new Error('build layout fixture missing');
      }
      const stageRect = stage.getBoundingClientRect();
      const layoutRect = layout.getBoundingClientRect();
      return {
        stageWidth: stageRect.width,
        stageHeight: stageRect.height,
        layoutWidth: layoutRect.width,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (result.stageWidth < viewport.expectedMinStage) {
      throw new Error(`${viewport.name}: stage is only ${result.stageWidth.toFixed(1)}px wide`);
    }
    if (result.overflowX > 1) throw new Error(`${viewport.name}: horizontal overflow ${result.overflowX}px`);
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
