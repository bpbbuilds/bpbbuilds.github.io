#!/usr/bin/env node

/** Verify the Builds-view creator avatar/blob stays 50% larger at every layout tier. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const themeCss = fs.readFileSync(path.join(root, 'css/theme.css'), 'utf8');
const sharedCss = fs.readFileSync(path.join(root, 'css/shared.css'), 'utf8');
const buildCss = fs.readFileSync(path.join(root, 'js/pages/build/build.css'), 'utf8');

const viewports = [
  { name: 'reference', width: 2560, height: 1440, scale: 1, expected: 132 },
  { name: 'short-desktop', width: 1920, height: 1080, scale: 0.75, expected: 99 },
  { name: 'tablet', width: 1024, height: 900, scale: 1, expected: 84 },
  { name: 'mobile', width: 390, height: 844, scale: 1, expected: 84 },
];

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});

try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>${themeCss}\n${sharedCss}\n${buildCss}
    .smoke-layout { width: 100%; }
  </style></head><body class="page-build page-build-view">
    <main id="main" class="build-main"><div class="build-layout smoke-layout">
      <aside class="build-author"><div class="build-author__card"><div class="build-author__avatar-wrap"><span class="build-author__avatar--blob"></span></div></div></aside>
    </div></main>
  </body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate((scale) => {
      document.body.style.setProperty('--build-desktop-scale', String(scale));
    }, viewport.scale);
    const result = await page.evaluate(() => {
      const avatar = document.querySelector('.build-author__avatar-wrap');
      if (!(avatar instanceof HTMLElement)) throw new Error('creator avatar fixture missing');
      const rect = avatar.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        borderRadius: getComputedStyle(avatar).borderRadius,
      };
    });
    if (Math.abs(result.width - viewport.expected) > 1 || Math.abs(result.height - viewport.expected) > 1) {
      throw new Error(`${viewport.name}: creator avatar is ${result.width.toFixed(1)}×${result.height.toFixed(1)}px; expected ${viewport.expected}px`);
    }
    if (result.borderRadius !== '50%') throw new Error(`${viewport.name}: creator avatar lost its circular shape`);
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
