#!/usr/bin/env node

/** Browser regression for the paused-to-animated Home windmill handoff. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = 8838;
const viewports = [
  { name: '1440p-reference', width: 2560, height: 1440 },
  { name: '1080p', width: 1920, height: 1080 },
  { name: 'short-desktop', width: 1366, height: 768 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="/js/pages/home/combat-sky.css">
    </head><body class="page-home">
      <div class="combat-sky combat-sky--preload" data-combat-sky-preload aria-hidden="true">
        <div class="combat-sky__stage">
          <div class="combat-sky__windmill" data-layer="windmill" style="--x:1062px;--y:371px;--w:82px;--h:162px;--sy:1.012">
            <div class="combat-sky__windmill-tower" style="-webkit-mask-image:url('/assets/theme/backgrounds/combat/Windmill.png');mask-image:url('/assets/theme/backgrounds/combat/Windmill.png')"></div>
            <div class="combat-sky__blade-pivot">
              <div class="combat-sky__blades" style="-webkit-mask-image:url('/assets/theme/backgrounds/combat/WindmillBlades.png');mask-image:url('/assets/theme/backgrounds/combat/WindmillBlades.png')"></div>
            </div>
          </div>
        </div>
      </div>
    </body></html>`);
    return;
  }

  const filePath = path.resolve(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const contentType = path.extname(filePath) === '.css'
    ? 'text/css; charset=utf-8'
    : path.extname(filePath) === '.js'
      ? 'text/javascript; charset=utf-8'
      : 'image/png';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
      const host = document.querySelector('[data-combat-sky-preload]');
      const stage = host?.querySelector('.combat-sky__stage');
      const blades = host?.querySelector('.combat-sky__blades');
      if (!(host instanceof HTMLElement) || !(stage instanceof HTMLElement) || !(blades instanceof HTMLElement)) {
        throw new Error('windmill preload fixture missing');
      }
      const { initCombatSky } = await import('/js/pages/home/combat-sky/index.js');
      initCombatSky();
      const before = {
        animation: getComputedStyle(blades).animationName,
        width: stage.getBoundingClientRect().width,
        height: stage.getBoundingClientRect().height,
      };
      const started = Date.now();
      while (host.classList.contains('combat-sky--preload') && Date.now() - started < 3000) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const after = {
        animation: getComputedStyle(blades).animationName,
        paused: host.classList.contains('combat-sky--preload'),
      };
      return { before, after };
    });
    const scale = Math.max(viewport.width / 1920, viewport.height / 1080);
    assert.equal(
      result.before.animation,
      'none',
      `${viewport.name}: first-paint windmill must be paused: ${JSON.stringify(result)}`,
    );
    assert.ok(
      Math.abs(result.before.width - 1920 * scale) < 1,
      `${viewport.name}: preload stage width is not responsive: ${JSON.stringify(result)}`,
    );
    assert.ok(
      Math.abs(result.before.height - 1080 * scale) < 1,
      `${viewport.name}: preload stage height is not responsive: ${JSON.stringify(result)}`,
    );
    assert.equal(
      result.after.animation,
      'combat-sky-spin',
      `${viewport.name}: live handoff must restore blade animation: ${JSON.stringify(result)}`,
    );
    assert.equal(
      result.after.paused,
      false,
      `${viewport.name}: windmill assets did not complete the live handoff: ${JSON.stringify(result)}`,
    );
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('Home windmill first-paint browser smoke passed.');
