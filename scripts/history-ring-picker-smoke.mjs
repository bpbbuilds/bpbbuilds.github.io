/** History-picker frame must preserve imported ring configuration. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8811;
const MIME = { '.js': 'text/javascript; charset=utf-8' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><script type="module">
      import { framesFromHistoryRun } from '/js/pages/build/round-scrubber.js';
      window.pickerFrame = framesFromHistoryRun({ rounds: [{ round: 1, result: 'win', placements: [{
        id: 'magic_ring', x: 2, y: 3, r: 1, key: 'ring-1',
        instance: { persistent: { magicRing: 552, effects: [{ trigger: 0, stack: 'blind' }, { trigger: 2, stack: 'blind' }] } },
      }] }] })[0];
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
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/harness`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.pickerFrame !== undefined);
const frame = await page.evaluate(() => window.pickerFrame);
assert.deepEqual(frame?.placements?.[0]?.instance?.persistent?.effects, [
  { trigger: 0, stack: 'blind' },
  { trigger: 2, stack: 'blind' },
], 'History picker must retain imported ring effects when loading Create');
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log('history ring picker smoke: ok');
