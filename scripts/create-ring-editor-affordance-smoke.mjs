/**
 * Ring editor affordance: fixed top-right overlay and lock visibility.
 *
 *   node scripts/create-ring-editor-affordance-smoke.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8808;
const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html>
      <link rel="stylesheet" href="/js/shared/backpack-grid/backpack-grid.css">
      <link rel="stylesheet" href="/js/pages/create/create.css">
      <link rel="stylesheet" href="/js/pages/create/rail-chrome.css">
      <body class="page-create"><div class="create-board"><div id="board" class="bpb-bg" style="--bpb-bg-cell:80px"></div></div>
      <script type="module">
        import { createItemEl } from '/js/shared/backpack-grid/item-pieces.js';
        import { mountRingEditor } from '/js/pages/create/ring-editor.js';
        const item = { id: 'magic_ring', name: 'Magic Ring', shape: [[0, 0]] };
        for (let face = 0; face < 4; face += 1) {
          const ring = createItemEl(item, () => '', 1, face, [], { placementKey: 'ring-' + face, shadow: false });
          ring.style.left = (face * 110) + 'px';
          ring.style.top = '120px';
          document.querySelector('#board').append(ring);
        }
        mountRingEditor({
          root: document.querySelector('.create-board'),
          state: {
            isHistoryLocked: () => document.querySelector('.create-board').classList.contains('is-history-locked'),
            getDraft: () => ({ placements: [{ id: 'magic_ring', key: 'ring-0', instance: {} }] }),
          },
          itemsById: new Map([['magic_ring', { params: {} }]]),
        });
      </script>`);
    return;
  }
  const filePath = path.join(ROOT, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 720 } });
await page.goto(`http://127.0.0.1:${PORT}/harness`, { waitUntil: 'networkidle' });

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1080, height: 720 },
  { width: 800, height: 900 },
  { width: 390, height: 844 },
]) {
  await page.setViewportSize(viewport);
  const unlocked = await page.evaluate(() => [...document.querySelectorAll('.bpb-bg__item')].map((item) => {
    const button = item.querySelector('[data-ring-config]');
    const box = item.getBoundingClientRect();
    const control = button?.getBoundingClientRect();
    return {
      className: button?.className,
      display: button ? getComputedStyle(button).display : '',
      rotate: button ? getComputedStyle(button).rotate : '',
      top: control?.top, right: control?.right, itemTop: box.top, itemRight: box.right,
    };
  }));
  assert.equal(unlocked.length, 4, `all four ring rotations render at ${viewport.width}px`);
  for (const ring of unlocked) {
    assert.match(String(ring.className), /cr-submit-info/, 'ring control reuses the Submit info treatment');
    assert.notEqual(ring.display, 'none', `unlocked ring remains configurable at ${viewport.width}px`);
    assert.equal(ring.rotate, 'none', 'ring info control must not inherit item rotation');
    assert.ok(Math.abs(ring.top - ring.itemTop) < 12, 'ring control stays at the item top');
    assert.ok(Math.abs(ring.right - ring.itemRight) < 12, 'ring control stays at the item right');
  }
}

await page.locator('.create-board').evaluate((board) => board.classList.add('is-history-locked'));
const locked = await page.locator('[data-ring-config]').evaluateAll((buttons) => buttons.map((button) => getComputedStyle(button).display));
assert.deepEqual(locked, ['none', 'none', 'none', 'none'], 'HistoryDB-locked boards hide ring configuration controls');
await page.locator('[data-ring-config]').first().evaluate((button) => button.click());
assert.equal(await page.locator('.bpb-ring-editor').count(), 0, 'locked ring controls cannot open a stale editor');

await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log('create ring editor affordance smoke: ok');
