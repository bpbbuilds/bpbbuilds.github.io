#!/usr/bin/env node

/** Verify Build-view Build Info item tooltips prefer a full-size left placement near the right edge. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildPageSource = fs.readFileSync(path.join(root, 'js/pages/build/page.js'), 'utf8');
assert.match(
  buildPageSource,
  /if \(infoRail\) \{[\s\S]*?place:\s*'itemLeft'/,
  'Build Info item tooltip binding does not use left-side placement',
);

const port = 8841;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><style>
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: #211714; }
      .build-info { position: fixed; inset: 96px 0 auto auto; width: 120px; height: 520px; }
      [data-item-id] { position: fixed; left: calc(100vw - 72px); top: 180px; width: 48px; height: 48px; }
      .bpb-tooltip-float {
        --bpb-tooltip-scale: 1;
        position: fixed;
        z-index: 10020;
        left: 0;
        top: 0;
        transform: scale(var(--bpb-tooltip-scale));
        transform-origin: top left;
      }
      .bpb-tooltip { width: 584px; height: 320px; padding: 16px; background: #5c4030; color: #ffecdc; }
    </style></head><body>
      <aside class="build-info"><span data-item-id="smoke-item" tabindex="0"></span></aside>
    </body></html>`);
    return;
  }
  const filePath = path.resolve(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const contentType = path.extname(filePath) === '.js' ? 'text/javascript; charset=utf-8' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of [
    { name: '1440p', width: 1440, height: 900 },
    { name: '1080p', width: 1920, height: 1080 },
    { name: 'tablet', width: 1024, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      window.ItemTooltip = {
        render() {
          const card = document.createElement('div');
          card.className = 'bpb-tooltip';
          card.textContent = 'Build Info item';
          return card;
        },
      };
      const { createTooltipHover } = await import('/js/shared/tooltip-hover.js');
      const root = document.querySelector('.build-info');
      const tip = createTooltipHover();
      tip.bind(root, {
        selector: '[data-item-id]',
        getItem: () => ({ name: 'Build Info item' }),
        place: 'itemLeft',
      });
      window.buildInfoTip = tip;
    });
    await page.locator('[data-item-id]').hover();
    await page.waitForFunction(() => document.querySelector('.bpb-tooltip-float.is-visible'));
    const result = await page.evaluate(() => {
      const anchor = document.querySelector('[data-item-id]');
      const tip = window.buildInfoTip?.host;
      if (!(anchor instanceof HTMLElement) || !(tip instanceof HTMLElement)) throw new Error('tooltip fixture missing');
      const anchorRect = anchor.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();
      return {
        anchorLeft: anchorRect.left,
        tooltipLeft: tipRect.left,
        tooltipRight: tipRect.right,
        tooltipWidth: tipRect.width,
        scale: Number.parseFloat(getComputedStyle(tip).getPropertyValue('--bpb-tooltip-scale')) || 0,
        viewportWidth: window.innerWidth,
      };
    });

    assert.ok(result.tooltipLeft < result.anchorLeft, `${viewport.name}: tooltip did not move left of the Build Info item`);
    assert.ok(result.tooltipRight <= result.viewportWidth - 8 + 1, `${viewport.name}: tooltip exceeds the viewport: ${JSON.stringify(result)}`);
    if (viewport.width >= 1440) {
      assert.ok(result.scale >= 0.98, `${viewport.name}: desktop tooltip was unnecessarily shrunk: ${JSON.stringify(result)}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('Build view info tooltip placement smoke passed.');
