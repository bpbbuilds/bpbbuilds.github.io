#!/usr/bin/env node

/** Verify Build-view round-strip pointer dragging scrubs boards without waves. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8814;
const MIME = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const roundSource = fs.readFileSync(path.join(root, 'js/pages/build/round-scrubber.js'), 'utf8');
const buildPageSource = fs.readFileSync(path.join(root, 'js/pages/build/page.js'), 'utf8');

assert.match(roundSource, /dragScrub/, 'round scrubber is missing its Build-view drag option');
assert.match(buildPageSource, /const isBuildView = document\.body\.classList\.contains\('page-build-view'\)/, 'Build page does not scope the round interaction to Build view');
assert.match(buildPageSource, /dragScrub:\s*isBuildView/, 'Build view does not enable round dragging');
assert.match(buildPageSource, /grid\.update\(frame\.placements, itemsById, \{\s*appear:\s*!isBuildView\s*\}\)/, 'Build view round changes still replay the appear wave');

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><style>
      html,body{margin:0;background:#201717;color:#fff}
      .build-round-strip{display:flex;gap:12px}
      .build-round-strip__btn{width:48px;height:48px;padding:0}
      .build-round-strip__btn img{width:28px;height:48px}
    </style></head><body><div id="rounds"></div><script type="module">
      import { mountRoundScrubber } from '/js/pages/build/round-scrubber.js';
      const frames = Array.from({ length: 5 }, (_, i) => ({
        round: i + 1,
        result: i % 2 ? 'loss' : 'win',
        placements: [{ id: 'item-' + i, x: i, y: 0 }],
      }));
      const events = [];
      window.scrubber = mountRoundScrubber(document.querySelector('#rounds'), {
        frames,
        root: '/',
        showHistory: true,
        previewMode: true,
        initialIndex: 0,
        dragScrub: true,
        onChange: (_frame, index) => events.push(index),
      });
      window.events = events;
    </script></body></html>`);
    return;
  }
  const filePath = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/harness`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.scrubber?.index === 0);

  await page.click('[data-index="2"]');
  assert.equal(await page.evaluate(() => window.scrubber.index), 2, 'round click no longer selects a round');

  const first = await page.locator('[data-index="0"]').boundingBox();
  const last = await page.locator('[data-index="4"]').boundingBox();
  assert.ok(first && last, 'round buttons did not render');
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2, { steps: 4 });
  await page.mouse.up();
  assert.equal(await page.evaluate(() => window.scrubber.index), 4, 'dragging right did not scrub to the target round');

  await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2, { steps: 4 });
  await page.mouse.up();
  assert.equal(await page.evaluate(() => window.scrubber.index), 0, 'dragging left did not scrub to the target round');

  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => window.scrubber.index), 1, 'keyboard round navigation regressed');
  console.log('build view round drag smoke: ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
