/**
 * E2E: real /create/ page — class → bag onboard.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8766;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
};

function contentType(filePath) {
  return MIME[path.extname(filePath)] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  let rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!rel || rel.endsWith('/')) rel = path.join(rel, 'index.html');
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found ' + rel);
    return;
  }
  res.writeHead(200, { 'Content-Type': contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
console.log('create http://127.0.0.1:' + PORT + '/create/');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('dialog', async (dialog) => {
  await dialog.accept();
});
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('browser error:', msg.text());
});
page.on('pageerror', (err) => console.log('pageerror:', err.message));

await page.goto(`http://127.0.0.1:${PORT}/create/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.removeItem('bpb-create-draft:v1');
  sessionStorage.removeItem('bpb-create-onboard-skip:v3');
});
await page.reload({ waitUntil: 'networkidle' });

await page.waitForSelector('[data-board-onboard]:not([hidden])', { timeout: 60000 });
await page.waitForSelector('[data-onboard-classes] button', { timeout: 10000 });

await page.locator('[data-onboard-classes] button').first().click();
await page.waitForTimeout(150);
await page.locator('[data-onboard-bags] button').first().click();
await page.waitForTimeout(250);

const afterPlace = await page.evaluate(() => ({
  overlayHidden: document.querySelector('[data-board-onboard]')?.hidden,
  boardItems: document.querySelectorAll('.create-board .bpb-bg__item').length,
}));
console.log('AFTER PLACE', afterPlace);

// Clear board — dialog should return
await page.locator('[data-act="clear"]').click();
await page.waitForTimeout(200);

const afterClear = await page.evaluate(() => {
  const o = document.querySelector('[data-board-onboard]');
  return {
    overlayHidden: o?.hidden,
    step: o?.dataset?.step,
    bagBtns: document.querySelectorAll('[data-onboard-bags] button').length,
    classBtns: document.querySelectorAll('[data-onboard-classes] button').length,
  };
});
console.log('AFTER CLEAR', afterClear);

await browser.close();
server.close();

const ok =
  afterPlace.overlayHidden === true &&
  afterPlace.boardItems >= 1 &&
  afterClear.overlayHidden === false &&
  (afterClear.step === 'bag' || afterClear.step === 'class');

if (!ok) {
  console.error('FAIL create page onboard / reappear');
  process.exit(1);
}
console.log('PASS create page onboard + reappear on clear');
