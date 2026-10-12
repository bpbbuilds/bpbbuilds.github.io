import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8812;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><link rel="stylesheet" href="/js/shared/backpack-grid/backpack-grid.css"><link rel="stylesheet" href="/js/pages/create/create.css"><body class="page-create"><div class="create-board"><div id="board" class="bpb-bg bpb-bg--placed" style="position:relative;width:720px;height:560px;--bpb-bg-cell:80px"><div class="bpb-bg__items"></div></div></div><script type="module">
      import { createItemEl } from '/js/shared/backpack-grid/item-pieces.js';
      import { createDragAffectPreview } from '/js/pages/create/drag-affect.js';
      const fanny = { id:'fanny_pack', name:'Fanny Pack', type:'Bag', shape:[[1]], effect:'Items inside gain speed.' };
      const leather = { id:'leather_bag', name:'Leather Bag', type:'Bag', shape:[[1]] };
      const endurance = { id:'puzzlebag_j', name:'Puzzlebag of Endurance', type:'Bag', shape:[[1,0,0],[1,1,1]], params:{ p1:30, bonusdur:30 } };
      const hammer = { id:'hammer', name:'Hammer', type:'Melee Weapon', cooldown:2, shape:[[1,1,1],[0,1,0],[0,1,0]], params:{ p1:0.5, dur_stun:0.5 } };
      const board = document.querySelector('#board'); const items = board.querySelector('.bpb-bg__items');
      for (const [item, key, x] of [[fanny, 'fanny', 0], [leather, 'leather', 2], [endurance, 'endurance', 4]]) {
        const el = createItemEl(item, () => '', 1, 0, [], { shadow:false });
        el.classList.remove('bpb-bg__item--parked'); el.dataset.placementKey = key; el.style.left = x + 'em'; items.append(el);
      }
      window.syncBagBorders = createDragAffectPreview(document.querySelector('.create-board'), () => board);
      window.synergy = { hammer, fanny, leather, endurance };
    </script>`);
    return;
  }
  const filePath = path.join(ROOT, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': path.extname(filePath) === '.js' ? 'text/javascript' : path.extname(filePath) === '.css' ? 'text/css' : 'application/json' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/harness`, { waitUntil: 'networkidle' });

for (const viewport of [{ width: 1440, height: 900 }, { width: 1080, height: 720 }, { width: 800, height: 900 }, { width: 390, height: 844 }]) {
  await page.setViewportSize(viewport);
  const state = await page.evaluate(() => {
    const board = document.querySelector('#board');
    const rect = board.getBoundingClientRect();
    window.syncBagBorders.syncBagBorders({
        item: window.synergy.hammer,
        placements: [
          { id:'fanny_pack', key:'fanny', x:0, y:0 },
          { id:'leather_bag', key:'leather', x:2, y:0 },
          { id:'puzzlebag_j', key:'endurance', x:4, y:0 },
        ],
        itemsById: new Map([
          ['fanny_pack', window.synergy.fanny],
          ['leather_bag', window.synergy.leather],
          ['puzzlebag_j', window.synergy.endurance],
        ]),
      clientX: rect.left + 20,
      clientY: rect.top + 20,
    });
    const read = (key) => {
      const el = document.querySelector(`[data-placement-key="${key}"]`);
      return { active: el.classList.contains('is-drag-synergy'), hover: el.classList.contains('is-drag-synergy-hover'), slots: getComputedStyle(el.querySelector('.bpb-bg__bag-slots')).display };
    };
    return { fanny: read('fanny'), leather: read('leather'), endurance: read('endurance') };
  });
  assert.deepEqual(state.fanny, { active: true, hover: true, slots: 'block' }, `compatible Fanny Pack is highlighted at ${viewport.width}px`);
  assert.deepEqual(state.leather, { active: false, hover: false, slots: 'none' }, `plain Leather Bag stays unhighlighted at ${viewport.width}px`);
  assert.deepEqual(state.endurance, { active: true, hover: false, slots: 'block' }, `Puzzle Bag of Endurance is highlighted for Hammer at ${viewport.width}px`);
}

const enduranceHover = await page.evaluate(() => {
  const board = document.querySelector('#board');
  const rect = board.getBoundingClientRect();
  window.syncBagBorders.syncBagBorders({
    item: window.synergy.hammer,
    placements: [
      { id:'fanny_pack', key:'fanny', x:0, y:0 },
      { id:'leather_bag', key:'leather', x:2, y:0 },
      { id:'puzzlebag_j', key:'endurance', x:4, y:0 },
    ],
    itemsById: new Map([
      ['fanny_pack', window.synergy.fanny],
      ['leather_bag', window.synergy.leather],
      ['puzzlebag_j', window.synergy.endurance],
    ]),
    clientX: rect.left + (4 * rect.width / 9) + 20,
    clientY: rect.top + 20,
  });
  const el = document.querySelector('[data-placement-key="endurance"]');
  return { hover: el.classList.contains('is-drag-synergy-hover'), outline: getComputedStyle(el.querySelector('.bpb-bg__cell--bag')).outlineStyle };
});
assert.deepEqual(enduranceHover, { hover: true, outline: 'dashed' }, 'Puzzle Bag of Endurance gets the game-like hovered border');

