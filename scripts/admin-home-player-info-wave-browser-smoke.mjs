#!/usr/bin/env node

/** Runtime smoke for Player Info fabric preservation and diagonal reveal wiring. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8814;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><link rel="stylesheet" href="/js/shared/backpack-grid/backpack-grid.css"><link rel="stylesheet" href="/js/pages/home/home-promo-band.css"><body data-root="/"><div id="host" class="home-promo--player-info"><div class="home-promo__board" style="width:720px;height:560px;position:relative"></div></div><script type="module">
      window.runPlayerInfoWave = async () => {
        const { mountPlacedGrid } = await import('/js/shared/backpack-grid/render.js');
        const { departBoardItems } = await import('/js/pages/home/home-promo-assemble.js');
        const bag = { id:'bag', name:'Bag', type:'Bag', shape:[[1,1],[1,1]] };
        const item = { id:'item', name:'Item', type:'Weapon', shape:[[1]] };
        const items = new Map([['bag', bag], ['item', item]]);
        const host = document.querySelector('.home-promo__board');
        const grid = mountPlacedGrid(host, {
          placements: [], itemsById: items, cols: 9, rows: 7, cellPx: 80,
          getSpriteUrl: () => '', promo: true, appearNewOnly: true,
          appearOrder: 'diagonal', appearStaggerMs: 45, preserveBagFabric: true,
        });
        const bagPlacement = { id:'bag', key:'bag', x:0, y:0, r:0 };
        grid.update([bagPlacement], items, {
          appear:true,
          appearNewOnly:false,
          preserveBagFabric:false,
        });
        const firstCell = host.querySelector('.bpb-bg__fabric .bpb-bg__cell--bag');
        const firstBag = host.querySelector('.bpb-bg__item--bag');
        const first = {
          cell: firstCell,
          cellDelay: firstCell?.style.getPropertyValue('--bpb-appear-delay') || '',
          bagDelay: firstBag?.style.getPropertyValue('--bpb-appear-delay') || '',
          fabricDelays: [...host.querySelectorAll('.bpb-bg__fabric .bpb-bg__cell--bag')]
            .map((el) => el.style.getPropertyValue('--bpb-appear-delay') || ''),
          cellAnimating: firstCell?.classList.contains('bpb-bg__cell--appear') === true,
          cellAnimationName: firstCell ? getComputedStyle(firstCell).animationName : '',
          bagAnimationName: firstBag ? getComputedStyle(firstBag).animationName : '',
        };
        grid.update([bagPlacement, { id:'item', key:'item', x:4, y:0, r:0 }, { id:'item', key:'item-2', x:5, y:0, r:0 }], items, {
          appear:true,
          appearNewOnly:true,
          appearMissing:true,
          preserveBagFabric:true,
        });
        const secondCell = host.querySelector('.bpb-bg__fabric .bpb-bg__cell--bag');
        const itemEls = [...host.querySelectorAll('.bpb-bg__item[data-item-id="item"]')];
        const itemDelays = itemEls.map((el) => el.style.getPropertyValue('--bpb-appear-delay') || '');
        const itemAnimating = itemEls.every((el) => el.classList.contains('bpb-bg__item--appear'));
        grid.update([], items);
        grid.update([bagPlacement], items, {
          appear:true,
          appearNewOnly:false,
          preserveBagFabric:false,
        });
        const repeatBag = host.querySelector('.bpb-bg__item--bag');
        grid.update([bagPlacement, { id:'item', key:'item', x:4, y:0, r:0 }, { id:'item', key:'item-2', x:5, y:0, r:0 }], items, {
          appear:true,
          appearNewOnly:true,
          appearMissing:true,
          preserveBagFabric:true,
        });
        const repeatItemEls = [...host.querySelectorAll('.bpb-bg__item[data-item-id="item"]')];
        const repeatItemDelays = repeatItemEls.map((el) => el.style.getPropertyValue('--bpb-appear-delay') || '');
        const repeatItemsAnimating = repeatItemEls.every((el) => el.classList.contains('bpb-bg__item--appear'));
        const departPromise = departBoardItems(host);
        const departingCell = host.querySelector('.bpb-bg__fabric .bpb-bg__cell--bag');
        const departure = {
          cellAnimating: departingCell?.classList.contains('home-promo__fabric--depart') === true,
          cellAnimationName: departingCell ? getComputedStyle(departingCell).animationName : '',
          cellDelay: departingCell?.style.getPropertyValue('--home-promo-wave-delay') || '',
        };
        await departPromise;
        return {
          sameCell: first.cell === secondCell,
          fabricCount: host.querySelectorAll('.bpb-bg__fabric .bpb-bg__cell--bag').length,
          first,
          itemDelays,
          itemAnimating,
          repeatBagAnimating: repeatBag?.classList.contains('bpb-bg__item--appear') === true,
          repeatItemDelays,
          repeatItemsAnimating,
          departure,
        };
      };
    </script>`);
    return;
  }
  const filePath = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const ext = path.extname(filePath);
  const contentType = ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });
  const result = await page.evaluate(() => window.runPlayerInfoWave());
  assert.equal(result.sameCell, true, 'second item wave reuses the existing bag fabric cell');
  assert.equal(result.fabricCount, 4, 'all bag capacity cells remain mounted');
  assert.equal(result.first.cellAnimating, true, 'capacity cells join the bag reveal animation');
  assert.equal(result.first.cellDelay, result.first.bagDelay, 'first capacity cell shares the bag delay');
  assert.equal(result.first.bagDelay, '0ms', 'first bag starts the Player Info wave');
  assert.match(result.first.fabricDelays.join(','), /45ms/, 'later capacity cells receive a visible Player Info stagger');
  assert.match(result.itemDelays.join(','), /45ms/, 'later items receive a visible Player Info stagger');
  assert.equal(result.first.cellAnimationName, 'home-promo-fabric-in', 'Player Info capacity cells use the catalog-style fade');
  assert.equal(result.first.bagAnimationName, 'bpb-bg-appear-library', 'bag keeps its placed-board appear animation');
  assert.equal(result.itemAnimating, true, 'new item joins the second reveal wave');
  assert.equal(result.repeatBagAnimating, true, 'pooled bags replay the intro on the next build cycle');
  assert.equal(result.repeatItemsAnimating, true, 'pooled items replay the intro on the next build cycle');
  assert.match(result.repeatItemDelays.join(','), /45ms/, 'replayed items keep the visible Player Info stagger');
  assert.equal(result.departure.cellAnimating, true, 'bag capacity cells receive the departure class');
  assert.equal(result.departure.cellAnimationName, 'home-promo-fabric-out', 'bag capacity cells use the fabric exit animation');
  assert.equal(result.departure.cellDelay, '0ms', 'first bag capacity cell leaves with the first bag delay');
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
