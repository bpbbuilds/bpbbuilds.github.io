import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8801;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><link rel="stylesheet" href="/css/theme.css"><body>
      <main style="min-height:100vh"><button id="action">Action</button><button id="other">Other</button><input id="text" type="text" value="Text"></main>
      <footer id="footer" style="height:4rem">Footer</footer>
      <script type="module" src="/js/shared/game-cursor.js"></script></body>`);
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
  const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://127.0.0.1:${PORT}/harness`, { waitUntil: 'networkidle' });

async function cursorState() {
  return page.evaluate(() => {
    const root = document.documentElement;
    const follower = document.querySelector('.bpb-cursor-follower');
    return {
      live: root.classList.contains('bpb-live-cursor'),
      display: follower ? getComputedStyle(follower).display : 'none',
      width: follower ? parseFloat(getComputedStyle(follower).width) : 0,
      inputCursor: getComputedStyle(document.querySelector('#text')).cursor,
    };
  });
}

await page.mouse.move(1438, 898);
await page.waitForTimeout(40);
const wide = await cursorState();
if (!wide.live || wide.display !== 'block') throw new Error(`edge cursor did not stay visible at 1440px: ${JSON.stringify(wide)}`);

const action = page.locator('#action');
await action.hover();
await page.waitForTimeout(40);
const localHide = await page.evaluate(() => {
  const action = document.querySelector('#action');
  return {
    local: action instanceof HTMLElement ? action.style.getPropertyValue('cursor') : '',
    root: getComputedStyle(document.documentElement).cursor,
  };
});
if (localHide.local !== 'none' || localHide.root === 'none') throw new Error(`cursor hide leaked beyond its target: ${JSON.stringify(localHide)}`);

await page.locator('#other').hover();
await page.waitForTimeout(40);
const restored = await page.evaluate(() => {
  const action = document.querySelector('#action');
  return action instanceof HTMLElement ? action.style.getPropertyValue('cursor') : '';
});
if (restored) throw new Error(`previous cursor target was not restored: ${restored}`);

await page.setViewportSize({ width: 1080, height: 720 });
await page.mouse.move(1078, 718);
await page.waitForTimeout(40);
const compact = await cursorState();
if (!compact.live || compact.display !== 'block' || !(compact.width < wide.width)) {
  throw new Error(`desktop cursor did not scale at 1080px: ${JSON.stringify({ wide, compact })}`);
}

await page.setViewportSize({ width: 768, height: 720 });
await page.locator('#action').hover();
await page.waitForTimeout(40);
const tablet = await cursorState();
if (!tablet.live || tablet.display !== 'block' || !(tablet.width <= compact.width)) {
  throw new Error(`tablet cursor did not stay responsive: ${JSON.stringify({ compact, tablet })}`);
}

const input = page.locator('#text');
await input.hover();
await page.waitForTimeout(40);
const text = await cursorState();
if (text.live || text.inputCursor !== 'text') throw new Error(`text cursor was replaced: ${JSON.stringify(text)}`);

await page.setViewportSize({ width: 390, height: 844 });
await page.locator('#action').hover();
await page.waitForTimeout(40);
const mobile = await cursorState();
if (mobile.live || mobile.display !== 'none') throw new Error(`mobile cursor was not native: ${JSON.stringify(mobile)}`);

await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log('game cursor smoke: ok (edge, responsive desktop, text, mobile)');
