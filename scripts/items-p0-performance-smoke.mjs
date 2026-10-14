#!/usr/bin/env node

/** Focused contract for the first two Items-page P0 performance fixes. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFile(path.join(root, file), 'utf8');
const [itemsPage, nav, catalog, pieces, pool] = await Promise.all([
  read('js/pages/items/index.js'),
  read('js/shared/nav.js'),
  read('js/pages/items/catalog/index.js'),
  read('js/shared/backpack-grid/item-pieces.js'),
  read('js/shared/backpack-grid/item-pool.js'),
]);

assert.match(itemsPage, /initNav\('#site-nav',\s*\{[\s\S]*onAccessGranted/);
assert.match(itemsPage, /catalogPromise\s*\|\|\s*initItemsCatalog/);
assert.match(nav, /const allowed = await initSiteAccess\(\);[\s\S]*onAccessGranted/);
assert.match(catalog, /let pendingFiltered = null/);
assert.match(catalog, /pendingFiltered = filterItems\(allItems, filterState, meta\)/);
assert.match(catalog, /paintGrid\(host, \{ appear: true, filtered \}\)/);
assert.doesNotMatch(pool, /if \(near\.length\) \{\s*await warmItemSprites/);
assert.match(pool, /void warmItemSprites\(near\.map\(\(e\) => e\.itemEl\), \{[\s\S]*isCurrent:[\s\S]*\}\)\.catch/);
assert.match(pieces, /itemWaits\.push\([\s\S]*Promise\.all\(waits\)\.then\([\s\S]*isCurrent[\s\S]*sprite-pending/);

const svg = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${color}"/></svg>`;
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
  if (pathname === '/fast.svg') {
    res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' });
    res.end(svg('#39c'));
    return;
  }
  if (pathname === '/slow.svg') {
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' });
      res.end(svg('#c93'));
    }, 650);
    return;
  }
  if (pathname === '/index.html' || pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><html><body></body></html>');
    return;
  }
  const file = path.join(root, pathname.replace(/^\/+/, ''));
  if (!file.startsWith(root) || !file.endsWith('.js')) {
    res.writeHead(404);
    res.end();
    return;
  }
  fs.readFile(file)
    .then((data) => {
      res.writeHead(200, {
        'content-type': 'text/javascript',
        'access-control-allow-origin': '*',
      });
      res.end(data);
    })
    .catch(() => {
      res.writeHead(404);
      res.end();
    });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const port = typeof address === 'object' && address ? address.port : 0;
assert.ok(port, 'smoke server started');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  const result = await page.evaluate(async ({ port: serverPort }) => {
    const { warmItemSprites } = await import(
      `http://127.0.0.1:${serverPort}/js/shared/backpack-grid/item-pieces.js`
    );
    document.body.innerHTML = `
      <div class="bpb-bg--itemiary">
        <div id="fast" class="bpb-bg__item bpb-bg__item--sprite-pending">
          <img class="bpb-bg__sprite" data-src="/fast.svg" alt="fast">
        </div>
        <div id="slow" class="bpb-bg__item bpb-bg__item--sprite-pending">
          <img class="bpb-bg__sprite" data-src="/slow.svg" alt="slow">
        </div>
      </div>`;
    const fast = document.querySelector('#fast');
    const slow = document.querySelector('#slow');
    const warming = warmItemSprites([fast, slow]);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const progressive = {
      fastReady: !fast.classList.contains('bpb-bg__item--sprite-pending'),
      slowStillPending: slow.classList.contains('bpb-bg__item--sprite-pending'),
    };
    await warming;
    return {
      ...progressive,
      allReady:
        !fast.classList.contains('bpb-bg__item--sprite-pending') &&
        !slow.classList.contains('bpb-bg__item--sprite-pending'),
    };
  }, { port });

  assert.equal(result.fastReady, true, 'fast sprite clears independently');
  assert.equal(result.slowStillPending, true, 'slow sprite does not block fast sprite');
  assert.equal(result.allReady, true, 'all sprites eventually clear pending state');
  console.log('items P0 performance smoke passed', result);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
