/**
 * Multi-select drop on the sell chest deletes the whole group.
 *
 *   node scripts/_audit-create-sell-multi.mjs
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8799;

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
  const sell = fs.readFileSync(path.join(ROOT, 'js/pages/create/sell-bin.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'js/pages/create/create.css'), 'utf8');
  const cursor = fs.readFileSync(path.join(ROOT, 'js/pages/create/drag-cursor.js'), 'utf8');
  if (!sell.includes('discardFollowers')) fail('sell-bin missing multi discard');
  else ok('sell-bin discards multi-select followers');
  if (!css.includes('create-board__cursor-group-outline')) fail('group outline CSS missing');
  else ok('held-group outline CSS present');
  if (!css.includes('outline-offset: 8px')) fail('chest outline CSS missing');
  else ok('chest hover outline CSS present');
  if (!cursor.includes('setSellHover')) fail('cursor missing setSellHover');
  else ok('cursor sell-hover outline hook present');
}

async function liveAudit() {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('bpb-create-onboard-skip:v3', '1');
      localStorage.setItem(
        'bpb-create-draft:v1',
        JSON.stringify({
          version: 1,
          title: '',
          blurb: '',
          notes: '',
          hero_class: 'Ranger',
          build_tag: null,
          is_op: false,
          youtube_url: null,
          gold_count: 0,
          rank: null,
          route_r3_item_id: null,
          route_r10_item_id: null,
          starting_bag_id: 'ranger_bag',
          placements: [
            { id: 'ranger_bag', x: 0, y: 0, r: 0, key: 'p-bag' },
            { id: 'stone', x: 0, y: 0, r: 0, key: 'p-a' },
            { id: 'lucky_clover', x: 1, y: 0, r: 0, key: 'p-b' },
          ],
          parked: [],
          history: null,
        }),
      );
    } catch {
      /* ignore */
    }
  });
  await page.goto(`http://127.0.0.1:${PORT}/create/index.html`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForSelector('[data-board-stage]', { timeout: 45000 });
  await page.waitForTimeout(1200);

  const boardBox = await page.locator('[data-board-stage]').boundingBox();
  const sellBox = await page.locator('.create-sellbin').boundingBox();
  if (!boardBox) {
    fail('no board stage');
    await browser.close();
    await new Promise((r) => server.close(r));
    return;
  }
  if (!sellBox) fail('no sell chest');
  else ok('sell chest mounted');

  await page.waitForSelector('.create-board .bpb-bg__item:not(.bpb-bg__item--parked)', {
    timeout: 20000,
  });
  await page.waitForTimeout(400);

  const idA = 'stone';
  const idB = 'lucky_clover';

  const boardKeys = await page.evaluate(() =>
    [...document.querySelectorAll('.create-board .bpb-bg__item:not(.bpb-bg__item--parked)')]
      .map((el) => ({
        id: el.getAttribute('data-item-id'),
        key: el.dataset.placementKey,
      }))
      .filter((row) => row.key),
  );
  if (boardKeys.length < 3) fail(`board has ${boardKeys.length} items after seed`);
  else ok(`board has ${boardKeys.length} items`);

  const nonBagCount = await page.evaluate(
    () =>
      [...document.querySelectorAll('.create-board .bpb-bg__item:not(.bpb-bg__item--parked)')]
        .filter((e) => !e.classList.contains('bpb-bg__item--bag')).length,
  );
  if (nonBagCount < 2) fail(`need two non-bag items, got ${nonBagCount}`);
  else ok(`two items in the bag (${nonBagCount})`);

  const first = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.create-board .bpb-bg__item:not(.bpb-bg__item--parked)')]
      .find((e) => !e.classList.contains('bpb-bg__item--bag'));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const second = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.create-board .bpb-bg__item:not(.bpb-bg__item--parked)')]
      .filter((e) => !e.classList.contains('bpb-bg__item--bag'));
    const el = els[1];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });

  if (!first || !second) {
    fail('could not target two selected items');
  } else {
    await page.keyboard.down('Control');
    await page.mouse.click(first.x, first.y);
    await page.mouse.click(second.x, second.y);
    await page.keyboard.up('Control');
    await page.waitForTimeout(80);

    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    const sellX = sellBox.x + sellBox.width * 0.5;
    const sellY = sellBox.y + sellBox.height * 0.55;
    await page.mouse.move(sellX, sellY, { steps: 16 });
    await page.waitForTimeout(120);

    const hover = await page.evaluate(() => ({
      chest: !!document.querySelector('.create-sellbin.is-drop-hover'),
      group: !!document.querySelector('.create-board__cursor-group-outline:not([hidden])'),
    }));
    if (!hover.chest) fail('chest missing hover outline class');
    else ok('chest outlines while hovered');
    if (!hover.group) fail('held group missing sell outline');
    else ok('held group outlines while over chest');

    await page.mouse.up();
    await page.waitForTimeout(400);

    const after = await page.evaluate(() => ({
      board: [...document.querySelectorAll('.create-board .bpb-bg__item:not(.bpb-bg__item--parked)')]
        .map((el) => el.getAttribute('data-item-id')),
      parked: [...document.querySelectorAll('.create-board__park-chip')].map(
        (el) => el.getAttribute('data-park-id'),
      ),
    }));
    const leftover = after.board.filter((id) => id === idA || id === idB);
    if (leftover.length) fail(`multi sell left board items ${leftover.join(',')}`);
    else ok('multi sell deleted both selected items');
    const parkedFollowers = (after.parked || []).filter((id) => id === idA || id === idB);
    if (parkedFollowers.length) fail(`followers parked ${parkedFollowers.join(',')}`);
    else ok('followers did not land in Parked');
  }

  if (errors.length) fail(`page errors ${errors.join(' | ')}`);
  await browser.close();
  await new Promise((r) => server.close(r));
}

staticAudit();
await liveAudit();
if (process.exitCode) {
  console.error('create sell-multi audit failed');
  process.exit(1);
}
console.log('create sell-multi audit passed');
