#!/usr/bin/env node

/** Shared item shadow contract: one sprite image plus an alpha-based CSS shadow. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const piecesPath = path.join(root, 'js', 'shared', 'backpack-grid', 'item-pieces.js');
const poolPath = path.join(root, 'js', 'shared', 'backpack-grid', 'item-pool.js');
const cssPath = path.join(root, 'js', 'shared', 'backpack-grid', 'backpack-grid.css');
const [pieces, pool, css] = await Promise.all([
  fs.readFile(piecesPath, 'utf8'),
  fs.readFile(poolPath, 'utf8'),
  fs.readFile(cssPath, 'utf8'),
]);

assert.doesNotMatch(pieces, /bpb-bg__sprite--shadow/, 'item renderer has no shadow image class');
assert.doesNotMatch(pieces, /const shadowImg\s*=/, 'item renderer does not build a duplicate shadow image');
assert.match(pieces, /bpb-bg__item--no-shadow/, 'renderer preserves an explicit shadow opt-out');
assert.match(pool, /shadow:\s*!itemiaryPromo/, 'painted pool entries use CSS shadows');
assert.match(css, /:where\(\.bpb-bg__item:not\(\.bpb-bg__item--no-shadow\)\) \.bpb-bg__sprite/, 'CSS shadow applies to normal item sprites');
assert.match(css, /drop-shadow\(\s*var\(--bpb-item-shadow-x\)/, 'CSS shadow uses the game offset token');
assert.doesNotMatch(css, /\.bpb-bg__sprite--shadow\s*\{/, 'shared grid has no shadow image styling');

const port = 8817;
const mime = { '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url || '/', `http://127.0.0.1:${port}`).pathname).replace(/^\/+/, '');
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !file.endsWith('.js') && !file.endsWith('.css')) {
    res.writeHead(404);
    res.end();
    return;
  }
  fs.readFile(file)
    .then((data) => {
      res.writeHead(200, {
        'content-type': mime[path.extname(file)] || 'text/plain',
        'access-control-allow-origin': '*',
      });
      res.end(data);
    })
    .catch(() => {
      res.writeHead(404);
      res.end();
    });
});

await new Promise((resolve) => server.listen(port, resolve));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>
    <div class="bpb-bg"><div class="bpb-bg__board"><div class="bpb-bg__items"></div></div></div>
    <script type="module">
      import { createItemEl } from 'http://127.0.0.1:${port}/js/shared/backpack-grid/item-pieces.js';
      const item = { id: 'smoke_item', name: 'Smoke item', type: 'Weapon', class: 'Neutral', rarity: 'Common', shape: { body: [{ x: 0, y: 0 }] } };
      const root = document.querySelector('.bpb-bg__items');
      const normal = createItemEl(item, () => '/assets/item-sprites/Dagger.png', 1, 0, [], { shadow: true });
      const noShadow = createItemEl(item, () => '/assets/item-sprites/Dagger.png', 1, 0, [], { shadow: false });
      const affected = createItemEl(item, () => '/assets/item-sprites/Dagger.png', 1, 0, [], { shadow: true });
      normal.dataset.testCase = 'normal';
      noShadow.dataset.testCase = 'no-shadow';
      affected.dataset.testCase = 'affected';
      affected.classList.add('bpb-bg__item--affected');
      root.append(normal, noShadow, affected);
      window.__ready = true;
    </script>
  </body></html>`);
  try {
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 5000 });
  } catch (error) {
    throw new Error(`${error.message}; browser errors: ${browserErrors.join('; ')}`);
  }
  const result = await page.evaluate(() => [...document.querySelectorAll('[data-test-case]')].map((el) => ({
    case: el.dataset.testCase,
    shadowImages: el.querySelectorAll('img.bpb-bg__sprite--shadow').length,
    shadowClass: el.classList.contains('bpb-bg__item--no-shadow'),
    filter: getComputedStyle(el.querySelector('.bpb-bg__sprite')).filter,
  })));
  assert.equal(result.length, 3, 'all shadow variants mounted');
  assert.ok(result.every((entry) => entry.shadowImages === 0), 'no duplicate shadow image mounted');
  assert.notEqual(result[0].filter, 'none', 'normal item receives CSS alpha shadow');
  assert.equal(result[1].filter, 'none', 'explicit no-shadow item remains unshadowed');
  assert.equal(result[1].shadowClass, true, 'explicit no-shadow marker is present');
  assert.match(result[2].filter, /brightness\(1\.3\)/, 'affected item keeps its brightness state');
  assert.match(result[2].filter, /drop-shadow/, 'affected item keeps the CSS silhouette shadow');
  console.log('Item shadow smoke passed.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
