/**
 * E2E: History overlay fills board-minus-park; Load writes placements; Cancel restores onboard.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8767;
const FIXTURE = path.join(ROOT, 'scripts/_fixtures/history-mini.db');
const MAKE = path.join(ROOT, 'scripts/_fixtures/make-history-mini.mjs');

const made = spawnSync(process.execPath, [MAKE], { cwd: ROOT, encoding: 'utf8' });
if (made.status !== 0) {
  console.error(made.stdout || '', made.stderr || '');
  process.exit(1);
}
if (!fs.existsSync(FIXTURE)) {
  console.error('Missing fixture', FIXTURE);
  process.exit(1);
}

// Smoke: rankingDif math (1 win / 0 loss / tries left → positive)
const { computeHistoryRankDisplay } = await import(
  pathToFileURL(
    path.join(ROOT, 'js/pages/create/history/rating-math.js'),
  ).href
);
const sample = computeHistoryRankDisplay(
  55,
  [{ result: 'win' }, { result: 'loss' }],
  3,
);
if (!sample.showRanked || sample.rankingDif == null) {
  console.error('FAIL rating-math sample', sample);
  process.exit(1);
}
console.log('RATING sample', sample);

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
  '.db': 'application/octet-stream',
};

function contentType(filePath) {
  return MIME[path.extname(filePath)] || 'application/octet-stream';
}

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
    res.end('not found ' + rel);
    return;
  }
  res.writeHead(200, { 'Content-Type': contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
console.log('create http://127.0.0.1:' + PORT + '/create/');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('browser error:', msg.text());
});
page.on('pageerror', (err) => console.log('pageerror:', err.message));

await page.goto(`http://127.0.0.1:${PORT}/create/`, {
  waitUntil: 'domcontentloaded',
});
await page.evaluate(() => {
  localStorage.removeItem('bpb-create-draft:v1');
  sessionStorage.removeItem('bpb-create-onboard-skip:v3');
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('[data-board-onboard]:not([hidden])', {
  timeout: 60000,
});
await page.waitForSelector('[data-history-file]', {
  state: 'attached',
  timeout: 15000,
});

/** Overlay = board width/top, height ends at park top (excludes park). */
async function assertOverlayBoardMinusPark() {
  return page.evaluate(() => {
    const overlay = document.querySelector('[data-history-picker]');
    const board = document.querySelector('.create-board');
    const park = document.querySelector('.create-board__park');
    if (!(overlay instanceof HTMLElement) || !(board instanceof HTMLElement)) {
      return { fills: false, detail: { missing: true } };
    }
    const or = overlay.getBoundingClientRect();
    const br = board.getBoundingClientRect();
    const parkTop =
      park instanceof HTMLElement
        ? park.getBoundingClientRect().top
        : br.bottom;
    const expectedH = parkTop - br.top;
    const fills =
      Math.abs(or.top - br.top) <= 2 &&
      Math.abs(or.left - br.left) <= 2 &&
      Math.abs(or.width - br.width) <= 3 &&
      Math.abs(or.height - expectedH) <= 4 &&
      or.bottom <= parkTop + 2;
    return {
      fills,
      detail: {
        overlay: { top: or.top, left: or.left, w: or.width, h: or.height },
        board: { top: br.top, left: br.left, w: br.width, h: br.height },
        expectedH,
        parkTop,
      },
    };
  });
}

// --- Cancel restores onboard ---
await page.locator('[data-history-file]').setInputFiles(FIXTURE);
await page.waitForSelector('[data-history-picker]', { timeout: 30000 });
const fillCancel = await assertOverlayBoardMinusPark();
console.log('FILL (cancel path)', fillCancel);

const hasX = await page.locator('.create-history__close img').count();
console.log('CLOSE ICON', hasX);

await page.locator('[data-history-close]').first().click();
await page.waitForSelector('[data-history-picker]', {
  state: 'detached',
  timeout: 10000,
});
await page.waitForTimeout(200);
const afterCancel = await page.evaluate(() => {
  const o = document.querySelector('[data-board-onboard]');
  return {
    overlayHidden: o?.hidden,
    display: o instanceof HTMLElement ? o.style.display : null,
  };
});
console.log('AFTER CANCEL', afterCancel);

// --- Load into creator ---
await page.evaluate(() => {
  const i = document.querySelector('[data-history-file]');
  if (i instanceof HTMLInputElement) i.value = '';
});
await page.locator('[data-history-file]').setInputFiles(FIXTURE);
await page.waitForSelector('[data-history-picker]', { timeout: 30000 });
const fillLoad = await assertOverlayBoardMinusPark();
console.log('FILL (load path)', fillLoad);

await page.waitForSelector('[data-history-load]:not([disabled])', {
  timeout: 30000,
});
const stripBtn = page
  .locator('.create-history__round-host .build-round-strip__btn')
  .first();
if (await stripBtn.count()) {
  await stripBtn.click();
  await page.waitForTimeout(150);
}
await page.locator('[data-history-load]').click();
await page.waitForSelector('[data-history-picker]', {
  state: 'detached',
  timeout: 15000,
});
await page.waitForTimeout(300);

const afterLoad = await page.evaluate(() => ({
  pickerGone: !document.querySelector('[data-history-picker]'),
  boardItems: document.querySelectorAll('.create-board .bpb-bg__item').length,
  onboardHidden: document.querySelector('[data-board-onboard]')?.hidden,
}));
console.log('AFTER LOAD', afterLoad);

await browser.close();
server.close();

const ok =
  fillCancel.fills &&
  fillLoad.fills &&
  hasX >= 1 &&
  afterCancel.overlayHidden === false &&
  afterLoad.pickerGone &&
  afterLoad.boardItems >= 1;

if (!ok) {
  console.error('FAIL history picker overlay / cancel / load');
  process.exit(1);
}
console.log(
  'PASS history picker board-minus-park; cancel restores onboard; load places items',
);
