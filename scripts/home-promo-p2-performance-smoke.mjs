#!/usr/bin/env node

/** Measured polish smoke for Player Info viewport/animation scheduling. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const band = await fs.readFile(new URL('js/pages/home/home-promo-band.js', root), 'utf8');
const assemble = await fs.readFile(new URL('js/pages/home/home-promo-assemble.js', root), 'utf8');
const homeCss = await fs.readFile(new URL('js/pages/home/home-promo-band.css', root), 'utf8');
const gridCss = await fs.readFile(new URL('js/shared/backpack-grid/backpack-grid.css', root), 'utf8');

assert.match(band, /PROMO_VIEWPORT_ROOT_MARGIN\s*=\s*'240px 0px'/, 'viewport lead is tuned to 240px');
assert.match(band, /rootMargin:\s*PROMO_VIEWPORT_ROOT_MARGIN/, 'observer uses the tuned lead');
assert.match(assemble, /fadeNewBagChrome\(boardHost/, 'bag chrome remains scoped to the promo board');
assert.doesNotMatch(homeCss, /\.home-promo--player-info[^\{]*\{[^}]*will-change\s*:/, 'Player Info adds no unmeasured will-change rule');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent(`<!doctype html><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#211711}</style><style>${gridCss}</style><style>${homeCss}</style><div class="home-promo home-promo--player-info"><div class="home-promo__board" id="probe-board"><div class="bpb-bg__fabric"></div></div></div><div id="probe-root"></div>`);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const result = await page.evaluate(async () => {
    const root = document.querySelector('#probe-root');
    const board = document.querySelector('#probe-board');
    const fabric = board?.querySelector('.bpb-bg__fabric');
    if (!(root instanceof HTMLElement) || !(board instanceof HTMLElement) || !(fabric instanceof HTMLElement)) {
      throw new Error('performance probe DOM did not mount');
    }

    const makeProbe = (top, margin) => new Promise((resolve) => {
      const probe = document.createElement('div');
      probe.style.cssText = `position:absolute;left:0;top:${top}px;width:10px;height:100px`;
      root.appendChild(probe);
      const observer = new IntersectionObserver((entries) => {
        observer.disconnect();
        resolve(Boolean(entries[0]?.isIntersecting));
      }, { rootMargin: margin, threshold: 0.01 });
      observer.observe(probe);
    });

    const lead240 = await makeProbe(1100, '240px 0px');
    const lead240Outside = await makeProbe(1160, '240px 0px');
    const legacy400 = await makeProbe(1160, '400px 0px');

    for (let i = 0; i < 66; i += 1) {
      const item = document.createElement('div');
      item.className = 'bpb-bg__item bpb-bg__item--bag bpb-bg__item--appear';
      item.style.left = `${i % 9}em`;
      item.style.top = `${Math.floor(i / 9)}em`;
      board.appendChild(item);
      const cell = document.createElement('span');
      cell.className = 'bpb-bg__cell bpb-bg__cell--bag bpb-bg__cell--appear';
      cell.style.left = `${i % 9}em`;
      cell.style.top = `${Math.floor(i / 9)}em`;
      fabric.appendChild(cell);
    }
    const items = [...board.querySelectorAll('.bpb-bg__item--bag')];
    const cells = [...board.querySelectorAll('.bpb-bg__fabric .bpb-bg__cell--bag')];
    const itemStyle = getComputedStyle(items[0]);
    const cellStyle = getComputedStyle(cells[0]);

    const rounds = 5000;
    const queryStart = performance.now();
    for (let i = 0; i < rounds; i += 1) {
      board.querySelectorAll('.bpb-bg__fabric .bpb-bg__cell--bag');
      board.querySelectorAll('.bpb-bg__item--bag');
    }
    const queryMs = performance.now() - queryStart;

    const refStart = performance.now();
    for (let i = 0; i < rounds; i += 1) {
      for (const cell of cells) void cell.classList;
      for (const item of items) void item.classList;
    }
    const refMs = performance.now() - refStart;

    return {
      lead240,
      lead240Outside,
      legacy400,
      itemAnimation: itemStyle.animationName,
      cellAnimation: cellStyle.animationName,
      itemWillChange: itemStyle.willChange,
      cellWillChange: cellStyle.willChange,
      queryMs,
      refMs,
      queryMsPerPass: queryMs / rounds,
      refMsPerPass: refMs / rounds,
      itemCount: items.length,
      cellCount: cells.length,
    };
  });
  const metrics = await cdp.send('Performance.getMetrics');
  const metricMap = Object.fromEntries((metrics.metrics || []).map((entry) => [entry.name, entry.value]));

  assert.equal(result.lead240, true, '240px lead activates a section within the tuned prefetch window');
  assert.equal(result.lead240Outside, false, '240px lead does not activate a section 260px beyond the viewport');
  assert.equal(result.legacy400, true, 'legacy 400px lead would activate that farther section');
  assert.match(result.itemAnimation, /bpb-bg-appear-library/, 'item wave remains transform-based shared animation');
  assert.match(result.cellAnimation, /home-promo-fabric-in/, 'capacity wave remains opacity-based Home animation');
  assert.ok(result.queryMs < 100, `bag fade selector scan remains below 100ms/5000 passes (${result.queryMs.toFixed(2)}ms)`);
  assert.equal(result.itemCount, 66, 'animation probe uses a representative maximum-size board');
  assert.equal(result.cellCount, 66, 'fabric probe uses a representative maximum-size board');

  console.log(JSON.stringify({ ...result, metrics: {
    TaskDuration: metricMap.TaskDuration,
    LayoutDuration: metricMap.LayoutDuration,
    RecalcStyleDuration: metricMap.RecalcStyleDuration,
    LayoutCount: metricMap.LayoutCount,
    RecalcStyleCount: metricMap.RecalcStyleCount,
    JSHeapUsedSize: metricMap.JSHeapUsedSize,
  }}));
} finally {
  await browser.close();
}
