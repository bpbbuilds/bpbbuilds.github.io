import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8799;
const harness = `<!doctype html><html><body>
  <div class="sim-field"><div class="sim-field__bag"><div class="bpb-bg__item" data-placement-key="p0" data-item-id="phoenix" data-face="0">
    <div class="bpb-bg__spin"><button class="bpb-bg__hit"><span class="bpb-live"><img class="bpb-live__base" src="/assets/item-sprites/Phoenix.png" alt=""></span><img class="bpb-bg__sprite bpb-bg__sprite--shadow" src="/assets/item-sprites/Phoenix.png" alt=""></button></div>
  </div></div></div>
  <script type="module">
    import { createSimItemChrome } from '/js/pages/sim/fx/sim-item-chrome.js';
    const run = { events: [], pieceSnapshots: [
      { t: 0, byKey: { p0: { visualState: null, loopCd: 4, triggerTime: 4, cooldown: 4 } } },
      { t: 2.5, byKey: { p0: { visualState: 'ash', loopCd: 4, triggerTime: 4, cooldown: 4 } } },
    ] };
    const board = document.querySelector('.sim-field__bag');
    window.__chrome = createSimItemChrome({ boardEl: board, run, assetRoot: '/' });
    window.__chrome.seek(0);
    window.__ready = true;
  </script>
</body></html>`;

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(harness);
    return;
  }
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'content-type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 500, height: 400 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
try {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true);
  const check = async (t) => page.evaluate((time) => {
    window.__chrome.seek(time);
    return [...document.querySelectorAll('img.bpb-bg__sprite, img.bpb-live__base')].map((img) => img.getAttribute('src') || '');
  }, t);
  const normal = await check(1);
  assert.ok(normal.every((src) => /Phoenix\.png/.test(src)), `normal Phoenix art: ${normal.join(',')}`);
  const ash = await check(3);
  assert.ok(ash.every((src) => /Phoenix_Ash\.png/.test(src)), `ash Phoenix art: ${ash.join(',')}`);
  const restored = await check(1);
  assert.ok(restored.every((src) => /Phoenix\.png/.test(src)), `rewind restores Phoenix art: ${restored.join(',')}`);
  assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
  console.log('sim used-item visual browser smoke: ok');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
