#!/usr/bin/env node

/** Responsive interaction smoke for the Home Choose Your Hero drag rail. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'js/pages/home/home-class-showcase.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'js/pages/home/home-class-showcase.css'), 'utf8');

assert.match(source, /pointerdown/, 'Choose Your Hero binds pointer drag start');
assert.match(source, /setPointerCapture/, 'Choose Your Hero captures the active pointer');
assert.match(source, /suppressClick|didDrag/, 'Choose Your Hero distinguishes drag from click');
assert.match(css, /touch-action:\s*pan-y/, 'Choose Your Hero preserves vertical page scrolling on touch');
assert.match(css, /cursor:\s*grab/, 'Choose Your Hero exposes a grab cursor');
assert.match(css, /scrollbar-width:\s*none/, 'Choose Your Hero hides the Firefox scrollbar');
assert.match(css, /home-mobs__cards::-webkit-scrollbar[\s\S]*display:\s*none/, 'Choose Your Hero hides the WebKit scrollbar');

const port = 8832;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head>
      <link rel="stylesheet" href="/css/theme.css">
      <link rel="stylesheet" href="/css/shared.css">
      <link rel="stylesheet" href="/js/pages/home/home-class-showcase.css">
      <link rel="stylesheet" href="/js/shared/tooltip.css">
      <script src="/js/shared/tooltip.js"></script>
    </head><body data-root="/"><main id="probe"></main></body></html>`);
    return;
  }
  const filePath = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath);
  const contentType = ext === '.js'
    ? 'text/javascript'
    : ext === '.css'
      ? 'text/css'
      : ext === '.webm'
        ? 'video/webm'
        : ext === '.webp'
          ? 'image/webp'
          : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const realFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes('/assets/data/sprite-display.json')) {
        return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/rest/v1/items')) {
        return Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return realFetch(input, init);
    };
  });
  await page.evaluate(async () => {
    const { initHomeClassShowcase } = await import('/js/pages/home/home-class-showcase.js');
    initHomeClassShowcase('#probe');
  });
  await page.waitForSelector('[data-home-mobs-rail]');
  await page.waitForTimeout(100);

  const rail = page.locator('[data-home-mobs-rail]');
  const box = await rail.boundingBox();
  assert.ok(box, 'Choose Your Hero rail is measurable');
  const before = await rail.evaluate((el) => ({
    scrollLeft: el.scrollLeft,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    cursor: getComputedStyle(el).cursor,
  }));
  assert.ok(before.scrollWidth > before.clientWidth, 'Choose Your Hero rail has content to scroll');
  assert.equal(before.cursor, 'grab', 'Choose Your Hero rail starts with a grab cursor');

  const startX = box.x + box.width * 0.62;
  const y = box.y + box.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX - 180, y, { steps: 8 });
  await page.mouse.up();
  const after = await rail.evaluate((el) => ({
    scrollLeft: el.scrollLeft,
    cursor: getComputedStyle(el).cursor,
    dragging: el.classList.contains('is-dragging'),
  }));
  assert.ok(after.scrollLeft > before.scrollLeft + 40, 'dragging left scrolls the hero rail');
  assert.equal(after.cursor, 'grab', 'hero rail returns to grab cursor after drag');
  assert.equal(after.dragging, false, 'hero rail clears its dragging state after release');
  assert.equal(new URL(page.url()).pathname, '/harness', 'dragging does not navigate through a card link');

  await rail.focus();
  const keyboardBefore = await rail.evaluate((el) => el.scrollLeft);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(450);
  const keyboardAfter = await rail.evaluate((el) => el.scrollLeft);
  assert.ok(keyboardAfter > keyboardBefore, 'focused hero rail responds to ArrowRight');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('Home Choose Your Hero drag smoke passed.');
