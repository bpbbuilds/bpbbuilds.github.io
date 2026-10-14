#!/usr/bin/env node

/** Responsive browser smoke for the Home footer paint boundary. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharedCss = fs.readFileSync(path.join(root, 'css/shared.css'), 'utf8');
const homeCss = fs.readFileSync(path.join(root, 'js/pages/home/home-builds-vault.css'), 'utf8');
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
  await page.setContent(`<!doctype html><html><head><style>${sharedCss}\n${homeCss}</style></head><body class="page-home">
    <main id="main"><div style="height:1200px"></div></main>
    <div id="site-footer"><footer class="site-footer"><div class="site-footer__inner"><p class="site-footer__brand">Backpack Battles Builds</p><p class="site-footer__disclaimer">Unofficial fan site.</p><nav class="site-footer__nav"><a href="#">About</a><a href="#">Builds</a></nav><div class="site-footer__socials"></div></div></footer></div>
  </body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const result = await page.evaluate(() => {
      const footerHost = document.getElementById('site-footer');
      const footer = footerHost?.querySelector('.site-footer');
      const rect = footer?.getBoundingClientRect();
      const style = footer ? getComputedStyle(footer) : null;
      return {
        width: rect?.width || 0,
        viewportWidth: document.documentElement.clientWidth,
        backgroundImage: style?.backgroundImage || '',
        position: style?.position || '',
        zIndex: style?.zIndex || '',
        isolation: style?.isolation || '',
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (result.width <= 0 || result.width > result.viewportWidth) throw new Error(`${viewport.name}: footer width is invalid`);
    if (!result.backgroundImage.includes('linear-gradient')) throw new Error(`${viewport.name}: Home footer paint is transparent`);
    if (result.position !== 'relative' || result.zIndex !== '2' || result.isolation !== 'isolate') throw new Error(`${viewport.name}: Home footer paint boundary is missing`);
    if (result.overflowX > 1) throw new Error(`${viewport.name}: horizontal overflow ${result.overflowX}px`);
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
