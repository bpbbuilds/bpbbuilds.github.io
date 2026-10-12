import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8813;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><body data-root="/"><div id="board"><div class="bpb-bg__under"></div><div class="bpb-bg__items"></div></div><script type="module">
      import { createItemEl, stampAffectCells } from '/js/shared/backpack-grid/item-pieces.js';
      import { bindRarityHover } from '/js/shared/backpack-grid/rarity-hover.js';
      const board = document.querySelector('#board'); const under = board.querySelector('.bpb-bg__under'); const items = board.querySelector('.bpb-bg__items');
      const bag = { id:'leather_bag', name:'Leather Bag', type:'Bag', shape:[[1,1]], class:'Neutral' };
      const time = { id:'time_melting', name:'Time Melting', type:'Accessory', shape:[[1,2]], class:'Neutral' };
      const hammer = { id:'hammer', name:'Hammer', type:'Melee Weapon', shape:[[1]], class:'Neutral', params:{ dur_stun:0.5 }, cooldown:2 };
      for (const [item, key, x] of [[bag,'bag',0],[time,'time',0],[hammer,'hammer',1]]) {
        const el = createItemEl(item, () => '', 1, 0, [], { shadow:false });
        el.classList.remove('bpb-bg__item--parked'); el.dataset.placementKey = key; items.append(el);
        stampAffectCells(el, item, x, 0, 0);
      }
      bindRarityHover(board);
      window.ready = true;
    </script>`);
    return;
  }
  const filePath = path.join(ROOT, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'application/json' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/harness`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.ready);
await page.locator('[data-placement-key="time"] .bpb-bg__hit').dispatchEvent('pointerover');
await page.waitForTimeout(50);

assert.equal(await page.locator('[data-placement-key="hammer"]').getAttribute('data-has-inventory-duration'), '1', 'Hammer exposes named duration parameters to hover logic');
assert.equal(await page.locator('[data-placement-key="time"] .bpb-bg__mark--star').evaluate((el) => el.classList.contains('is-active')), true, 'Time Melting lights its Hammer star when hovering after placement');

await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log('Create duration hover smoke passed.');
