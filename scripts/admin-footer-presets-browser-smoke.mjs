#!/usr/bin/env node

/** Responsive browser smoke for the isolated footer preset gallery. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const themeCss = fs.readFileSync(path.join(root, 'css/theme.css'), 'utf8');
const sharedCss = fs.readFileSync(path.join(root, 'css/shared.css'), 'utf8');
const presetCss = fs.readFileSync(path.join(root, 'js/shared/button-preset.css'), 'utf8');
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
  await page.setContent(`<!doctype html><html><head><style>${themeCss}\n${sharedCss}\n${presetCss}\n${localCss}</style></head><body class="page-admin-footer-presets-test">
    <main id="main"><section class="footer-presets-test">
      <header class="footer-presets-test__intro"><h1>Footer presets</h1></header>
      <div class="footer-presets-test__toolbar"><span class="footer-presets-test__label">Preset</span><div class="footer-presets-test__controls"><button class="footer-presets-test__button is-active">Regular</button><button class="footer-presets-test__button">Slim</button></div></div>
      <section class="footer-presets-test__preview"><footer id="preview" class="site-footer"><div class="site-footer__inner"><p class="site-footer__brand">Backpack Battles Builds</p><p class="site-footer__disclaimer">Unofficial fan site.</p><nav class="site-footer__nav"><a class="home-preset-button site-footer__nav-link site-footer__nav-link--legal" href="#">About</a><a class="home-preset-button home-preset-button--blue site-footer__nav-link site-footer__nav-link--catalog" href="#">Builds</a></nav><div class="site-footer__socials"><a class="site-footer__social" href="#"><img alt="" width="40" height="33" /></a></div></div></footer></section>
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
      const regularNavLink = footer?.querySelector('.site-footer__nav a');
      const regularCatalogLink = footer?.querySelector('.site-footer__nav-link--catalog');
      const regularNavStyle = regularNavLink ? getComputedStyle(regularNavLink) : null;
      const regularCatalogStyle = regularCatalogLink ? getComputedStyle(regularCatalogLink) : null;
      if (footer) footer.classList.add('site-footer--slim');
      if (inner) inner.classList.add('site-footer__inner--slim');
      const slimHeight = footer?.getBoundingClientRect().height || 0;
      const slimPaddingTop = footer ? getComputedStyle(footer).paddingTop : '';
      const slimPaddingBottom = footer ? getComputedStyle(footer).paddingBottom : '';
      const frameEdgeY = window.innerWidth <= 1100 ? 0 : window.innerHeight * 40 / 1080;
      const slimContentToFrameBottom = Math.max(0, parseFloat(slimPaddingBottom) - frameEdgeY);
      const slimInnerDisplay = inner ? getComputedStyle(inner).display : '';
      const slimNavLink = footer?.querySelector('.site-footer__nav a');
      const slimCatalogLink = footer?.querySelector('.site-footer__nav-link--catalog');
      const slimNavStyle = slimNavLink ? getComputedStyle(slimNavLink) : null;
      const slimCatalogStyle = slimCatalogLink ? getComputedStyle(slimCatalogLink) : null;
      return {
        toolbarWidth: toolbarRect?.width || 0,
        viewportWidth: document.documentElement.clientWidth,
        centered: toolbarRect ? Math.abs((toolbarRect.left + toolbarRect.width / 2) - document.documentElement.clientWidth / 2) < 1 : false,
        regularHeight,
        slimHeight,
        regularPaddingTop,
        slimPaddingTop,
        slimPaddingBottom,
        frameEdgeY,
        slimContentToFrameBottom,
        slimInnerDisplay,
        regularNavDisplay: regularNavStyle?.display || '',
        regularNavBackgroundImage: regularNavStyle?.backgroundImage || '',
        regularNavShadow: regularNavStyle?.boxShadow || '',
        regularNavRadius: regularNavStyle?.borderRadius || '',
        regularNavMinHeight: regularNavStyle ? parseFloat(regularNavStyle.minHeight) || 0 : 0,
        regularCatalogBackgroundImage: regularCatalogStyle?.backgroundImage || '',
        slimNavDisplay: slimNavStyle?.display || '',
        slimNavBackgroundImage: slimNavStyle?.backgroundImage || '',
        slimNavShadow: slimNavStyle?.boxShadow || '',
        slimNavRadius: slimNavStyle?.borderRadius || '',
        slimNavMinHeight: slimNavStyle ? parseFloat(slimNavStyle.minHeight) || 0 : 0,
        slimCatalogBackgroundImage: slimCatalogStyle?.backgroundImage || '',
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (result.toolbarWidth <= 0 || result.toolbarWidth > result.viewportWidth) throw new Error(`${viewport.name}: toolbar overflows viewport`);
    if (!result.centered) throw new Error(`${viewport.name}: preset toolbar is not centered`);
    if (result.regularPaddingTop === result.slimPaddingTop || result.slimInnerDisplay !== 'grid') throw new Error(`${viewport.name}: regular/slim styles did not differ (${JSON.stringify(result)})`);
    if (Math.abs(result.slimContentToFrameBottom - parseFloat(result.slimPaddingTop)) > 0.75) throw new Error(`${viewport.name}: slim footer content is not vertically balanced against the frame (${JSON.stringify(result)})`);
    for (const mode of ['regular', 'slim']) {
      if (!['flex', 'inline-flex'].includes(result[`${mode}NavDisplay`] ) || !result[`${mode}NavBackgroundImage`].includes('linear-gradient') || !result[`${mode}NavShadow`].includes('inset') || result[`${mode}NavRadius`] !== '999px' || result[`${mode}NavMinHeight`] <= 0) {
        throw new Error(`${viewport.name}: ${mode} footer navigation links are not preset pills (${JSON.stringify(result)})`);
      }
      if (!result[`${mode}CatalogBackgroundImage`].includes('linear-gradient') || result[`${mode}CatalogBackgroundImage`] === result[`${mode}NavBackgroundImage`]) throw new Error(`${viewport.name}: ${mode} catalog link is missing its distinct blue preset variant (${JSON.stringify(result)})`);
    }
    if (result.overflowX > 1) throw new Error(`${viewport.name}: horizontal overflow ${result.overflowX}px`);
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
