#!/usr/bin/env node

/** Responsive browser regression for the Items spotlight Builds scrollbar. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8838;
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
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
      <link rel="stylesheet" href="/js/pages/items/spotlight.css">
      <style>
        *, *::before, *::after { box-sizing: border-box; }
        html, body { margin: 0; min-height: 100%; background: #201717; }
        .il-spotlight-builds { display: block; position: fixed; left: 50%; bottom: 1rem; transform: translateX(-50%); width: min(92vw, 896px); }
        .il-spotlight-builds__scroll { max-width: 100%; }
        .il-spotlight-builds__list { width: 1500px; }
        .il-spotlight-builds__card { width: 260px; height: 120px; background: #47332b; }
      </style>
    </head><body><aside class="il-spotlight-builds">
      <div class="il-spotlight-builds__panel il-filter__shade">
        <h3 class="il-spotlight-builds__heading">Builds using this item</h3>
        <div class="il-spotlight-builds__scroll"><ul class="il-spotlight-builds__list">
          <li class="il-spotlight-builds__card"></li><li class="il-spotlight-builds__card"></li>
          <li class="il-spotlight-builds__card"></li><li class="il-spotlight-builds__card"></li>
          <li class="il-spotlight-builds__card"></li><li class="il-spotlight-builds__card"></li>
        </ul></div>
      </div>
    </aside></body></html>`);
    return;
  }

  const filePath = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath);
  const contentType = ext === '.css' ? 'text/css' : ext === '.png' ? 'image/png' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, executablePath: edgePath });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });
  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const result = await page.evaluate(() => {
      const scroll = document.querySelector('.il-spotlight-builds__scroll');
      if (!(scroll instanceof HTMLElement)) throw new Error('Builds spotlight scroll fixture missing');
      const style = getComputedStyle(scroll);
      const track = getComputedStyle(scroll, '::-webkit-scrollbar-track');
      const thumb = getComputedStyle(scroll, '::-webkit-scrollbar-thumb');
      const button = getComputedStyle(scroll, '::-webkit-scrollbar-button');
      return {
        scrollWidth: scroll.scrollWidth,
        clientWidth: scroll.clientWidth,
        scrollHeight: scroll.scrollHeight,
        clientHeight: scroll.clientHeight,
        rect: (() => { const r = scroll.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; })(),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        scrollbarWidth: style.scrollbarWidth,
        scrollbarColor: style.scrollbarColor,
        trackBackground: track.backgroundImage,
        thumbBackground: thumb.backgroundImage,
        buttonDisplay: button.display,
      };
    });
    assert.ok(result.scrollWidth > result.clientWidth, `${viewport.name}: fixture is not horizontally scrollable`);
    assert.ok(result.overflowX <= 1, `${viewport.name}: page has horizontal overflow`);
    assert.match(result.trackBackground, /track-horizontal\.png/, `${viewport.name}: horizontal signature track asset is not painted`);
    assert.match(result.thumbBackground, /thumb-horizontal\.png/, `${viewport.name}: horizontal signature thumb asset is not painted`);
    assert.equal(result.buttonDisplay, 'none', `${viewport.name}: scrollbar buttons remain visible`);
    if (process.env.BPB_SCROLLBAR_SCREENSHOT && viewport.name === 'desktop') {
      await page.screenshot({ path: process.env.BPB_SCROLLBAR_SCREENSHOT });
    }
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
