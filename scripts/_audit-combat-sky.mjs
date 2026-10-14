/** Homepage combat sky: fixed Night frame with an independently animated windmill. */
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

const beforeScroll = await page.evaluate(() => {
  const sky = document.querySelector('.combat-sky__sky');
  const sun = document.querySelector('[data-layer="sun"]');
  const windmill = document.querySelector('.combat-sky__blades');
  const cs = sun ? getComputedStyle(sun) : null;
  const wm = windmill ? getComputedStyle(windmill) : null;
  return {
    skyMod: sky ? getComputedStyle(sky).backgroundColor : '',
    skyY: sky ? getComputedStyle(sky).transform : '',
    sunTf: cs?.transform || '',
    sunLeft: cs?.left || '',
    sunOpacity: cs?.opacity || '',
    windmillAnimation: wm?.animationName || '',
    layers: document.querySelectorAll('.combat-sky [data-layer]').length,
  };
});

await page.evaluate(() => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  window.scrollTo(0, Math.max(1, Math.floor(max * 0.85)));
});
await page.waitForTimeout(350);

const afterScroll = await page.evaluate(() => {
  const sky = document.querySelector('.combat-sky__sky');
  const sun = document.querySelector('[data-layer="sun"]');
  const windmill = document.querySelector('.combat-sky__blades');
  const cs = sun ? getComputedStyle(sun) : null;
  return {
    skyMod: sky ? getComputedStyle(sky).backgroundColor : '',
    skyY: sky ? getComputedStyle(sky).transform : '',
    sunOpacity: cs?.opacity || '',
    windmillAnimation: windmill ? getComputedStyle(windmill).animationName : '',
    y: window.scrollY,
  };
});

await browser.close();
server.close();

const fail = [];
if (beforeScroll.layers < 12) fail.push(`sky layers ${beforeScroll.layers}`);
if (!/matrix/.test(beforeScroll.sunTf)) fail.push(`sun transform ${beforeScroll.sunTf}`);
if (beforeScroll.sunLeft !== '0px') fail.push(`sun still uses left ${beforeScroll.sunLeft} (want transform)`);
if (beforeScroll.skyMod !== afterScroll.skyMod) fail.push('sky color changed after scroll');
if (beforeScroll.skyY !== afterScroll.skyY) fail.push('sky position changed after scroll');
if (beforeScroll.sunOpacity !== afterScroll.sunOpacity) fail.push('sun visibility changed after scroll');
if (beforeScroll.windmillAnimation !== 'combat-sky-spin') fail.push(`windmill animation ${beforeScroll.windmillAnimation}`);
if (afterScroll.windmillAnimation !== 'combat-sky-spin') fail.push(`windmill animation after scroll ${afterScroll.windmillAnimation}`);
if (errors.length) fail.push(`page errors: ${errors.join(' | ')}`);

console.log(JSON.stringify({ beforeScroll, afterScroll, fail }, null, 2));
if (fail.length) process.exit(1);
