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
    <main id="main"><section id="home-builds-vault"><div class="home-vault"><div class="home-vault__band"><div style="height:1200px"></div></div></div></section></main>
    <div id="site-footer"><footer class="site-footer"><div class="site-footer__inner"><p class="site-footer__brand">Backpack Battles Builds</p><p class="site-footer__disclaimer">Unofficial fan site.</p><nav class="site-footer__nav"><a href="#">About</a><a href="#">Builds</a></nav><div class="site-footer__socials"></div></div></footer></div>
  </body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const result = await page.evaluate(() => {
      const footerHost = document.getElementById('site-footer');
      const footer = footerHost?.querySelector('.site-footer');
      const rect = footer?.getBoundingClientRect();
      const vaultBand = document.querySelector('.home-vault__band');
      const vaultRect = vaultBand?.getBoundingClientRect();
      const footerHostStyle = footerHost ? getComputedStyle(footerHost) : null;
      const style = footer ? getComputedStyle(footer) : null;
      const backgroundStyle = footer ? getComputedStyle(footer, '::before') : null;
      return {
        width: rect?.width || 0,
        viewportWidth: document.documentElement.clientWidth,
        height: rect?.height || 0,
        vaultBottom: vaultRect?.bottom || 0,
        footerTop: rect?.top || 0,
        overlapPx: vaultRect && rect ? vaultRect.bottom - rect.top : 0,
        footerHostPosition: footerHostStyle?.position || '',
        footerHostZIndex: footerHostStyle?.zIndex || '',
        footerHostBackgroundImage: footerHostStyle?.backgroundImage || '',
        footerHostBackgroundColor: footerHostStyle?.backgroundColor || '',
        backgroundImage: style?.backgroundImage || '',
        backgroundSize: style?.backgroundSize || '',
        backgroundColor: style?.backgroundColor || '',
        backgroundPseudoImage: backgroundStyle?.backgroundImage || '',
        backgroundPseudoSize: backgroundStyle?.backgroundSize || '',
        backgroundPseudoMask: backgroundStyle?.webkitMaskImage || backgroundStyle?.maskImage || '',
        backgroundPseudoMaskSize: backgroundStyle?.webkitMaskSize || backgroundStyle?.maskSize || '',
        backgroundPseudoTop: backgroundStyle?.top || '',
        backgroundPseudoRight: backgroundStyle?.right || '',
        backgroundPseudoBottom: backgroundStyle?.bottom || '',
        backgroundPseudoLeft: backgroundStyle?.left || '',
        position: style?.position || '',
        zIndex: style?.zIndex || '',
        isolation: style?.isolation || '',
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (result.width <= 0 || result.width > result.viewportWidth) throw new Error(`${viewport.name}: footer width is invalid`);
    if (viewport.name === 'mobile') {
      if (!result.backgroundImage.includes('bg-dark-textured.webp') || result.backgroundColor === 'rgba(0, 0, 0, 0)') throw new Error(`${viewport.name}: unmasked mobile footer needs its opaque textured base (${JSON.stringify(result)})`);
    } else if (result.backgroundImage !== 'none' || result.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      throw new Error(`${viewport.name}: Home footer base must stay transparent so the masked side curves remain visible (${JSON.stringify(result)})`);
    }
    if (!result.backgroundPseudoImage.includes('bg-dark-textured.webp')) throw new Error(`${viewport.name}: Home footer is missing the textured-black background`);
    if (result.backgroundPseudoSize !== 'cover') throw new Error(`${viewport.name}: Home footer texture is not responsive`);
    const expectedMaskSize = viewport.name === 'desktop' || viewport.name === 'short-desktop' ? '320px 24px' : viewport.name === 'tablet' ? '100px 25px' : '';
    if (viewport.name === 'mobile') {
      if (result.backgroundPseudoMask !== 'none') throw new Error(`${viewport.name}: Home footer should use a plain textured surface`);
    } else {
      if (!result.backgroundPseudoMask.includes('data:image/svg+xml')) throw new Error(`${viewport.name}: Home footer is missing the inverted top curve mask`);
      if (!result.backgroundPseudoMaskSize.includes(expectedMaskSize)) throw new Error(`${viewport.name}: Home footer edge mask is not fixed to ${expectedMaskSize}`);
    }
    if (result.height <= 0 || result.backgroundPseudoTop !== '0px' || result.backgroundPseudoRight !== '0px' || result.backgroundPseudoBottom !== '0px' || result.backgroundPseudoLeft !== '0px') throw new Error(`${viewport.name}: Home footer background layer does not cover the full footer bounds`);
    if (result.position !== 'relative' || result.zIndex !== '2' || result.isolation !== 'isolate') throw new Error(`${viewport.name}: Home footer paint boundary is missing`);
    if (viewport.name === 'mobile') {
      if (result.overlapPx !== 0) throw new Error(`${viewport.name}: unmasked footer should not overlap the loadout band (${JSON.stringify(result)})`);
      if (!result.footerHostBackgroundImage.includes('bg-dark-textured.webp')) throw new Error(`${viewport.name}: unmasked footer underlay should stay textured (${JSON.stringify(result)})`);
    } else {
      const expectedOverlap = viewport.name === 'tablet' ? 25 : 24;
      if (Math.abs(result.overlapPx - expectedOverlap) > 1) throw new Error(`${viewport.name}: footer does not sit ${expectedOverlap}px over the curated loadout background (${JSON.stringify(result)})`);
      if (result.footerHostPosition !== 'relative' || result.footerHostZIndex !== '10') throw new Error(`${viewport.name}: footer host is not the top overlap layer (${JSON.stringify(result)})`);
      if (result.footerHostBackgroundImage !== 'none' || result.footerHostBackgroundColor !== 'rgba(0, 0, 0, 0)') throw new Error(`${viewport.name}: footer host must stay transparent so the dip reveals the loadout scene (${JSON.stringify(result)})`);
    }
    if (result.overflowX > 1) throw new Error(`${viewport.name}: horizontal overflow ${result.overflowX}px`);
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
