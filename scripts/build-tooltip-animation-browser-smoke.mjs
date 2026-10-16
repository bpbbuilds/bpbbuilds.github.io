#!/usr/bin/env node

/** Browser smoke for the build-tooltip Play preview and responsive placement. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8827;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="/js/shared/tooltip.css">
      <link rel="stylesheet" href="/js/shared/backpack-grid/backpack-grid.css">
      <link rel="stylesheet" href="/js/pages/build/more-build-tip.css">
      <style>
        *,*::before,*::after{box-sizing:border-box}
        html,body{margin:0;min-height:100%;background:#201717;color:#fff}
        #root{padding:100px 24px}
        .fixture-thumb{display:block;width:120px;height:80px;border:0;background:#452b26}
      </style>
    </head><body><main id="root"><button id="thumb" class="fixture-thumb" type="button">Build</button></main>
    </body></html>`);
    return;
  }

  const relative = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const filePath = path.resolve(root, relative);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === '.js'
      ? 'text/javascript'
      : ext === '.css'
        ? 'text/css'
        : ext === '.json'
          ? 'application/json'
          : ext === '.png'
            ? 'image/png'
            : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });

  const desktop = await page.evaluate(async () => {
    const { bindMoreBuildTips, registerMoreBuildTip } = await import('/js/pages/build/more-build-tip.js');
    const thumb = document.querySelector('#thumb');
    const root = document.querySelector('#root');
    if (!(thumb instanceof HTMLElement) || !(root instanceof HTMLElement)) throw new Error('fixture missing');

    const item = {
      id: 'ace_fixture',
      name: 'Ace of Spades',
      type: 'Card',
      class: 'Neutral',
      rarity: 'Common',
      image: 'AceofSpades.png',
      shape: [[1]],
      sockets: 0,
      extraTypes: [],
      tags: [],
    };
    const placements = [{ id: item.id, x: 2, y: 2, r: 0, key: 'ace_fixture:0:2,2:0' }];
    const itemsById = new Map([[item.id, item]]);
    const getSpriteUrl = (next) => `/assets/item-sprites/${next.image}`;
    const still = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/4QZzYQAAAABJRU5ErkJggg==';

    registerMoreBuildTip(
      thumb,
      { title: 'Preview', hero_class: 'Adventurer' },
      still,
      { placements, itemsById, getSpriteUrl, root: '/' },
    );
    bindMoreBuildTips(root, { root: '/', overEl: null, thumbSelector: '.fixture-thumb' });
    thumb.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 120, clientY: 120 }));
    await new Promise((resolve) => window.setTimeout(resolve, 420));

    const tip = document.querySelector('.build-more-tip');
    const button = tip?.querySelector('[data-build-tip-play]');
    if (!(tip instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) {
      throw new Error('build tooltip Play button did not mount');
    }
    const before = {
      pressed: button.getAttribute('aria-pressed'),
      pointerEvents: getComputedStyle(button).pointerEvents,
      keyLabel: button.querySelector('[data-build-tip-key]')?.textContent?.trim() || '',
      keyShortcut: button.getAttribute('aria-keyshortcuts'),
      still: Boolean(tip.querySelector('.bpb-board-still')),
      preview: Boolean(tip.querySelector('.build-more-tip__live-grid')),
      buttonInViewport: (() => {
        const rect = button.getBoundingClientRect();
        return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
      })(),
      cornerCenter: (() => {
        const buttonRect = button.getBoundingClientRect();
        const artRect = tip.querySelector('.build-more-tip__preview-art').getBoundingClientRect();
        return {
          x: buttonRect.left + buttonRect.width / 2,
          y: buttonRect.top + buttonRect.height / 2,
          expectedX: artRect.right,
          expectedY: artRect.top,
        };
      })(),
    };

    const waitFor = async (predicate, timeout = 2500) => {
      const started = performance.now();
      while (!predicate()) {
        if (performance.now() - started > timeout) throw new Error('preview state timed out');
        await new Promise((resolve) => window.setTimeout(resolve, 25));
      }
    };

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', bubbles: true }));
    await waitFor(() => button.getAttribute('aria-pressed') === 'true' && Boolean(tip.querySelector('.build-more-tip__live-grid')));
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    const liveItem = tip.querySelector('.build-more-tip__live-grid .bpb-bg__item');
    const playing = {
      pressed: button.getAttribute('aria-pressed'),
      liveGrid: Boolean(tip.querySelector('.build-more-tip__live-grid')),
      liveItem: Boolean(liveItem),
      placementKey: liveItem?.getAttribute('data-placement-key') || null,
      animationClass: Boolean(liveItem?.querySelector('.sim-ani')),
      buttonInViewport: (() => {
        const rect = button.getBoundingClientRect();
        return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight;
      })(),
    };

    button.click();
    await waitFor(() => button.getAttribute('aria-pressed') === 'false' && Boolean(tip.querySelector('.bpb-board-still')));
    const stopped = {
      pressed: button.getAttribute('aria-pressed'),
      liveGrid: Boolean(tip.querySelector('.build-more-tip__live-grid')),
      still: Boolean(tip.querySelector('.bpb-board-still')),
    };
    return { before, playing, stopped };
  });

  assert.equal(desktop.before.pressed, 'false', 'Play starts unpressed');
  assert.equal(desktop.before.pointerEvents, 'auto', 'Play remains clickable inside the tooltip');
  assert.equal(desktop.before.keyLabel, 'Alt', 'tooltip shows the Alt shortcut label');
  assert.equal(desktop.before.keyShortcut, 'Alt', 'tooltip exposes the Alt keyboard shortcut');
  assert.equal(desktop.before.still, true, 'tooltip begins with the cached still');
  assert.equal(desktop.before.preview, false, 'tooltip does not mount the live board before Play');
  assert.equal(desktop.before.buttonInViewport, true, 'desktop Play button stays inside the viewport');
  assert.ok(Math.abs(desktop.before.cornerCenter.x - desktop.before.cornerCenter.expectedX) <= 2, 'Play center aligns to the board top-right x corner');
  assert.ok(Math.abs(desktop.before.cornerCenter.y - desktop.before.cornerCenter.expectedY) <= 2, 'Play center aligns to the board top-right y corner');
  assert.equal(desktop.playing.pressed, 'true', 'Play marks the preview active');
  assert.equal(desktop.playing.liveGrid, true, 'Play mounts the live placed board');
  assert.equal(desktop.playing.liveItem, true, 'live preview paints placed items');
  assert.equal(desktop.playing.placementKey, 'ace_fixture:0:2,2:0', 'live item preserves its placement key');
  assert.equal(desktop.playing.animationClass, true, 'live preview reuses a Sim activation class');
  assert.equal(desktop.playing.buttonInViewport, true, 'desktop Play button stays positioned while playing');
  assert.equal(desktop.stopped.pressed, 'false', 'second click pauses the preview');
  assert.equal(desktop.stopped.liveGrid, false, 'pausing removes the live board');
  assert.equal(desktop.stopped.still, true, 'pausing restores the cached still');

  const responsive = [];
  for (const viewport of [
    { name: 'short-desktop', width: 1080, height: 720 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await new Promise((resolve) => setTimeout(resolve, 360));
    const value = await page.evaluate(() => {
      const tip = document.querySelector('.build-more-tip');
      const button = tip?.querySelector('[data-build-tip-play]');
      if (!(tip instanceof HTMLElement) || !(button instanceof HTMLElement)) return null;
      const rect = button.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();
      return {
        buttonInViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        tipWidth: tipRect.width,
        buttonWidth: rect.width,
        innerWidth,
        transform: getComputedStyle(tip).transform,
        scale: getComputedStyle(tip).getPropertyValue('--build-more-tip-scale'),
        buttonRect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
        tipRect: { left: tipRect.left, right: tipRect.right, top: tipRect.top, bottom: tipRect.bottom },
      };
    });
    assert.ok(value, `${viewport.name}: tooltip remains mounted`);
    assert.equal(value.buttonInViewport, true, `${viewport.name}: Play button stays inside the viewport (${JSON.stringify(value)})`);
    assert.ok(value.buttonWidth > 0 && value.tipWidth > 0, `${viewport.name}: tooltip keeps measurable dimensions`);
    responsive.push({ ...viewport, ...value });
  }

  await page.close();
  console.log(JSON.stringify({ desktop, responsive }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