const legacyNoKey = await page.evaluate(() => {
  const board = document.querySelector('#board');
  const rect = board.getBoundingClientRect();
  const el = document.querySelector('[data-placement-key="endurance"]');
  // paintPooled's real fallback for legacy/HistoryDB placements without p.key.
  el.dataset.placementKey = 'puzzlebag_j:0:4,0';
  window.syncBagBorders.syncBagBorders({
    item: window.synergy.hammer,
    placements: [
      { id:'puzzlebag_j', x:4, y:0 },
    ],
    itemsById: new Map([['puzzlebag_j', window.synergy.endurance]]),
    clientX: rect.left + 20,
    clientY: rect.top + 20,
  });
  return el.classList.contains('is-drag-synergy');
});
assert.equal(legacyNoKey, true, 'legacy Puzzle Bag of Endurance placement highlights without an explicit key');

const realPlacedFabric = await page.evaluate(async () => {
  const { mountPlacedGrid } = await import('/js/shared/backpack-grid/render.js');
  const host = document.createElement('div');
  host.className = 'create-board';
  host.style.cssText = 'width:720px;height:560px;position:relative';
  document.body.append(host);
  const items = new Map([
    ['puzzlebag_j', window.synergy.endurance],
    ['hammer', window.synergy.hammer],
  ]);
  const placement = { id: 'puzzlebag_j', x: 4, y: 0, r: 0 };
  const grid = mountPlacedGrid(host.querySelector('.create-board') || host, {
    placements: [placement],
    itemsById: items,
    cols: 9,
    rows: 7,
    cellPx: 80,
    getSpriteUrl: () => '',
    ringConfig: true,
  });
  const board = grid.el.querySelector('.bpb-bg__board');
  const rect = board.getBoundingClientRect();
  const realAffect = (await import('/js/pages/create/drag-affect.js')).createDragAffectPreview(
    host,
    () => board,
  );
  realAffect.syncBagBorders({
    item: window.synergy.hammer,
    placements: [placement],
    itemsById: items,
    clientX: rect.left + 20,
    clientY: rect.top + 20,
  });
  const bag = board.querySelector('[data-placement-key="puzzlebag_j:0:4,0"]');
  const fabricCell = board.querySelector('.bpb-bg__fabric .bpb-bg__cell--bag');
  return {
    bagActive: bag.classList.contains('is-drag-synergy'),
    fabricActive: fabricCell?.classList.contains('is-drag-synergy') === true,
    fabricHover: fabricCell?.classList.contains('is-drag-synergy-hover') === true,
  };
});
assert.deepEqual(
  realPlacedFabric,
  { bagActive: true, fabricActive: true, fabricHover: false },
  'real placed-board fabric exposes the Puzzle Bag of Endurance outline',
);

const emptyKeyPlacement = await page.evaluate(async () => {
  const { mountPlacedGrid } = await import('/js/shared/backpack-grid/render.js');
  const host = document.createElement('div');
  host.className = 'create-board';
  host.style.cssText = 'width:720px;height:560px;position:relative';
  document.body.append(host);
  const items = new Map([
    ['puzzlebag_j', window.synergy.endurance],
    ['hammer', window.synergy.hammer],
  ]);
  const placement = { id: 'puzzlebag_j', key: '', x: 4, y: 0, r: 0 };
  const grid = mountPlacedGrid(host, {
    placements: [placement],
    itemsById: items,
    cols: 9,
    rows: 7,
    cellPx: 80,
    getSpriteUrl: () => '',
    ringConfig: true,
  });
  const board = grid.el.querySelector('.bpb-bg__board');
  const rect = board.getBoundingClientRect();
  const realAffect = (await import('/js/pages/create/drag-affect.js')).createDragAffectPreview(
    host,
    () => board,
  );
  realAffect.syncBagBorders({
    item: window.synergy.hammer,
    placements: [placement],
    itemsById: items,
    clientX: rect.left + 20,
    clientY: rect.top + 20,
  });
  const bag = board.querySelector('.bpb-bg__item--bag');
  return {
    key: bag?.dataset.placementKey || '',
    active: bag?.classList.contains('is-drag-synergy') === true,
  };
});
assert.deepEqual(
  emptyKeyPlacement,
  { key: 'puzzlebag_j:0:4,0', active: true },
  'HistoryDB empty-key Puzzle Bag of Endurance placement highlights for Hammer',
);

await page.evaluate(() => window.syncBagBorders.clear());
assert.equal(await page.locator('[data-placement-key="fanny"]').evaluate((el) => el.classList.contains('is-drag-synergy')), false, 'drop/cancel clears bag border');
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log('create bag-synergy browser smoke: ok');
