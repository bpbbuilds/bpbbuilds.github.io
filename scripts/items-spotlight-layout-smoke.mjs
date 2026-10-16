#!/usr/bin/env node

/** Regression for the clicked-item spotlight tooltip's desktop safe area. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = 8834;
const viewports = [
  { name: '1440p', width: 1440, height: 900, navHeight: 250, buildsTop: 716 },
  { name: '1080p', width: 1920, height: 1080, navHeight: 295, buildsTop: 850 },
  { name: 'short-desktop', width: 1366, height: 768, navHeight: 252, buildsTop: 580 },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #1e1714; }
        #site-nav { position: fixed; inset: 0 0 auto; height: var(--nav-height); z-index: 50; background: #5c4030; }
        .items-bag { position: absolute; left: 48%; top: 42%; width: 80px; height: 80px; }
        [data-stage] { position: fixed; left: 50%; top: 48%; width: 80px; height: 80px; }
        .il-spotlight-builds { position: fixed; inset: var(--builds-top) 4% auto; height: 120px; z-index: 70; }
        .bpb-tooltip-float { --bpb-tooltip-scale: 1; position: fixed; z-index: 10040; left: 0; top: 0; transform: translate3d(0, 0, 0) scale(var(--bpb-tooltip-scale)); transform-origin: top left; }
        .bpb-tooltip { width: 606px; height: 680px; max-width: 606px; background: #5c4030; border: 2px solid #3c261d; color: #ffecdc; }
      </style>
    </head><body>
      <div id="site-nav"></div>
      <div class="items-bag"></div>
      <div data-stage></div>
      <aside class="il-spotlight-builds"></aside>
    </body></html>`);
    return;
  }

  const filePath = path.resolve(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const contentType = path.extname(filePath) === '.js'
    ? 'text/javascript; charset=utf-8'
    : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ navHeight, buildsTop }) => {
      document.documentElement.style.setProperty('--nav-height', `${navHeight}px`);
      document.documentElement.style.setProperty('--builds-top', `${buildsTop}px`);
    }, viewport);

    const result = await page.evaluate(async () => {
      window.ItemTooltip = {
        render() {
          const card = document.createElement('div');
          card.className = 'bpb-tooltip';
          card.textContent = 'Spotlight fixture';
          return card;
        },
      };
      const { createTooltipHover } = await import('/js/shared/tooltip-hover.js');
      const tip = createTooltipHover();
      const stage = document.querySelector('[data-stage]');
      tip.lock({ name: 'Spotlight fixture' }, {
        stage,
        bounds: () => {
          const nav = document.querySelector('#site-nav').getBoundingClientRect();
          const builds = document.querySelector('.il-spotlight-builds').getBoundingClientRect();
          return {
            top: nav.bottom + 12,
            bottom: builds.top - 12,
            left: 12,
            right: window.innerWidth - 12,
          };
        },
      });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const rect = tip.host.getBoundingClientRect();
      const nav = document.querySelector('#site-nav').getBoundingClientRect();
      const builds = document.querySelector('.il-spotlight-builds').getBoundingClientRect();
      return {
        host: { top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        nav: { bottom: nav.bottom },
        builds: { top: builds.top },
        scale: getComputedStyle(tip.host).getPropertyValue('--bpb-tooltip-scale'),
      };
    });

    const gap = 12;
    assert.ok(
      result.host.top >= result.nav.bottom + gap - 1,
      `${viewport.name}: tooltip overlaps the navigation: ${JSON.stringify(result)}`,
    );
    assert.ok(
      result.host.bottom <= result.builds.top - gap + 1,
      `${viewport.name}: tooltip overlaps the Builds using this item panel: ${JSON.stringify(result)}`,
    );
    assert.ok(
      result.host.right <= viewport.width - gap + 1,
      `${viewport.name}: tooltip exceeds the viewport: ${JSON.stringify(result)}`,
    );
    assert.ok(
      Number(result.scale) < 1,
      `${viewport.name}: oversized fixture must be fitted into the spotlight safe area: ${JSON.stringify(result)}`,
    );
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('Items spotlight layout smoke passed.');
