/**
 * Homepage combat sky: transform-based celestials + scroll scrub still day→night.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8795;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
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
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.combat-sky__celestial[data-layer="sun"]', { timeout: 15000 });
await page.waitForTimeout(200);

const day = await page.evaluate(() => {
  const sky = document.querySelector('.combat-sky__sky');
  const sun = document.querySelector('[data-layer="sun"]');
  const cs = sun ? getComputedStyle(sun) : null;
  return {
    skyMod: sky ? getComputedStyle(sky).backgroundColor : '',
    sunTf: cs?.transform || '',
    sunLeft: cs?.left || '',
    layers: document.querySelectorAll('.combat-sky [data-layer]').length,
  };
});

await page.evaluate(() => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo(0, Math.max(1, Math.floor(max * 0.85)));
});
await page.waitForTimeout(350);

const night = await page.evaluate(() => {
  const sky = document.querySelector('.combat-sky__sky');
  const sun = document.querySelector('[data-layer="sun"]');
  return {
    skyMod: sky ? getComputedStyle(sky).backgroundColor : '',
    sunA: sun ? getComputedStyle(sun).opacity : '',
    y: window.scrollY,
  };
});

await browser.close();
server.close();

const fail = [];
if (day.layers < 12) fail.push(`sky layers ${day.layers}`);
if (!/matrix/.test(day.sunTf)) fail.push(`sun transform ${day.sunTf}`);
if (day.sunLeft !== '0px') fail.push(`sun still uses left ${day.sunLeft} (want transform)`);
if (day.skyMod === night.skyMod) fail.push('sky color did not change after scroll');
if (errors.length) fail.push(`page errors: ${errors.join(' | ')}`);

console.log(JSON.stringify({ day, night, fail }, null, 2));
if (fail.length) process.exit(1);
