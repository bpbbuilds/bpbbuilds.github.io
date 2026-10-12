/**
 * Shared profile-avatar CDN failure fallback smoke.
 *
 *   node scripts/avatar-fallback-smoke.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8797;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    res.end(`<!doctype html><meta charset="utf-8"><body><main id="app"></main><script type="module">
      import { faceHtml } from '/js/shared/blob-face.js';
      const app = document.querySelector('#app');
      app.innerHTML = faceHtml(
        { avatar_url: '/bad-avatar.png' },
        '/',
        { className: 'test-avatar', alt: 'Jane Doe' },
      );
      app.insertAdjacentHTML('beforeend', '<img class="direct-avatar" src="/bad-avatar.png" alt="Alex Smith" data-bpb-avatar-img="1" data-bpb-avatar-class="direct-avatar" data-bpb-avatar-mode="initials" data-bpb-avatar-name="Alex Smith">');
    </script></body>`);
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
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(`http://127.0.0.1:${PORT}/harness`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(250);

const result = await page.evaluate(() => ({
  brokenImage: Boolean(document.querySelector('img.test-avatar')),
  fallbackText: document.querySelector('.test-avatar--initials')?.textContent || '',
  directBrokenImage: Boolean(document.querySelector('img.direct-avatar')),
  directFallbackText: document.querySelector('.direct-avatar--initials')?.textContent || '',
}));

await browser.close();
await new Promise((resolve) => server.close(resolve));

if (errors.length) throw new Error(`browser errors: ${errors.join('; ')}`);
if (result.brokenImage) throw new Error('failed profile image remained in the DOM');
if (result.fallbackText !== 'JD') {
  throw new Error(`expected initials JD, got ${JSON.stringify(result.fallbackText)}`);
}
if (result.directBrokenImage || result.directFallbackText !== 'AS') {
  throw new Error(`direct avatar fallback failed: ${JSON.stringify(result)}`);
}
console.log('avatar fallback smoke: ok');
