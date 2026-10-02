/**
 * Live /sim/ shot with a published board so the HUD is checked in page context
 * (footprint over the bags, no console errors).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8787;
const SLUG = process.argv[2] || 'bpbb-cool-poison-build-80sj12';
const SHOT = path.join(ROOT, 'scripts/_fixtures/sim-hud-page.png');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  let rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!rel || rel.endsWith('/')) rel = path.join(rel, 'index.html');
  const filePath = path.join(ROOT, rel);
  if (
    !filePath.startsWith(ROOT) ||
    !fs.existsSync(filePath) ||
    fs.statSync(filePath).isDirectory()
  ) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
  });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const errors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto(`http://127.0.0.1:${PORT}/sim/?slug=${SLUG}`, {
  waitUntil: 'domcontentloaded',
});
await page.waitForSelector('.sim-hud[data-hud="player"]', { timeout: 30000 });
await page.waitForTimeout(3500);
await page.screenshot({ path: SHOT });

const geo = await page.evaluate(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      w: +r.width.toFixed(1),
      h: +r.height.toFixed(1),
      top: +r.top.toFixed(1),
      left: +r.left.toFixed(1),
      right: +r.right.toFixed(1),
      bottom: +r.bottom.toFixed(1),
    };
  };
  return {
    viewport: { w: innerWidth, h: innerHeight },
    row: box('.sim-hud-row'),
    you: box('.sim-hud[data-hud="player"]'),
    foe: box('.sim-hud[data-hud="dummy"]'),
    bag: box('.sim-field__bag'),
    hp: document.querySelector('.sim-hud[data-hud="player"] [data-hud-hp]')?.textContent,
    stam: document.querySelector('.sim-hud[data-hud="player"] [data-hud-stam]')?.textContent,
    onCounters: [
      ...document.querySelectorAll('.sim-hud[data-hud="player"] [data-hud-counter].is-on'),
    ].map((el) => el.getAttribute('data-hud-counter')),
  };
});

console.log(JSON.stringify(geo, null, 2));
console.log('console errors:', errors.length ? errors.join(' | ').slice(0, 400) : 'none');
console.log('shot', SHOT);

await browser.close();
server.close();
