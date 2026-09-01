/**
 * Visual/geometry: History row W/L markers must sit inside the row box.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8768;
const FIXTURE = path.join(ROOT, 'scripts/_fixtures/history-mini.db');
const MAKE = path.join(ROOT, 'scripts/_fixtures/make-history-mini.mjs');
const SHOT = path.join(ROOT, 'scripts/_fixtures/history-wl-clip.png');

const made = spawnSync(process.execPath, [MAKE], { cwd: ROOT, encoding: 'utf8' });
if (made.status !== 0) {
  console.error(made.stdout || '', made.stderr || '');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.db': 'application/octet-stream',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  let rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!rel || rel.endsWith('/')) rel = path.join(rel, 'index.html');
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`http://127.0.0.1:${PORT}/create/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.removeItem('bpb-create-draft:v1');
  sessionStorage.removeItem('bpb-create-onboard-skip:v3');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('[data-board-onboard]:not([hidden])', { timeout: 60000 });
await page.waitForSelector('[data-history-file]', { state: 'attached' });
await page.locator('[data-history-file]').setInputFiles(FIXTURE);
await page.waitForSelector('.create-history__row .create-history__wl', { timeout: 30000 });
await page.waitForTimeout(400);

const geo = await page.evaluate(() => {
  const row = document.querySelector('.create-history__row');
  const wls = [...document.querySelectorAll('.create-history__row .create-history__wl')];
  if (!(row instanceof HTMLElement) || !wls.length) return { ok: false, reason: 'missing' };
  const rr = row.getBoundingClientRect();
  const cs = getComputedStyle(row);
  const padBottom = parseFloat(cs.paddingBottom) || 0;
  const padRight = parseFloat(cs.paddingRight) || 0;
  /** Patch3 bottom slice — content must clear this visual border band */
  const MASK_BOTTOM = 9;
  const MASK_RIGHT = 8;
  let worstBottom = -Infinity;
  let clearance = Infinity;
  const details = wls.map((img, i) => {
    const ir = img.getBoundingClientRect();
    const over = ir.bottom - rr.bottom;
    const clear = rr.bottom - ir.bottom;
    if (over > worstBottom) worstBottom = over;
    if (clear < clearance) clearance = clear;
    return { i, clear, over, h: ir.height, w: ir.width };
  });
  const keys = [...row.querySelectorAll('.create-history__key')];
  let keyOver = 0;
  for (const k of keys) {
    const kr = k.getBoundingClientRect();
    keyOver = Math.max(keyOver, kr.right - (rr.right - MASK_RIGHT));
  }
  const insideBox = worstBottom <= 0.5;
  const clearsMask = clearance >= MASK_BOTTOM + 6;
  const keysInside = keyOver <= 0.5;
  const outlineOk = !String(cs.outlineOffset).includes('-');
  return {
    ok: insideBox && clearsMask && keysInside && outlineOk,
    insideBox,
    clearsMask,
    keysInside,
    outlineOk,
    worstBottom,
    clearance,
    keyOver,
    padBottom,
    padRight,
    rowH: rr.height,
    outlineOffset: cs.outlineOffset,
    details: details.slice(0, 2),
  };
});

const row = page.locator('.create-history__row').first();
await row.screenshot({ path: SHOT });
console.log('GEO', JSON.stringify(geo, null, 2));
console.log('SHOT', SHOT);

await browser.close();
server.close();

if (!geo.ok) {
  console.error('FAIL history row clip checks', geo);
  process.exit(1);
}
console.log('PASS W/L + keys clear Patch3 border slices');
