#!/usr/bin/env node

/** Responsive browser smoke for Home/Builds root scrollbar parity. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'css/theme.css'), 'utf8');
const buildsCss = fs.readFileSync(path.join(root, 'js/pages/builds/builds.css'), 'utf8');
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const viewports = [
  { name: 'desktop', width: 1440, height: 900, image: false },
  { name: 'short-desktop', width: 1080, height: 720, image: true },
  { name: 'tablet', width: 768, height: 900, image: true },
  { name: 'mobile', width: 390, height: 844, image: true },
];

const browser = await chromium.launch({ headless: true, executablePath: edgePath });
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>${css}\n${buildsCss}</style></head><body class="page-home"><main style="height:220vh">Home scrollbar smoke</main><div class="builds-feed__list-host" style="height:120px"><div style="height:480px"></div></div></body></html>`);
  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const result = await page.evaluate(() => {
      const feed = document.querySelector('.builds-feed__list-host');
      const rootStyle = getComputedStyle(document.documentElement, '::-webkit-scrollbar');
      const trackStyle = getComputedStyle(document.documentElement, '::-webkit-scrollbar-track');
      const thumbStyle = getComputedStyle(document.documentElement, '::-webkit-scrollbar-thumb');
      const feedRootStyle = feed ? getComputedStyle(feed, '::-webkit-scrollbar') : null;
      const feedTrackStyle = feed ? getComputedStyle(feed, '::-webkit-scrollbar-track') : null;
      const feedThumbStyle = feed ? getComputedStyle(feed, '::-webkit-scrollbar-thumb') : null;
      return {
        width: rootStyle.width,
        height: rootStyle.height,
        trackBackgroundImage: trackStyle.backgroundImage,
        trackBackgroundColor: trackStyle.backgroundColor,
        thumbBorderTop: thumbStyle.borderTopWidth,
        thumbBackgroundColor: thumbStyle.backgroundColor,
        thumbBorderImage: thumbStyle.borderImageSource,
        feedWidth: feedRootStyle?.width || '',
        feedHeight: feedRootStyle?.height || '',
        feedTrackBackgroundImage: feedTrackStyle?.backgroundImage || '',
        feedThumbBorderTop: feedThumbStyle?.borderTopWidth || '',
        feedThumbBackgroundColor: feedThumbStyle?.backgroundColor || '',
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (result.width !== '16px' || result.height !== '16px') {
      throw new Error(`${viewport.name}: expected 16px scrollbar, got ${result.width}x${result.height}`);
    }
    if (result.feedWidth !== result.width || result.feedHeight !== result.height) {
      throw new Error(`${viewport.name}: Home/Builds scrollbar dimensions differ`);
    }
    const homeUsesImageTrack = result.trackBackgroundImage.includes('track.png');
    const buildsUsesImageTrack = result.feedTrackBackgroundImage.includes('track.png');
    if (homeUsesImageTrack !== buildsUsesImageTrack) {
      throw new Error(`${viewport.name}: Home/Builds track modes differ`);
    }
    if (viewport.image) {
      if (!result.trackBackgroundImage.includes('track.png')) {
        throw new Error(`${viewport.name}: image track missing`);
      }
      if (result.thumbBorderTop !== '0px' || result.thumbBackgroundColor !== 'rgb(234, 201, 20)') {
        throw new Error(`${viewport.name}: image thumb chrome mismatch (${JSON.stringify(result)})`);
      }
    } else {
      if (result.trackBackgroundImage !== 'none') {
        throw new Error(`${viewport.name}: desktop image track unexpectedly active`);
      }
      if (result.trackBackgroundColor !== 'rgb(129, 98, 48)') {
        throw new Error(`${viewport.name}: desktop track color mismatch (${result.trackBackgroundColor})`);
      }
      if (result.thumbBorderTop !== '2px' || result.thumbBackgroundColor !== 'rgb(234, 201, 20)') {
        throw new Error(`${viewport.name}: desktop thumb chrome mismatch`);
      }
    }
    if (result.feedThumbBorderTop !== result.thumbBorderTop || result.feedThumbBackgroundColor !== result.thumbBackgroundColor) {
      throw new Error(`${viewport.name}: Home/Builds thumb chrome differs`);
    }
    if (result.overflowX > 1) throw new Error(`${viewport.name}: horizontal overflow ${result.overflowX}px`);
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
