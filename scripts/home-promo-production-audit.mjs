#!/usr/bin/env node

/**
 * Synthetic production-readiness probe for the Home Player Info board.
 *
 * This intentionally exercises the shared placed-grid pipeline with a
 * representative maximum-size board. It does not change product code or
 * claim device-specific frame timings; the report records the local browser
 * measurements as regression evidence for long-lived-cycle stability.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8816;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head>
      <style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0;background:#211711}</style>
      <link rel="stylesheet" href="/js/shared/backpack-grid/backpack-grid.css">
      <link rel="stylesheet" href="/js/pages/home/home-promo-band.css">
    </head><body><div class="home-promo home-promo--player-info"><div id="board" class="home-promo__board" style="width:720px;height:560px;position:relative"></div></div></body></html>`);
    return;
  }
  const filePath = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath);
  const contentType = ext === '.js'
    ? 'text/javascript'
    : ext === '.css'
      ? 'text/css'
      : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  const result = await page.evaluate(async () => {
    const { mountPlacedGrid } = await import('/js/shared/backpack-grid/render.js');
    const host = document.querySelector('#board');
    if (!(host instanceof HTMLElement)) throw new Error('audit board did not mount');

    const items = new Map();
    const placements = [];
    const bagShape = [[1, 1], [1, 1]];
    const itemShape = [[1]];
    for (let i = 0; i < 4; i += 1) {
      const id = `bag-${i}`;
      items.set(id, { id, type: 'Bag', name: id, shape: bagShape });
      placements.push({ id, key: id, x: (i % 2) * 3, y: Math.floor(i / 2) * 3, r: 0 });
    }
    let itemIndex = 0;
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 9; x += 1) {
        if (placements.some((entry) => entry.x === x && entry.y === y)) continue;
        const id = `item-${itemIndex}`;
        items.set(id, { id, type: 'Weapon', name: id, shape: itemShape });
        placements.push({ id, key: id, x, y, r: 0 });
        itemIndex += 1;
      }
    }
    if (placements.length !== 63) throw new Error(`synthetic board expected 63 placements, got ${placements.length}`);
    const bags = placements.filter((entry) => String(entry.id).startsWith('bag-'));
    const grid = mountPlacedGrid(host, {
      placements: [],
      itemsById: items,
      cols: 9,
      rows: 7,
      cellPx: 80,
      getSpriteUrl: () => '',
      promo: true,
      appearNewOnly: true,
      appearOrder: 'diagonal',
      appearStaggerMs: 45,
      preserveBagFabric: true,
    });

    const readBoardCounts = () => ({
      itemNodes: host.querySelectorAll('.bpb-bg__items > .bpb-bg__item').length,
      visibleItems: host.querySelectorAll('.bpb-bg__item:not(.bpb-bg__item--parked)').length,
      fabricCells: host.querySelectorAll('.bpb-bg__fabric .bpb-bg__cell--bag').length,
      appearItems: host.querySelectorAll('.bpb-bg__item--appear').length,
    });
    const stage = (fn) => {
      const start = performance.now();
      fn();
      return performance.now() - start;
    };
    const first = {
      emptyToBagsMs: stage(() => grid.update(bags, items, {
        appear: true,
        appearNewOnly: false,
        preserveBagFabric: false,
      })),
      bagsToItemsMs: stage(() => grid.update(placements, items, {
        appear: true,
        appearNewOnly: true,
        appearMissing: true,
        preserveBagFabric: true,
      })),
      clearMs: stage(() => grid.update([], items)),
    };

    const cycles = [];
    const maxCounts = { itemNodes: 0, visibleItems: 0, fabricCells: 0, appearItems: 0 };
    for (let cycle = 0; cycle < 100; cycle += 1) {
      const started = performance.now();
      grid.update(bags, items, {
        appear: true,
        appearNewOnly: false,
        preserveBagFabric: false,
      });
      const bagMs = performance.now() - started;
      const itemStarted = performance.now();
      grid.update(placements, items, {
        appear: true,
        appearNewOnly: true,
        appearMissing: true,
        preserveBagFabric: true,
      });
      const itemMs = performance.now() - itemStarted;
      const peakCounts = readBoardCounts();
      const clearMs = stage(() => grid.update([], items));
      for (const [key, value] of Object.entries(peakCounts)) {
        maxCounts[key] = Math.max(maxCounts[key], value);
      }
      cycles.push({ bagMs, itemMs, clearMs, totalMs: bagMs + itemMs + clearMs, peakCounts });
    }

    const sorted = (key) => cycles.map((row) => row[key]).sort((a, b) => a - b);
    const percentile = (key, fraction) => {
      const values = sorted(key);
      return values[Math.min(values.length - 1, Math.floor(values.length * fraction))];
    };
    const lastCounts = readBoardCounts();
    const distinctBuildCount = 12;
    let distinctPeakNodes = 0;
    let distinctLastNodes = 0;
    for (let buildIndex = 0; buildIndex < distinctBuildCount; buildIndex += 1) {
      const variant = placements.map((entry) => ({
        ...entry,
        key: `${entry.key}:build-${buildIndex}`,
      }));
      const nextVariant = placements.map((entry) => ({
        ...entry,
        key: `${entry.key}:build-${(buildIndex + 1) % distinctBuildCount}`,
      }));
      const variantBags = variant.filter((entry) => String(entry.id).startsWith('bag-'));
      grid.update(variantBags, items, {
        appear: false,
        appearNewOnly: false,
        preserveBagFabric: false,
      });
      grid.update(variant, items, {
        appear: false,
        appearNewOnly: true,
        appearMissing: true,
        preserveBagFabric: true,
      });
      distinctLastNodes = readBoardCounts().itemNodes;
      distinctPeakNodes = Math.max(distinctPeakNodes, distinctLastNodes);
      grid.update([], items);
      grid.pruneParked({
        keepKeys: new Set(nextVariant.map((entry) => String(entry.key))),
      });
    }
    if (distinctLastNodes > placements.length) {
      throw new Error(`Player Info parked-node prune exceeded one-build bound: ${distinctLastNodes}`);
    }
    grid.destroy();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return {
      placementCount: placements.length,
      bagCount: bags.length,
      first,
      cycles: cycles.length,
      cycleMedianMs: percentile('totalMs', 0.5),
      cycleP95Ms: percentile('totalMs', 0.95),
      cycleMaxMs: percentile('totalMs', 0.999),
      bagP95Ms: percentile('bagMs', 0.95),
      itemP95Ms: percentile('itemMs', 0.95),
      clearP95Ms: percentile('clearMs', 0.95),
      maxCounts,
      lastPeakCounts: cycles[cycles.length - 1]?.peakCounts || {},
      lastCounts,
      distinctBuildCount,
      distinctPeakNodes,
      distinctLastNodes,
      bodyNodesAfterDestroy: document.querySelectorAll('.home-promo__board *').length,
    };
  });
  const metrics = await cdp.send('Performance.getMetrics');
  const heap = await cdp.send('Runtime.getHeapUsage');
  console.log(JSON.stringify({
    ...result,
    performance: Object.fromEntries(
      (metrics.metrics || [])
        .filter((entry) => ['TaskDuration', 'LayoutDuration', 'RecalcStyleDuration', 'LayoutCount', 'RecalcStyleCount'].includes(entry.name))
        .map((entry) => [entry.name, entry.value]),
    ),
    heap,
  }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
