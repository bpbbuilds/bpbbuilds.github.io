#!/usr/bin/env node

/** Browser smoke for the consolidated Player Info loading skeleton surfaces. */

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
    res.end(`<!doctype html><html><head><link rel="stylesheet" href="/js/shared/skeleton.css"><link rel="stylesheet" href="/js/pages/home/home-promo-band.css"><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0}</style></head><body data-root="/"><div id="probe"></div></body></html>`);
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
    const result = await page.evaluate(() => ({
      sectionSkeletons: document.querySelectorAll('[data-promo-section-skeleton]').length,
      nestedSkeletons: document.querySelectorAll('.home-promo .home-promo__skel-item, .home-promo .home-promo__skel-section, .home-promo .home-promo__skel-board, .home-promo .home-promo__skel-class, .home-promo .home-promo__skel-title, .home-promo .home-promo__info-grid').length,
      statusRegions: document.querySelectorAll('.home-promo--player-info .bpb-skel-region[role="status"], .home-promo--player-info [data-promo-section-skeleton][role="status"]').length,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    assert.equal(result.sectionSkeletons, 1, `${viewport.name}: Player Info uses one whole-section skeleton`);
    assert.equal(result.nestedSkeletons, 0, `${viewport.name}: Player Info does not render nested skeleton fragments`);
    assert.equal(result.statusRegions, 1, `${viewport.name}: Player Info exposes one loading status for the Home section`);
    assert.ok(result.overflowX <= 1, `${viewport.name}: skeleton introduced horizontal overflow`);
    results.push({ ...viewport, ...result });
    await page.close();
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
