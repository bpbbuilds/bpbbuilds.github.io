#!/usr/bin/env node

/** Responsive browser smoke for public Builds view content surfaces. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'js/pages/builds/builds.css'), 'utf8');
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
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body class="page-builds">
    <main class="builds-main"><div class="builds-feed-col"><ul class="builds-feed__list">
      <li class="builds-post"><div class="builds-post__body"><span>Card content</span></div></li>
    </ul><ul class="builds-feed__list builds-feed__list--compact">
      <li class="builds-post builds-post--compact"><div class="builds-post__compact"><span>Compact content</span></div></li>
    </ul><ul class="builds-feed__list builds-feed__list--grid">
      <li class="builds-post builds-post--grid"><div class="builds-post__grid"><span>Grid content</span></div></li>
    </ul></div></main>
  </body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const result = await page.evaluate(() => {
      const wrappers = [...document.querySelectorAll('.builds-post__body, .builds-post__compact, .builds-post__grid')];
      const surfaces = wrappers.map((wrapper) => {
        const style = getComputedStyle(wrapper);
        const shade = getComputedStyle(wrapper, '::before');
        return {
          background: shade.backgroundColor,
          position: shade.position,
          zIndex: shade.zIndex,
          width: wrapper.getBoundingClientRect().width,
        };
      });
      return {
        surfaces,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (result.surfaces.length !== 3) throw new Error(`${viewport.name}: missing view surfaces`);
    if (result.surfaces.some((surface) => surface.background === 'rgba(0, 0, 0, 0)')) {
      throw new Error(`${viewport.name}: one or more content shadows missing`);
    }
    if (new Set(result.surfaces.map((surface) => surface.background)).size !== 1) {
      throw new Error(`${viewport.name}: content shadows differ`);
    }
    if (result.surfaces.some((surface) => surface.position !== 'absolute' || surface.zIndex !== '0')) {
      throw new Error(`${viewport.name}: content shadow layer stacking changed`);
    }
    if (result.surfaces.some((surface) => surface.width <= 0)) throw new Error(`${viewport.name}: view content collapsed`);
    if (result.overflowX > 1) throw new Error(`${viewport.name}: horizontal overflow ${result.overflowX}px`);
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
