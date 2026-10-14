#!/usr/bin/env node

/** Ensure overhanging board art cannot cover the build title. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildCss = fs.readFileSync(path.join(root, 'js/pages/build/build.css'), 'utf8');
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const viewports = [
  { name: 'reference', width: 2560, height: 1440, scale: 1 },
  { name: 'short-desktop', width: 1920, height: 1080, scale: 0.75 },
  { name: 'desktop', width: 1440, height: 900, scale: 0.5625 },
  { name: 'tablet', width: 768, height: 900, scale: 1 },
  { name: 'mobile', width: 390, height: 844, scale: 1 },
];

const browser = await chromium.launch({ headless: true, executablePath: edgePath });
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>${buildCss}
    .smoke-layout { width: 720px; margin: 0 auto; grid-template-columns: 0 0 720px 0 0; column-gap: 0; }
    .smoke-media { height: 315px; }
    .smoke-board { width: 100%; height: 315px; }
    .smoke-overhang { position: absolute; top: -14px; left: 0; width: 1px; height: 10px; }
    @media (max-width: 1100px) {
      .smoke-layout { width: 360px; display: block; }
      .smoke-stage { width: 100%; }
    }
  </style></head><body class="page-build page-build-view">
    <main class="build-main"><div class="build-layout smoke-layout">
      <section class="build-stage smoke-stage">
        <header class="build-stage__head"><div class="build-stage__identity"><h1 class="build-stage__title">Build title</h1></div></header>
        <div class="build-stage__media smoke-media"><div class="build-bag"><div class="bpb-bg"><div class="bpb-bg__board smoke-board"><span class="smoke-overhang"></span></div></div></div></div>
      </section>
    </div></main>
  </body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate((scale) => {
      document.body.style.setProperty('--build-desktop-scale', String(scale));
    }, viewport.scale);
    const result = await page.evaluate(() => {
      const title = document.querySelector('.build-stage__title');
      const overhang = document.querySelector('.smoke-overhang');
      if (!(title instanceof HTMLElement) || !(overhang instanceof HTMLElement)) {
        throw new Error('title/overhang fixture missing');
      }
      const titleRect = title.getBoundingClientRect();
      const overhangRect = overhang.getBoundingClientRect();
      return {
        titleBottom: titleRect.bottom,
        overhangTop: overhangRect.top,
        gap: overhangRect.top - titleRect.bottom,
        headMargin: getComputedStyle(document.querySelector('.build-stage__head')).marginBottom,
      };
    });
    if (result.gap < 1) {
      throw new Error(`${viewport.name}: board art overlaps title by ${Math.abs(result.gap).toFixed(2)}px`);
    }
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
