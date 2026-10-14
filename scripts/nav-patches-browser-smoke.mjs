#!/usr/bin/env node

/** Responsive browser smoke for the Patches navbar pennant. */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { navHtml } from '../js/shared/nav/markup.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8825;
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'medium-desktop', width: 1200, height: 800 },
  { name: 'short-desktop', width: 1080, height: 720 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head>
      <link rel="stylesheet" href="/css/theme.css">
      <link rel="stylesheet" href="/css/shared.css">
      <link rel="stylesheet" href="/js/shared/nav.css">
    </head><body data-root="./"><div id="site-nav">${navHtml('./')}</div></body></html>`);
    return;
  }
  const filePath = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = {
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
  }[ext] || 'application/octet-stream';
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
    const result = await page.evaluate(() => {
      const host = document.querySelector('#site-nav');
      const patches = host?.querySelector('.site-nav__patches');
      const image = patches?.querySelector('.site-nav__patches-banner');
      const label = patches?.querySelector('.site-nav__patches-text');
      const drawerLink = host?.querySelector('.site-nav-drawer__link[data-nav-path="patch-notes"]');
      const rect = patches?.getBoundingClientRect();
      const reference = host?.querySelector('.site-nav__events');
      const referenceRect = reference?.getBoundingClientRect();
      return {
        patchesVisible: !!patches && patches.getClientRects().length > 0,
        width: rect?.width || 0,
        height: rect?.height || 0,
        referenceWidth: referenceRect?.width || 0,
        referenceHeight: referenceRect?.height || 0,
        label: label?.textContent || '',
        imageSrc: image?.getAttribute('src') || '',
        imageComplete: image instanceof HTMLImageElement ? image.complete : false,
        drawerLink: drawerLink?.textContent || '',
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (result.label !== 'Patches') throw new Error(`${viewport.name}: Patches label is missing`);
    if (!result.imageSrc.includes('ui-patches-banner.png')) throw new Error(`${viewport.name}: Patches asset is missing`);
    if (!result.imageComplete) throw new Error(`${viewport.name}: Patches asset did not load`);
    if (result.drawerLink !== 'Patches') throw new Error(`${viewport.name}: mobile Patches drawer link is missing`);
    if (viewport.width > 1100 && (!result.patchesVisible || result.width <= 0 || result.height <= 0)) {
      throw new Error(`${viewport.name}: desktop Patches pennant is not visible (${JSON.stringify(result)})`);
    }
    if (viewport.width > 1100 && (Math.abs(result.width - result.referenceWidth) > 1 || Math.abs(result.height - result.referenceHeight) > 1)) {
      throw new Error(`${viewport.name}: Patches pennant does not match the existing banner slot (${JSON.stringify(result)})`);
    }
    if (viewport.width <= 1100 && result.patchesVisible) {
      throw new Error(`${viewport.name}: desktop Patches pennant leaked into mobile navigation`);
    }
    if (result.overflowX > 1) throw new Error(`${viewport.name}: navbar introduced horizontal overflow`);
    results.push({ ...viewport, ...result });
    await page.close();
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
