#!/usr/bin/env node

/** Browser regression for the profile inventory cosmetic tooltip shadow. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8837;
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
    res.end(`<!doctype html><html><head>
      <link rel="stylesheet" href="/js/shared/tooltip.css">
      <link rel="stylesheet" href="/js/pages/u/profile.css">
      <link rel="stylesheet" href="/js/pages/u/inventory.css">
      <style>
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; min-height: 100%; }
        #root { padding: 120px; }
        .profile-inv__tile { width: 88px; height: 88px; }
      </style>
    </head><body class="page-profile">
      <main id="main"><section id="root"><button class="profile-inv__tile" data-blob-item="starter_hat">Starter Hat</button><button data-test-item="hammer">Hammer</button></section></main>
      <script src="/js/shared/tooltip.js"></script>
    </body></html>`);
    return;
  }

  const filePath = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath);
  const contentType = ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
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
      const { bindCosmeticTooltips } = await import('/js/pages/u/blob/cosmetic-tooltip.js');
      const root = document.querySelector('#root');
      const tile = document.querySelector('[data-blob-item]');
      if (!(root instanceof HTMLElement) || !(tile instanceof HTMLElement)) return null;

      const binding = bindCosmeticTooltips(root, {
        catalog: [{
          id: 'starter_hat',
          name: 'Starter Hat',
          slot: 'hat',
          rarity: 'Rare',
          description: 'A profile cosmetic.',
          cost: 10,
        }],
      });
      tile.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 150, clientY: 150 }));
      await new Promise((resolve) => window.setTimeout(resolve, 350));

      const host = binding.tip.host;
      const card = host.querySelector('.bpb-tooltip');
      const hostStyle = getComputedStyle(host);
      const cardStyle = card instanceof HTMLElement ? getComputedStyle(card) : null;
      const output = {
        hostClass: host.className,
        hostFilter: hostStyle.filter,
        cardFilter: cardStyle?.filter || '',
        cardShadow: cardStyle?.boxShadow || '',
        visible: host.classList.contains('is-visible'),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
      binding.destroy();

      const { createTooltipHover } = await import('/js/shared/tooltip-hover.js');
      const generic = createTooltipHover();
      generic.bind(root, {
        selector: '[data-test-item]',
        getItem: () => ({ name: 'Hammer', rarity: 'Common', type: 'Weapon', class: 'Neutral', effect: 'A normal item tooltip.' }),
      });
      const genericTile = document.querySelector('[data-test-item]');
      genericTile?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 150, clientY: 150 }));
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      const genericCard = generic.host.querySelector('.bpb-tooltip');
      output.genericCardFilter = genericCard instanceof HTMLElement ? getComputedStyle(genericCard).filter : '';
      generic.destroy();
      return output;
    });
    await page.close();

    assert.ok(result, `${viewport.name}: profile inventory tooltip fixture mounted`);
    assert.equal(result.visible, true, `${viewport.name}: cosmetic tooltip is visible after inventory hover`);
    assert.match(result.hostClass, /bpb-tooltip-float--cosmetic/, `${viewport.name}: cosmetic tooltip host is explicitly scoped`);
    assert.equal(result.hostFilter, 'none', `${viewport.name}: cosmetic tooltip host does not add a filter shadow`);
    assert.equal(result.cardFilter, 'none', `${viewport.name}: cosmetic tooltip card does not add the shared drop shadow`);
    assert.match(result.genericCardFilter, /drop-shadow/, `${viewport.name}: regular item tooltip shadow was not preserved`);
    assert.ok(result.overflowX <= 1, `${viewport.name}: tooltip fixture overflows horizontally`);
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
