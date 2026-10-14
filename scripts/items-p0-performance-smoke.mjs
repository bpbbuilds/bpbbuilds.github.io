#!/usr/bin/env node

/** Focused contract for the completed Items-page P0 performance fixes. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFile(path.join(root, file), 'utf8');
const [itemsPage, nav, catalog, pieces, pool] = await Promise.all([
  read('js/pages/items/index.js'),
  read('js/shared/nav.js'),
  read('js/pages/items/catalog/index.js'),
  read('js/shared/backpack-grid/item-pieces.js'),
  read('js/shared/backpack-grid/item-pool.js'),
]);

assert.match(itemsPage, /initNav\('#site-nav',\s*\{[\s\S]*onAccessGranted/);
assert.match(itemsPage, /catalogPromise\s*\|\|\s*initItemsCatalog/);
assert.match(nav, /const allowed = await initSiteAccess\(\);[\s\S]*onAccessGranted/);
assert.match(catalog, /let pendingFiltered = null/);
assert.match(catalog, /pendingFiltered = filteredItemsForState\(\)/);
assert.match(catalog, /paintGrid\(host, \{ appear: true, filtered \}\)/);
assert.doesNotMatch(pool, /if \(near\.length\) \{\s*await warmItemSprites/);
assert.match(pool, /void warmItemSprites\(near\.map\(\(e\) => e\.itemEl\), \{[\s\S]*isCurrent:[\s\S]*\}\)\.catch/);
assert.match(pieces, /itemWaits\.push\([\s\S]*Promise\.all\(waits\)\.then\([\s\S]*isCurrent[\s\S]*sprite-pending/);
assert.match(pool, /queueScrollPaint\(\);[\s\S]*scrollTimer = window\.setTimeout/);
assert.match(pool, /export const ITEMIARY_POOL_MAX_ENTRIES = 384/);
assert.match(pool, /export const ITEMIARY_PACK_LAYOUT_CACHE_MAX = 24/);
assert.match(pool, /const packedLayoutCache = new Map/);
assert.match(pool, /buildPlacementIndex\(placements, itemsById\)/);
assert.match(pool, /placementsNearViewport\([\s\S]*placementIndex/);
assert.match(pool, /function touchPoolEntry\([\s\S]*pool\.delete\(key\)[\s\S]*pool\.set\(key, entry\)/);
assert.match(pool, /function pruneItemiaryPool\([\s\S]*recycleEntry\(entry\)/);
assert.match(catalog, /virtualPadEm: 6,[\s\S]*virtualPadMaxEm: 14,[\s\S]*adaptivePad: true/);
assert.match(pool, /const adaptivePad = options\.adaptivePad === true/);
assert.match(catalog, /function filterStateSignature\(\)/);
assert.match(catalog, /let filterResultCache = new Map/);
assert.match(catalog, /filterItems\(allItems, filterState, filterMeta\(\)\)/);

const {
  createFilterIndex,
  defaultFilterState,
  filterItems,
} = await import('../js/pages/items/filter-logic.js');
const filterFixtures = [
  {
    id: 'neutral', name: 'Neutral Charm', rarity: 'Common', type: 'Accessory',
    class: 'Neutral', classMask: 127, extraTypes: [], effect: '', mentionedStacks: [],
  },
  {
    id: 'ranger', name: 'Ranger Poison Blade', rarity: 'Rare', type: 'Melee Weapon',
    class: 'Ranger', classMask: 1, extraTypes: [], effect: '$Melee <Poison>',
    mentionedStacks: ['Poison'],
  },
  {
    id: 'treasure', name: 'Treasure Skill', rarity: 'Unique', type: 'Skill',
    class: 'Neutral', classMask: 127, isTreasure: true, extraTypes: [], effect: '',
    mentionedStacks: [],
  },
  {
    id: 'class-unique', name: 'Ranger Unique Armor', rarity: 'Unique', type: 'Armor',
    class: 'Ranger', classMask: 1, isTreasure: false, extraTypes: [], effect: '',
    mentionedStacks: [],
  },
];
const filterMetaFixture = {
  craftedIds: new Set(),
  gatedIds: new Set(),
  shopItemIds: new Set(),
  treasureIds: new Set(['treasure']),
};
const filterStateFixture = defaultFilterState();
filterStateFixture.types.Melee = true;
filterStateFixture.stacks.Poison = true;
const filterIndexFixture = createFilterIndex(filterFixtures, filterMetaFixture);
const indexedIds = filterItems(filterFixtures, filterStateFixture, {
  ...filterMetaFixture,
  index: filterIndexFixture,
}).map((item) => item.id);
assert.deepEqual(indexedIds, ['ranger'], 'normalized filter index preserves game matching');

const svg = (color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${color}"/></svg>`;
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
  if (pathname === '/fast.svg') {
    res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' });
    res.end(svg('#39c'));
    return;
  }
  if (pathname === '/slow.svg') {
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' });
      res.end(svg('#c93'));
    }, 650);
    return;
  }
  if (pathname === '/index.html' || pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><html><body></body></html>');
    return;
  }
  const file = path.join(root, pathname.replace(/^\/+/, ''));
  if (!file.startsWith(root) || !file.endsWith('.js')) {
    res.writeHead(404);
    res.end();
    return;
  }
  fs.readFile(file)
    .then((data) => {
      res.writeHead(200, {
        'content-type': 'text/javascript',
        'access-control-allow-origin': '*',
      });
      res.end(data);
    })
    .catch(() => {
      res.writeHead(404);
      res.end();
    });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const port = typeof address === 'object' && address ? address.port : 0;
assert.ok(port, 'smoke server started');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  const result = await page.evaluate(async ({ port: serverPort }) => {
    const { warmItemSprites } = await import(
      `http://127.0.0.1:${serverPort}/js/shared/backpack-grid/item-pieces.js`
    );
    document.body.innerHTML = `
      <div class="bpb-bg--itemiary">
        <div id="fast" class="bpb-bg__item bpb-bg__item--sprite-pending">
          <img class="bpb-bg__sprite" data-src="/fast.svg" alt="fast">
        </div>
        <div id="slow" class="bpb-bg__item bpb-bg__item--sprite-pending">
          <img class="bpb-bg__sprite" data-src="/slow.svg" alt="slow">
        </div>
      </div>`;
    const fast = document.querySelector('#fast');
    const slow = document.querySelector('#slow');
    const warming = warmItemSprites([fast, slow]);
    await new Promise((resolve) => setTimeout(resolve, 180));
    const progressive = {
      fastReady: !fast.classList.contains('bpb-bg__item--sprite-pending'),
      slowStillPending: slow.classList.contains('bpb-bg__item--sprite-pending'),
    };
    await warming;
    return {
      ...progressive,
      allReady:
        !fast.classList.contains('bpb-bg__item--sprite-pending') &&
        !slow.classList.contains('bpb-bg__item--sprite-pending'),
    };
  }, { port });

  assert.equal(result.fastReady, true, 'fast sprite clears independently');
  assert.equal(result.slowStillPending, true, 'slow sprite does not block fast sprite');
  assert.equal(result.allReady, true, 'all sprites eventually clear pending state');

  const poolResult = await page.evaluate(async ({ port: serverPort }) => {
    const { mountItemiaryGrid, ITEMIARY_POOL_MAX_ENTRIES } = await import(
      `http://127.0.0.1:${serverPort}/js/shared/backpack-grid/item-pool.js`
    );
    const { buildPlacementIndex, placementsNearViewport } = await import(
      `http://127.0.0.1:${serverPort}/js/shared/backpack-grid/item-virtual.js`
    );
    const indexedItems = new Map(
      Array.from({ length: 80 }, (_, index) => [
        `index-${index}`,
        { id: `index-${index}`, shape: [[1]], type: 'Weapon' },
      ]),
    );
    const indexedPlacements = Array.from({ length: 80 }, (_, index) => ({
      id: `index-${index}`,
      x: index % 8,
      y: Math.floor(index / 8),
    }));
    const viewportMetrics = {
      cellPx: 20,
      rows: 10,
      scrollTop: 20,
      clientHeight: 60,
      scrollLeft: 0,
      clientWidth: 160,
    };
    const placementIndex = buildPlacementIndex(indexedPlacements, indexedItems);
    const indexedIds = placementsNearViewport(
      indexedPlacements,
      indexedItems,
      viewportMetrics,
      2,
      placementIndex,
    ).map((placement) => placement.id);
    const scannedIds = placementsNearViewport(
      indexedPlacements,
      indexedItems,
      viewportMetrics,
      2,
    ).map((placement) => placement.id);
    const style = document.createElement('style');
    style.textContent = '.bpb-bg{height:120px;overflow:auto;width:800px}.bpb-bg__board{position:relative}';
    document.head.append(style);
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    const items = Array.from({ length: 1200 }, (_, index) => ({
      id: `pool-${index}`,
      name: `Pool ${index}`,
      image: 'fast.svg',
      type: 'Weapon',
      rarity: 'Common',
      shape: [[1]],
    }));
    const grid = mountItemiaryGrid(host, {
      getSpriteUrl: () => '/fast.svg',
      cellPx: 34,
      cols: 20,
      virtualPadEm: 6,
    });
    grid.ensurePool(items);
    await grid.showPacked(items, { compact: true });
    const initial = document.querySelectorAll(
      '.bpb-bg--itemiary .bpb-bg__item',
    ).length;
    const firstBefore = document.querySelector(
      '.bpb-bg--itemiary .bpb-bg__item:not(.bpb-bg__item--parked)',
    )?.getAttribute('data-item-id');
    grid.el.scrollTop = grid.el.scrollHeight;
    grid.el.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => setTimeout(resolve, 45));
    const firstAfterImmediate = document.querySelector(
      '.bpb-bg--itemiary .bpb-bg__item:not(.bpb-bg__item--parked)',
    )?.getAttribute('data-item-id');
    await new Promise((resolve) => setTimeout(resolve, 220));
    const total = document.querySelectorAll(
      '.bpb-bg--itemiary .bpb-bg__item',
    ).length;
    grid.destroy();
    return {
      initial,
      total,
      max: ITEMIARY_POOL_MAX_ENTRIES,
      immediate: firstBefore !== firstAfterImmediate,
      indexedViewportMatches: JSON.stringify(indexedIds) === JSON.stringify(scannedIds),
    };
  }, { port });

  assert.ok(poolResult.initial < poolResult.max, 'initial window stays below pool cap');
  assert.equal(poolResult.immediate, true, 'scroll window updates on the next frame');
  assert.ok(poolResult.total <= poolResult.max, 'parked Itemiary pool stays bounded');
  assert.equal(poolResult.indexedViewportMatches, true, 'row-indexed viewport matches full scan');
  console.log('items P0 performance smoke passed', { ...result, pool: poolResult });
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
