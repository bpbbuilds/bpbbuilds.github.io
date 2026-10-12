import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8802;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><body>
      <main id="page-root"><button id="outside">Outside page</button></main>
      <script type="module">
        import { closePremiumOffer, openPremiumOffer } from '/js/shared/premium-offer.js';
        window.testPremiumLock = async () => {
          await openPremiumOffer('compare');
          const outside = document.querySelector('#page-root');
          const layer = document.querySelector('.bpb-premium-offer');
          const close = layer?.querySelector('[data-offer-close]');
          const locked = outside?.inert === true;
          const offerVisible = layer && !layer.hidden;
          close?.focus();
          const focusStayedInside = layer?.contains(document.activeElement) === true;
          closePremiumOffer();
          return {
            locked,
            offerVisible,
            focusStayedInside,
            restored: outside?.inert === false,
            closed: layer?.hidden === true,
          };
        };
      </script></body>`);
    return;
  }

  if (url.hostname === 'xklkysmakrmgtiztsqug.supabase.co') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(url.pathname.includes('/auth/')
      ? JSON.stringify({ data: { session: null }, error: null })
      : JSON.stringify({ data: null, error: { message: 'smoke fallback' } }));
    return;
  }

  const rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath);
  const type = ext === '.js'
    ? 'text/javascript; charset=utf-8'
    : ext === '.css'
      ? 'text/css; charset=utf-8'
      : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 720 } });
await page.route('https://xklkysmakrmgtiztsqug.supabase.co/**', async (route) => {
  const body = route.request().url().includes('/auth/')
    ? JSON.stringify({ data: { session: null }, error: null })
    : JSON.stringify({ data: null, error: { message: 'smoke fallback' } });
  await route.fulfill({ status: 200, contentType: 'application/json', body });
});
await page.goto(`http://127.0.0.1:${PORT}/harness`, { waitUntil: 'networkidle' });
const state = await page.evaluate(() => window.testPremiumLock());
if (!state.locked || !state.offerVisible || !state.focusStayedInside || !state.restored || !state.closed) {
  throw new Error(`premium offer did not lock and restore the page: ${JSON.stringify(state)}`);
}
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log('premium offer lock smoke: ok (inert siblings, focus, restore)');
