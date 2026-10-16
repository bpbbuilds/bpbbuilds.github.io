#!/usr/bin/env node

/** Browser smoke for the shared navigation desktop density tiers. */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { navHtml } from '../js/shared/nav/markup.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8828;
const viewports = [
  { name: 'reference-1440p', width: 2560, height: 1440, expected: 1 },
  { name: '1080p', width: 1920, height: 1080, expected: 0.8625 },
  { name: 'short-desktop', width: 1600, height: 900, expected: 0.71875 },
  { name: 'hd-desktop', width: 1366, height: 768, expected: (768 / 1440) * 1.15 },
  { name: 'tablet', width: 1024, height: 768, expected: 1 },
  { name: 'mobile', width: 390, height: 844, expected: 1 },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="/css/theme.css">
      <link rel="stylesheet" href="/css/shared.css">
      <link rel="stylesheet" href="/js/shared/nav.css">
    </head><body data-root="./"><div id="site-nav">${navHtml('./')}</div></body></html>`);
    return;
  }

  const filePath = path.resolve(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = {
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
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
    const result = await page.evaluate(async () => {
      const { navDesktopScale } = await import('/js/shared/nav.js');
      const host = document.querySelector('#site-nav');
      const shell = host?.querySelector('.site-nav-shell');
      if (!(host instanceof HTMLElement) || !(shell instanceof HTMLElement)) throw new Error('nav fixture missing');

      const expected = navDesktopScale(innerWidth, innerHeight);
      host.style.setProperty('--bpb-nav-desktop-scale', String(expected));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const rect = shell.getBoundingClientRect();
      const rail = host.querySelector('.site-nav__rail');
      return {
        expected,
        cssScale: Number.parseFloat(getComputedStyle(host).getPropertyValue('--bpb-nav-desktop-scale')),
        transform: getComputedStyle(shell).transform,
        width: rect.width,
        height: rect.height,
        desktopRailVisible: rail instanceof HTMLElement && rail.getClientRects().length > 0,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    if (Math.abs(result.expected - viewport.expected) > 0.0001) {
      throw new Error(`${viewport.name}: unexpected scale ${JSON.stringify(result)}`);
    }
    if (Math.abs(result.cssScale - viewport.expected) > 0.0001) {
      throw new Error(`${viewport.name}: CSS scale did not apply ${JSON.stringify(result)}`);
    }
    if (viewport.width > 1100 && !result.desktopRailVisible) {
      throw new Error(`${viewport.name}: desktop shelf rail is hidden`);
    }
    if (viewport.width <= 1100 && result.desktopRailVisible) {
      throw new Error(`${viewport.name}: desktop shelf rail leaked into mobile navigation`);
    }
    if (result.overflowX > 1) throw new Error(`${viewport.name}: navigation introduced horizontal overflow`);
    results.push({ ...viewport, ...result });
    await page.close();
  }

  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
