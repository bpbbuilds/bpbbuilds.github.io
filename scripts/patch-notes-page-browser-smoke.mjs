#!/usr/bin/env node

/** Responsive browser smoke for the under-construction Patches page. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8826;
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'short-desktop', width: 1080, height: 720 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  const relative = decodeURIComponent(url.pathname.replace(/^\//, '')) || 'patch-notes/index.html';
  let filePath = path.join(root, relative);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = {
    '.html': 'text/html; charset=utf-8',
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
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto(`http://127.0.0.1:${port}/patch-notes/`, { waitUntil: 'networkidle' });
    const result = await page.evaluate(() => {
      const main = document.querySelector('.market-main');
      const panel = document.querySelector('.market-soon');
      const mainRect = main?.getBoundingClientRect();
      return {
        title: document.querySelector('.market-soon__title-text')?.textContent?.trim() || '',
        message: document.querySelector('.market-soon__hint')?.textContent?.trim() || '',
        mainWidth: mainRect?.width || 0,
        viewportWidth: document.documentElement.clientWidth,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        panelVisible: panel instanceof HTMLElement && panel.getClientRects().length > 0,
      };
    });
    assert.equal(result.title, 'Coming soon', `${viewport.name}: missing coming-soon title`);
    assert.match(result.message, /under construction/i, `${viewport.name}: missing construction message`);
    assert.equal(result.panelVisible, true, `${viewport.name}: construction panel is not visible`);
    assert.ok(result.mainWidth > 0 && result.mainWidth <= result.viewportWidth, `${viewport.name}: page content is not responsive`);
    assert.ok(result.overflowX <= 1, `${viewport.name}: Patches page introduced horizontal overflow`);
    await page.close();
  }
  console.log('Patches page browser smoke passed.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
