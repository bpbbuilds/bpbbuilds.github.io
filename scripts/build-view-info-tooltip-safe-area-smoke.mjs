#!/usr/bin/env node

/** Verify oversized Build Info tooltips fit above the footer and inside the screen frame. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildPageSource = fs.readFileSync(path.join(root, 'js/pages/build/page.js'), 'utf8');
const hoverSource = fs.readFileSync(path.join(root, 'js/shared/tooltip-hover.js'), 'utf8');

assert.match(buildPageSource, /function getBuildInfoTooltipBounds\s*\(/, 'Build page is missing its tooltip safe-area resolver');
assert.match(buildPageSource, /bounds:\s*getBuildInfoTooltipBounds/, 'Build Info tooltip binding does not pass the safe-area resolver');
assert.match(hoverSource, /bounds\?:\s*\(\)\s*=>/, 'Shared tooltip binding does not accept a dynamic safe-area resolver');

const port = 8842;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><style>
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: #211714; }
      .build-info { position: fixed; inset: 96px 0 auto auto; width: 120px; height: 520px; }
      [data-item-id] { position: fixed; left: calc(100vw - 72px); top: 760px; width: 48px; height: 48px; }
      .bpb-tooltip-float {
        --bpb-tooltip-scale: 1;
        position: fixed;
        z-index: 10020;
        left: 0;
        top: 0;
        transform: scale(var(--bpb-tooltip-scale));
        transform-origin: top left;
      }
      .bpb-tooltip { width: 584px; height: 760px; padding: 16px; background: #5c4030; color: #ffecdc; }
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
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    window.ItemTooltip = {
      render() {
        const card = document.createElement('div');
        card.className = 'bpb-tooltip';
        card.textContent = 'Oversized Build Info item';
        return card;
      },
    };
    const { createTooltipHover } = await import('/js/shared/tooltip-hover.js');
    const root = document.querySelector('.build-info');
    const tip = createTooltipHover();
    tip.bind(root, {
      selector: '[data-item-id]',
      getItem: () => ({ name: 'Oversized Build Info item' }),
      place: 'itemLeft',
      bounds: () => ({ top: 40, right: 1880, bottom: 740, left: 40 }),
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
      tooltipTop: tipRect.top,
      tooltipRight: tipRect.right,
      tooltipBottom: tipRect.bottom,
      scale: Number.parseFloat(getComputedStyle(tip).getPropertyValue('--bpb-tooltip-scale')) || 0,
    };
  });

  assert.ok(result.tooltipLeft < result.anchorLeft, `tooltip did not remain left of the Build Info item: ${JSON.stringify(result)}`);
  assert.ok(result.tooltipTop >= 39, `tooltip crossed the screen-frame top bound: ${JSON.stringify(result)}`);
  assert.ok(result.tooltipRight <= 1881, `tooltip crossed the safe right bound: ${JSON.stringify(result)}`);
  assert.ok(result.tooltipBottom <= 741, `tooltip crossed the footer safe bottom bound: ${JSON.stringify(result)}`);
  assert.ok(result.scale > 0 && result.scale < 1, `oversized tooltip was not fitted to the safe height: ${JSON.stringify(result)}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('Build view info tooltip safe-area smoke passed.');
