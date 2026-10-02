/**
 * Itemiary viewport window: in-view items mounted, off-screen recycled.
 *
 *   node scripts/_audit-itemiary-virtual.mjs
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8798;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function fail(msg) {
  console.error(`FAIL ${msg}`);
  process.exitCode = 1;
}
function ok(msg) {
  console.log(`ok  ${msg}`);
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      let file = path.join(ROOT, url === '/' ? 'index.html' : url.replace(/^\//, ''));
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        file = path.join(file, 'index.html');
      }
      const rel = path.relative(ROOT, file);
      if (rel.startsWith('..') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      const ext = path.extname(file);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

function staticAudit() {
  const pool = fs.readFileSync(
    path.join(ROOT, 'js/shared/backpack-grid/item-pool.js'),
    'utf8',
  );
  const virt = fs.readFileSync(
    path.join(ROOT, 'js/shared/backpack-grid/item-virtual.js'),
    'utf8',
  );
  const css = fs.readFileSync(
    path.join(ROOT, 'js/shared/backpack-grid/backpack-grid.css'),
    'utf8',
  );
  if (!pool.includes('placementsNearViewport')) fail('item-pool missing viewport slice');
  else ok('item-pool slices to viewport');
  if (!pool.includes('promo !== true')) fail('virtualize should skip homepage promo');
  else ok('promo grids stay fully mounted');
  if (!virt.includes('recycleEntry')) fail('item-virtual missing recycleEntry');
  else ok('off-screen recycle helper present');
  if (!css.includes('bpb-bg__item--leave')) fail('leave animation CSS missing');
  else ok('leave animation CSS present');
  const catalog = fs.readFileSync(
    path.join(ROOT, 'js/pages/items/catalog/index.js'),
    'utf8',
  );
  if (!catalog.includes('scrollToId')) fail('catalog recipe pick missing scrollToId');
  else ok('spotlight recipe pick scrolls off-screen items');
}

async function liveAudit() {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://127.0.0.1:${PORT}/items/index.html`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  await page.waitForSelector('.bpb-bg--itemiary .bpb-bg__item:not(.bpb-bg__item--parked)', {
    timeout: 45000,
  });
  await page.waitForTimeout(600);

  const before = await page.evaluate(() => {
    const scroller = document.querySelector('.items-bag__stage > .bpb-bg');
    const live = [
      ...document.querySelectorAll(
        '.bpb-bg--itemiary .bpb-bg__item:not(.bpb-bg__item--parked)',
      ),
    ];
    const parked = document.querySelectorAll('.bpb-bg--itemiary .bpb-bg__item--parked').length;
    const layout = 517;
    return {
      live: live.length,
      parked,
      total: document.querySelectorAll('.bpb-bg--itemiary .bpb-bg__item').length,
      scrollH: scroller?.scrollHeight || 0,
      clientH: scroller?.clientHeight || 0,
      layout,
    };
  });

  if (before.live < 8) fail(`too few mounted items at top ${before.live}`);
  else ok(`top window mounted ${before.live} items`);
  if (before.total >= 400) fail(`still mounted almost all items (${before.total})`);
  else ok(`DOM stays small (${before.total} nodes, not full library)`);
  if (before.scrollH <= before.clientH + 200) fail(`scroller not tall ${before.scrollH}`);
  else ok('library scroller still full height');

  await page.evaluate(() => {
    const scroller = document.querySelector('.items-bag__stage > .bpb-bg');
    if (scroller) scroller.scrollTop = Math.min(scroller.scrollHeight * 0.45, 2200);
  });
  await page.waitForTimeout(280);

  const mid = await page.evaluate(() => {
    const live = [
      ...document.querySelectorAll(
        '.bpb-bg--itemiary .bpb-bg__item:not(.bpb-bg__item--parked)',
      ),
    ];
    const leaving = document.querySelectorAll('.bpb-bg__item--leave').length;
    const appear = [...live].some((el) =>
      el.classList.contains('bpb-bg__item--appear') ||
      el.classList.contains('bpb-bg__item--appear-bag'),
    );
    const ids = live.map((el) => el.getAttribute('data-item-id'));
    const pending = live.filter((el) =>
      el.classList.contains('bpb-bg__item--sprite-pending'),
    ).length;
    return {
      live: live.length,
      total: document.querySelectorAll('.bpb-bg--itemiary .bpb-bg__item').length,
      leaving,
      appear,
      pending,
      sample: ids.slice(0, 3),
    };
  });

  if (mid.live < 8) fail(`mid-scroll mounted ${mid.live}`);
  else ok(`mid-scroll window mounted ${mid.live} items`);
  if (mid.total >= 400) fail(`mid-scroll DOM exploded ${mid.total}`);
  else ok(`mid-scroll DOM still small (${mid.total})`);
  if (mid.pending > mid.live * 0.6) fail(`too many pending sprites ${mid.pending}/${mid.live}`);
  else ok(`sprites attached (${mid.live - mid.pending}/${mid.live})`);

  const rarity = page.locator('.il-filter [data-toggle="rarity"]').first();
  if (await rarity.count()) {
    await rarity.click();
    await page.waitForTimeout(500);
    const afterFilter = await page.evaluate(() => ({
      live: document.querySelectorAll(
        '.bpb-bg--itemiary .bpb-bg__item:not(.bpb-bg__item--parked)',
      ).length,
    }));
    if (afterFilter.live < 1) fail('filter left the bag empty unexpectedly');
    else ok(`filter still paints (${afterFilter.live} mounted)`);
  }

  const bag = await page.locator('.items-bag__stage').boundingBox();
  if (!bag) fail('bag stage missing');
  else ok(`bag stage visible ${Math.round(bag.width)}×${Math.round(bag.height)}`);

  if (errors.length) fail(`page errors ${errors.join(' | ')}`);
  else ok('no page errors');

  await browser.close();
  await new Promise((r) => server.close(r));
}

staticAudit();
await liveAudit();
if (process.exitCode) {
  console.error('itemiary virtual audit failed');
  process.exit(1);
}
console.log('itemiary virtual audit passed');
