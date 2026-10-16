#!/usr/bin/env node

/** Regression for Items content hidden behind the fixed navigation host. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { navHtml } from '../js/shared/nav/markup.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = 8833;
const viewports = [
  { name: '1440p', width: 2560, height: 1440 },
  { name: '1080p', width: 1920, height: 1080 },
  { name: 'short-desktop', width: 1366, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="/css/theme.css">
      <link rel="stylesheet" href="/js/shared/nav.css">
      <style>
        #items-catalog { position: relative; height: 100%; }
        .items-layout { position: relative; height: 100%; }
        .items-filters { position: absolute; top: 0; right: 2rem; width: 18rem; height: 5rem; z-index: 5; background: #4a3428; }
        .items-bag { position: absolute; top: 0; left: 2rem; width: 12rem; height: 8rem; z-index: 1; background: #9a7352; }
        .items-filters button, .items-bag button { position: absolute; inset: 0; width: 100%; height: 100%; }
      </style>
    </head><body class="page-items" data-root="./">
      <div id="site-nav">${navHtml('./')}</div>
      <div id="site-nav-space" aria-hidden="true"></div>
      <main id="main"><section id="items-catalog"><div class="items-layout">
        <div class="items-filters"><button type="button" data-grouping>Grouping</button></div>
        <div class="items-bag"><button type="button" data-first-item>First item</button></div>
      </div></section></main>
      <script>window.groupClicks=0;window.itemClicks=0;document.querySelector('[data-grouping]').onclick=()=>window.groupClicks++;document.querySelector('[data-first-item]').onclick=()=>window.itemClicks++;</script>
    </body></html>`);
    return;
  }

  const filePath = path.resolve(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const contentType = {
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
  }[path.extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

function desktopScale(width, height) {
  if (width <= 1100) return 1;
  const base = Math.min(1, width / 2560, height / 1440);
  const progress = Math.max(0, Math.min(1, (1440 - height) / 360));
  return Math.min(1, base * (1 + 0.15 * progress));
}

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });
    await page.evaluate(({ width, height, navScale }) => {
      const host = document.querySelector('#site-nav');
      const shell = document.querySelector('.site-nav-shell');
      const space = document.querySelector('#site-nav-space');
      if (!(host instanceof HTMLElement) || !(shell instanceof HTMLElement) || !(space instanceof HTMLElement)) {
        throw new Error('navigation fixture missing');
      }
      host.style.setProperty('--bpb-nav-desktop-scale', String(navScale));
      const shellBottom = shell.getBoundingClientRect().bottom;
      space.style.height = `${Math.ceil(shellBottom)}px`;
      document.documentElement.dataset.viewport = `${width}x${height}`;
    }, { ...viewport, navScale: desktopScale(viewport.width, viewport.height) });
    await page.waitForTimeout(50);

    const result = await page.evaluate(() => {
      const group = document.querySelector('[data-grouping]');
      const item = document.querySelector('[data-first-item]');
      if (!(group instanceof HTMLElement) || !(item instanceof HTMLElement)) throw new Error('Items fixture missing');
      const center = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
      const groupPoint = center(group);
      const itemPoint = center(item);
      const navHost = document.querySelector('#site-nav');
      return {
        navPointerEvents: navHost ? getComputedStyle(navHost).pointerEvents : '',
        groupReachable: document.elementFromPoint(groupPoint.x, groupPoint.y)?.matches('[data-grouping]') || false,
        itemReachable: document.elementFromPoint(itemPoint.x, itemPoint.y)?.matches('[data-first-item]') || false,
        groupPoint,
        itemPoint,
      };
    });

    const group = page.locator('[data-grouping]');
    const item = page.locator('[data-first-item]');
    await group.click({ position: { x: 10, y: 10 } });
    await item.click({ position: { x: 10, y: 10 } });
    const clicks = await page.evaluate(() => ({ group: window.groupClicks, item: window.itemClicks }));
    assert.equal(result.navPointerEvents, 'none', `${viewport.name}: fixed navigation host must not capture content clicks`);
    assert.equal(result.groupReachable, true, `${viewport.name}: grouping section is reachable beneath the nav`);
    if (viewport.width > 1100) {
      assert.equal(result.itemReachable, true, `${viewport.name}: first item row is reachable beneath the nav`);
    }
    assert.equal(clicks.group, 1, `${viewport.name}: grouping control receives clicks`);
    assert.equal(clicks.item, 1, `${viewport.name}: first item receives clicks`);
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('Items navigation pointer smoke passed.');
