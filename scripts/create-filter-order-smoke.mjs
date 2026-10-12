/**
 * Create-only filter ordering smoke.
 *
 *   node scripts/create-filter-order-smoke.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8798;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    res.end(`<!doctype html>
      <link rel="stylesheet" href="/js/pages/items/filters.css">
      <link rel="stylesheet" href="/js/pages/create/create.css">
      <link rel="stylesheet" href="/js/pages/create/rail-chrome.css">
      <body class="page-create">
        <main class="create-col--catalog">
          <aside class="items-filters create-rail">
            <div class="cr-panel cr-panel--filters">
              <div class="il-filter__head"></div>
              <div class="il-filter__shade il-filter__grouping"></div>
              <div class="il-filter__shade il-filter__classes"></div>
              <div class="il-filter__shade il-filter__rarities"></div>
              <div class="il-filter__shade il-filter__types"></div>
              <div class="il-filter__lower"></div>
              <div class="il-filter__search-row">
                <label class="il-filter__shade il-filter__search"><input></label>
                <div class="il-filter__shade il-filter__debuffs"></div>
              </div>
            </div>
          </aside>
        </main>
      </body>`);
    return;
  }
  const rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto(`http://127.0.0.1:${PORT}/harness`, { waitUntil: 'networkidle' });
const viewports = [
  { width: 1440, height: 900 },
  { width: 1080, height: 720 },
  { width: 800, height: 900 },
  { width: 390, height: 844 },
];
const results = [];
for (const viewport of viewports) {
  await page.setViewportSize(viewport);
  results.push(await page.evaluate(() => {
  const panel = document.querySelector('.cr-panel--filters');
  const style = (selector) => {
    const el = document.querySelector(selector);
    return el ? { order: getComputedStyle(el).order, display: getComputedStyle(el).display } : null;
  };
  return {
    panelDisplay: panel ? getComputedStyle(panel).display : '',
    search: style('.il-filter__search'),
    grouping: style('.il-filter__grouping'),
    debuffs: style('.il-filter__debuffs'),
  };
  }));
}
await browser.close();
await new Promise((resolve) => server.close(resolve));

for (let i = 0; i < results.length; i += 1) {
  const result = results[i];
  if (result.panelDisplay !== 'flex') throw new Error(`expected create filter panel flex layout at ${viewports[i].width}px: ${JSON.stringify(result)}`);
  if (!(Number(result.search?.order) < Number(result.grouping?.order))) {
    throw new Error(`expected Search before Grouping at ${viewports[i].width}px: ${JSON.stringify(result)}`);
  }
  if (!(Number(result.debuffs?.order) > Number(result.grouping?.order))) {
    throw new Error(`expected Debuffs after Grouping at ${viewports[i].width}px: ${JSON.stringify(result)}`);
  }
}
console.log('create filter order smoke: ok (1440, 1080, narrow, mobile)');
