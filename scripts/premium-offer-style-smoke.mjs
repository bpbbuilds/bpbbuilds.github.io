import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8800;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><link rel="stylesheet" href="/css/theme.css"><link rel="stylesheet" href="/js/shared/premium-offer.css"><body>
      <div class="bpb-premium-offer"><div class="bpb-premium-offer__backdrop"></div><div class="bpb-premium-offer__frame">
        <span class="bpb-premium-offer__halo"></span><div class="bpb-premium-offer__panel bpb-panel--rewards">
          <div class="bpb-premium-offer__body"><h2 class="bpb-premium-offer__title">Premium</h2>
            <p class="bpb-premium-offer__lede">Unlock Premium features.</p><div class="bpb-premium-offer__actions">
              <button class="bpb-premium-offer__btn bpb-premium-offer__btn--primary">Join Premium</button>
              <button class="bpb-premium-offer__btn bpb-premium-offer__btn--quiet">Not now</button>
            </div>
          </div>
        </div></div></div></body>`);
    return;
  }
  const rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const viewports = [
  { width: 1440, height: 900 },
  { width: 1080, height: 720 },
  { width: 800, height: 900 },
  { width: 390, height: 844 },
];
await page.goto(`http://127.0.0.1:${PORT}/harness`, { waitUntil: 'networkidle' });
for (const viewport of viewports) {
  await page.setViewportSize(viewport);
  const state = await page.evaluate(() => {
    const panel = document.querySelector('.bpb-premium-offer__panel');
    const button = document.querySelector('.bpb-premium-offer__btn--primary');
    const backdrop = document.querySelector('.bpb-premium-offer__backdrop');
    if (!panel || !button || !backdrop) return null;
    const panelStyle = getComputedStyle(panel);
    const buttonStyle = getComputedStyle(button);
    const backdropStyle = getComputedStyle(backdrop);
    return {
      panelWidth: panel.getBoundingClientRect().width,
      panelBorder: panelStyle.borderTopWidth,
      panelBackground: panelStyle.backgroundImage,
      buttonBorder: buttonStyle.borderTopWidth,
      buttonBackground: buttonStyle.backgroundImage,
      backdropFilter: backdropStyle.backdropFilter,
    };
  });
  if (!state || state.panelWidth > viewport.width - 24) {
    throw new Error(`premium panel overflows at ${viewport.width}px: ${JSON.stringify(state)}`);
  }
  if (state.panelBorder !== '0px' || state.buttonBorder !== '2px' || state.buttonBackground !== 'none') {
    throw new Error(`reset-button treatment missing at ${viewport.width}px: ${JSON.stringify(state)}`);
  }
}
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log('premium offer style smoke: ok (1440, 1080, narrow, mobile)');
