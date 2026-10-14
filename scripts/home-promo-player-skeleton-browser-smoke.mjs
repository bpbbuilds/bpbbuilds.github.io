#!/usr/bin/env node

/** Browser smoke proving Player Info starts without a loading skeleton. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8815;
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'short-desktop', width: 1080, height: 720 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><link rel="stylesheet" href="/js/shared/skeleton.css"><link rel="stylesheet" href="/js/pages/home/home-promo-band.css"><style>*,*::before,*::after{box-sizing:border-box}:root{--bpb-frame-edge-x:calc(100vw * 40 / 1920)}html,body{margin:0;padding:0}#probe{padding-inline:var(--bpb-frame-edge-x)}@media(max-width:1100px){:root{--bpb-frame-edge-x:0px}#probe{padding-inline:0}}</style></head><body data-root="/"><div id="probe"></div></body></html>`);
    return;
  }
  const filePath = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath);
  const contentType = ext === '.js'
    ? 'text/javascript'
    : ext === '.css'
      ? 'text/css'
      : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const results = [];
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const { initHomePromoBand } = await import('/js/pages/home/home-promo-band.js');
      initHomePromoBand('#probe', { variant: 'create', launcher: 'player', builds: [] });
    });
    const result = await page.evaluate(() => {
      const section = document.querySelector('.home-promo--player-info');
      const style = section instanceof HTMLElement ? getComputedStyle(section) : null;
      const bounds = section instanceof HTMLElement ? section.getBoundingClientRect() : null;
      return {
        skeletonStacks: document.querySelectorAll('[data-promo-skeleton-stack]').length,
        skeletons: document.querySelectorAll('.home-promo--player-info [data-promo-skeleton-stack] .bpb-skel').length,
        skeletonRects: [...document.querySelectorAll('.home-promo--player-info [data-promo-skeleton-stack] .bpb-skel')].map((el) => {
          const rect = el.getBoundingClientRect();
          return { className: el.className, width: rect.width, height: rect.height };
        }),
        legacySkeletons: document.querySelectorAll('[data-promo-section-skeleton], .home-promo__section-skeleton').length,
        statusRegions: document.querySelectorAll('.home-promo--player-info [data-promo-skeleton-stack][role="status"]').length,
        backgroundImage: style?.backgroundImage || '',
        backgroundColor: style?.backgroundColor || '',
        edgeMask: style?.webkitMaskImage || style?.maskImage || '',
        cardBackgroundImage: getComputedStyle(document.querySelector('.home-promo--player-info .home-promo__card')).backgroundImage,
        cardBackgroundColor: getComputedStyle(document.querySelector('.home-promo--player-info .home-promo__card')).backgroundColor,
        cardBorder: getComputedStyle(document.querySelector('.home-promo--player-info .home-promo__card')).borderTopColor,
        cardBorderWidth: getComputedStyle(document.querySelector('.home-promo--player-info .home-promo__card')).borderTopWidth,
        cardRadius: getComputedStyle(document.querySelector('.home-promo--player-info .home-promo__card')).borderTopLeftRadius,
        left: bounds?.left ?? -1,
        right: bounds?.right ?? -1,
        viewportWidth: window.innerWidth,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert.equal(result.skeletonStacks, 0, `${viewport.name}: Player Info has no skeleton stack`);
    assert.equal(result.skeletons, 0, `${viewport.name}: Player Info has no skeleton surfaces`);
    assert.equal(result.skeletonRects.length, 0, `${viewport.name}: Player Info does not reserve skeleton geometry`);
    assert.equal(result.legacySkeletons, 0, `${viewport.name}: Player Info has no legacy whole-section skeleton`);
    assert.equal(result.statusRegions, 0, `${viewport.name}: Player Info exposes no loading status for a skeleton`);
    assert.equal(result.backgroundImage, 'none', `${viewport.name}: Player Info section has no decorative background image`);
    assert.equal(result.backgroundColor, 'rgba(0, 0, 0, 0)', `${viewport.name}: Player Info section has a transparent background`);
    assert.match(result.cardBackgroundImage, /radial-gradient/, `${viewport.name}: Player Info card uses the dark hero gradient`);
    assert.equal(result.cardBackgroundColor, 'rgb(20, 17, 15)', `${viewport.name}: Player Info card has the dark fallback fill`);
    assert.equal(result.cardBorder, 'rgb(58, 50, 44)', `${viewport.name}: Player Info card has the outlined hero edge`);
    assert.equal(result.cardBorderWidth, '1px', `${viewport.name}: Player Info card outline stays thin`);
    assert.equal(result.cardRadius, '24px', `${viewport.name}: Player Info card keeps the hero-card radius`);
    assert.equal(result.edgeMask, 'none', `${viewport.name}: Player Info has no decorative edge mask`);
    assert.ok(result.overflowX <= 1, `${viewport.name}: skeleton introduced horizontal overflow`);
    results.push({ ...viewport, ...result });
    await page.close();
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
