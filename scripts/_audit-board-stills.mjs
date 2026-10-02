/**
 * Catalog boards are cached stills, not live grids.
 *   node scripts/_audit-board-stills.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8798;
const OUT = path.join(ROOT, 'scripts/_fixtures');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
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
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const fails = [];
function check(name, ok, detail = '') {
  if (!ok) fails.push(name);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
try {
  await page.waitForSelector('[data-vault-board] .bpb-board-still__img.is-ready', { timeout: 20000 });
} catch {
  /* timed out — counts below */
}

const vault = await page.evaluate(() => {
  const boards = [...document.querySelectorAll('[data-vault-board]')];
  const stills = boards.filter((b) => b.querySelector('.bpb-board-still')).length;
  const ready = boards.filter((b) => b.querySelector('.bpb-board-still__img.is-ready')).length;
  const live = boards.filter((b) => b.querySelector(':scope > .bpb-bg, :scope > .bpb-board-still .bpb-bg')).length;
  const hits = boards.filter((b) => b.querySelector('.bpb-bg__hit')).length;
  const empty = boards.filter((b) => b.querySelector('.bpb-board-still.is-empty')).length;
  const src = boards[0]?.querySelector('.bpb-board-still__img')?.getAttribute('src') || '';
  return { boards: boards.length, stills, ready, live, hits, empty, src: src.slice(0, 24) };
});
console.log('VAULT', vault);
if (errors.length) console.log('ERRORS', errors.slice(0, 8));
check('vault boards mounted', vault.boards > 0);
check('vault uses stills not live grids', vault.stills === vault.boards && vault.live === 0 && vault.hits === 0);
check('vault stills decoded', vault.ready > 0 && vault.ready >= Math.min(4, vault.boards));

const cell = page.locator('[data-vault-build-tip]').first();
if (await cell.count()) {
  await cell.hover({ force: true, timeout: 5000 });
  await page.waitForTimeout(600);
  const tip = await page.evaluate(() => {
    const el = document.querySelector('.build-more-tip:not([hidden])');
    if (!el) return { open: false };
    return {
      open: true,
      still: Boolean(el.querySelector('.bpb-board-still__img')),
      live: Boolean(el.querySelector('.bpb-bg')),
    };
  });
  console.log('TIP', tip);
  check('hover tip opens', tip.open === true);
  check('hover tip is a still', tip.still === true && tip.live === false);
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, 'board-still-vault-tip.png') });
}

await page.goto(`http://127.0.0.1:${PORT}/builds/`, { waitUntil: 'domcontentloaded' });
try {
  await page.waitForSelector('[data-feed-board] .bpb-board-still__img.is-ready', { timeout: 20000 });
} catch {
  /* timed out */
}
const feed = await page.evaluate(() => {
  const boards = [...document.querySelectorAll('[data-feed-board]')];
  const stills = boards.filter((b) => b.querySelector('.bpb-board-still')).length;
  const live = boards.filter((b) => b.querySelector('.bpb-bg__hit')).length;
  return { boards: boards.length, stills, live };
});
console.log('FEED', feed);
check('feed boards mounted', feed.boards > 0);
check('feed uses stills', feed.stills === feed.boards && feed.live === 0);

if (fails.length) {
  console.log(`${fails.length} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log('all checks passed');
}

await browser.close();
server.close();
