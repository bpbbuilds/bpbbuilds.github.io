#!/usr/bin/env node

/** Responsive browser smoke for the isolated footer preset gallery. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharedCss = fs.readFileSync(path.join(root, 'css/shared.css'), 'utf8');
const localCss = fs.readFileSync(path.join(root, 'js/pages/admin/footer-presets-test.css'), 'utf8');
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
  await page.setContent(`<!doctype html><html><head><style>${sharedCss}\n${localCss}</style></head><body class="page-admin-footer-presets-test">
    <main id="main"><section class="footer-presets-test">
      <header class="footer-presets-test__intro"><h1>Footer presets</h1></header>
      <div class="footer-presets-test__toolbar"><span class="footer-presets-test__label">Preset</span><div class="footer-presets-test__controls"><button class="footer-presets-test__button is-active">Regular</button><button class="footer-presets-test__button">Slim</button></div></div>
      <section class="footer-presets-test__preview"><footer id="preview" class="site-footer"><div class="site-footer__inner"><p class="site-footer__brand">Backpack Battles Builds</p><p class="site-footer__disclaimer">Unofficial fan site.</p><nav class="site-footer__nav"><a href="#">About</a><a href="#">Builds</a></nav><div class="site-footer__socials"><a class="site-footer__social" href="#"><img alt="" width="40" height="33" /></a></div></div></footer></section>
    </section></main>
  </body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const result = await page.evaluate(() => {
      const toolbar = document.querySelector('.footer-presets-test__toolbar');
      const footer = document.querySelector('#preview');
      const inner = footer?.querySelector('.site-footer__inner');
      footer?.classList.remove('site-footer--slim');
      inner?.classList.remove('site-footer__inner--slim');
      const toolbarRect = toolbar?.getBoundingClientRect();
      const regularHeight = footer?.getBoundingClientRect().height || 0;
      const regularPaddingTop = footer ? getComputedStyle(footer).paddingTop : '';
      if (footer) footer.classList.add('site-footer--slim');
      if (inner) inner.classList.add('site-footer__inner--slim');
      const slimHeight = footer?.getBoundingClientRect().height || 0;
      const slimPaddingTop = footer ? getComputedStyle(footer).paddingTop : '';
      const slimInnerDisplay = inner ? getComputedStyle(inner).display : '';
      return {
        toolbarWidth: toolbarRect?.width || 0,
        viewportWidth: document.documentElement.clientWidth,
        centered: toolbarRect ? Math.abs((toolbarRect.left + toolbarRect.width / 2) - document.documentElement.clientWidth / 2) < 1 : false,
        regularHeight,
        slimHeight,
        regularPaddingTop,
        slimPaddingTop,
        slimInnerDisplay,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (result.toolbarWidth <= 0 || result.toolbarWidth > result.viewportWidth) throw new Error(`${viewport.name}: toolbar overflows viewport`);
    if (!result.centered) throw new Error(`${viewport.name}: preset toolbar is not centered`);
    if (result.regularPaddingTop === result.slimPaddingTop || result.slimInnerDisplay !== 'grid') throw new Error(`${viewport.name}: regular/slim styles did not differ (${JSON.stringify(result)})`);
    if (result.overflowX > 1) throw new Error(`${viewport.name}: horizontal overflow ${result.overflowX}px`);
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
