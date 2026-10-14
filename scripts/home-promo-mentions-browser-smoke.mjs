#!/usr/bin/env node

/** Browser regression for Home build-animation description icon sizing. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8831;
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
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <link rel="stylesheet" href="/js/pages/home/home-promo-band.css" />
      <style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;background:#211711}#probe{width:min(100%,420px);margin:auto;padding:1rem}.home-promo__info{width:100%}</style>
    </head><body data-root="/"><div id="probe"><div class="home-promo__info"><div id="desc" class="home-promo__info-desc"></div></div></div></body></html>`);
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
      const { paintPromoCaption } = await import('/js/pages/home/home-promo-caption.js');
      const item = { id: 'wooden_sword', name: 'Wooden Sword', image: 'WoodenSword.png' };
      const desc = document.querySelector('#desc');
      paintPromoCaption(null, {
        blurb: 'Legacy text should not replace current notes.',
        notes: 'Pair it with [[wooden_sword]] for extra damage.',
      }, '/', null, desc, null, {
        mentionData: {
          itemsById: new Map([[item.id, item]]),
          getSpriteUrl: (row) => `/assets/item-sprites/${row.image}`,
        },
      });
      const icon = desc.querySelector('img.bpb-mention');
      const rect = icon?.getBoundingClientRect();
      return {
        iconCount: desc.querySelectorAll('img.bpb-mention').length,
        src: icon?.getAttribute('src') || '',
        width: rect?.width || 0,
        height: rect?.height || 0,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert.equal(result.iconCount, 1, `${viewport.name}: description renders one item icon`);
    assert.equal(result.src, '/assets/item-sprites/WoodenSword.png', `${viewport.name}: item icon keeps its sprite URL`);
    assert.ok(result.width > 0 && result.height > 0, `${viewport.name}: item icon has visible dimensions`);
    assert.ok(result.overflowX <= 1, `${viewport.name}: item icon introduced horizontal overflow`);
    results.push({ ...viewport, ...result });
    await page.close();
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
