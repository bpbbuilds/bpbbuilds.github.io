#!/usr/bin/env node

/** Responsive contract for interactive item hover on the Home build-animation board. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = await fs.readFile(path.join(root, 'js', 'pages', 'home', 'home-promo-band.css'), 'utf8');
const assemble = await fs.readFile(path.join(root, 'js', 'pages', 'home', 'home-promo-assemble.js'), 'utf8');
const render = await fs.readFile(path.join(root, 'js', 'shared', 'backpack-grid', 'render.js'), 'utf8');
const itemPool = await fs.readFile(path.join(root, 'js', 'shared', 'backpack-grid', 'item-pool.js'), 'utf8');

assert.match(assemble, /createTooltipHover/, 'Home promo imports the shared item tooltip hover controller');
assert.match(assemble, /promoTooltip\.bind/, 'Home promo binds tooltip targets on the board');
assert.match(render, /promoInteractive/, 'placed-grid rendering forwards the interactive promo option');
assert.match(itemPool, /promoInteractive/, 'promo item painting accepts the interactive promo option');
assert.match(
  css,
  /\.home-promo--player-info[\s\S]*?\.bpb-bg__hit-pad[\s\S]*?pointer-events:\s*auto\s*!important/,
  'Player Info promo enables item hit pads',
);
assert.match(
  css,
  /\.home-promo--player-info[\s\S]*?\.bpb-bg__mark--socket\.bpb-bg__mark--gem[\s\S]*?pointer-events:\s*auto\s*!important/,
  'Player Info promo enables socketed gem hover targets',
);

const browser = await chromium.launch({ headless: true });
const port = 8831;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head>
      <link rel="stylesheet" href="/js/shared/backpack-grid/backpack-grid.css">
      <link rel="stylesheet" href="/js/shared/tooltip.css">
      <link rel="stylesheet" href="/js/pages/home/home-promo-band.css">
      <script src="/js/shared/tooltip.js"></script>
    </head><body data-root="/"><main id="probe"></main></body></html>`);
    return;
  }
  const filePath = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !(await fs.stat(filePath).catch(() => null))) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath);
  const contentType = ext === '.js'
    ? 'text/javascript'
    : ext === '.css'
      ? 'text/css'
      : ext === '.json'
        ? 'application/json'
        : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(await fs.readFile(filePath));
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>
    <section class="home-promo home-promo--create home-promo--player-info">
      <div class="home-promo__board-wrap"><a class="home-promo__board-link" href="/create/">
        <div class="home-promo__board"><div class="bpb-bg bpb-bg--placed bpb-bg--promo">
          <div class="bpb-bg__board"><div class="bpb-bg__items">
            <div class="bpb-bg__item" data-item-id="smoke_item"><div class="bpb-bg__spin">
              <button class="bpb-bg__hit"><span class="bpb-bg__hit-pad"></span></button>
              <img class="bpb-bg__mark bpb-bg__mark--socket bpb-bg__mark--gem" data-item-id="smoke_gem" alt="" />
            </div></div>
          </div></div>
        </div></div>
      </a></div>
    </section>
  </body></html>`);

  for (const width of [1440, 1080, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const result = await page.evaluate(() => {
      const pad = document.querySelector('.bpb-bg__hit-pad');
      const gem = document.querySelector('.bpb-bg__mark--gem');
      return {
        padPointer: pad ? getComputedStyle(pad).pointerEvents : '',
        gemPointer: gem ? getComputedStyle(gem).pointerEvents : '',
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    assert.equal(result.padPointer, 'auto', `item hit pad is interactive at ${width}px`);
    assert.equal(result.gemPointer, 'auto', `socketed gem is interactive at ${width}px`);
    assert.equal(result.overflow, false, `promo board does not overflow at ${width}px`);
  }

  await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { mountPlacedGrid } = await import('/js/shared/backpack-grid/render.js');
    const { createTooltipHover } = await import('/js/shared/tooltip-hover.js');
    const promo = document.createElement('section');
    promo.className = 'home-promo home-promo--player-info';
    const boardHost = document.createElement('div');
    boardHost.className = 'home-promo__board';
    promo.append(boardHost);
    document.querySelector('#probe').append(promo);

    const item = {
      id: 'smoke_item',
      name: 'Smoke Item',
      type: 'Weapon',
      class: 'Neutral',
      rarity: 'Rare',
      shape: [[1, 1, 2]],
      effect: 'Smoke effect',
    };
    const gem = {
      id: 'smoke_gem',
      name: 'Smoke Gem',
      type: 'Gem',
      class: 'Neutral',
      rarity: 'Common',
      shape: [[1]],
    };
    const itemsById = new Map([
      [item.id, item],
      [gem.id, gem],
    ]);
    mountPlacedGrid(boardHost, {
      placements: [{ id: item.id, x: 1, y: 1, r: 0, gems: [gem.id] }],
      itemsById,
      cols: 9,
      rows: 7,
      getSpriteUrl: (entry) => `/assets/items/${entry.id}.png`,
      fillWidth: true,
      exactBoard: true,
      reserveScrollGap: false,
      cellPx: 26,
      promo: true,
      promoInteractive: true,
    });

    const tooltip = createTooltipHover();
    tooltip.bind(boardHost, {
      selector:
        '.bpb-bg__mark--gem[data-item-id], .bpb-bg__item[data-item-id]:not(.bpb-bg__item--parked)',
      getItem: (el) => itemsById.get(String(el.dataset.itemId || '').toLowerCase()) || itemsById.get(String(el.dataset.itemId || '')) || null,
      place: 'near',
    });
  });
  await page.waitForSelector('.bpb-bg__hit-pad');
  await page.locator('.bpb-bg__hit-pad').first().hover();
  await page.waitForFunction(() => document.querySelector('.bpb-tooltip-float.is-visible')?.textContent?.includes('Smoke Item'));
  const runtime = await page.evaluate(() => ({
    hitPad: Boolean(document.querySelector('.bpb-bg__hit-pad')),
    star: Boolean(document.querySelector('.bpb-bg__mark--star')),
    socketedGem: Boolean(document.querySelector('.bpb-bg__mark--socket.bpb-bg__mark--gem')),
    itemTooltip: document.querySelector('.bpb-tooltip-float.is-visible')?.textContent?.includes('Smoke Item') === true,
  }));
  assert.equal(runtime.hitPad, true, 'interactive promo board renders item hit pads');
  assert.equal(runtime.star, true, 'interactive promo board renders affect/star markers');
  assert.equal(runtime.socketedGem, true, 'interactive promo board renders socketed gem targets');
  assert.equal(runtime.itemTooltip, true, 'hovering an item opens its normal tooltip');

  await page.locator('.bpb-bg__mark--socket.bpb-bg__mark--gem').hover();
  await page.waitForFunction(() => document.querySelector('.bpb-tooltip-float.is-visible')?.textContent?.includes('Smoke Gem'));
  const gemTooltip = await page.locator('.bpb-tooltip-float.is-visible').textContent();
  assert.match(gemTooltip || '', /Smoke Gem/, 'hovering a socketed gem opens its tooltip');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('Home promo item hover smoke passed.');
