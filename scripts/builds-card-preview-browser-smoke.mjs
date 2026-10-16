#!/usr/bin/env node

/** Browser smoke for the Builds card-only Alt + Play preview. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8833;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="/js/shared/backpack-grid/backpack-grid.css">
      <link rel="stylesheet" href="/js/pages/build/more-build-tip.css">
      <link rel="stylesheet" href="/js/pages/builds/builds.css">
      <style>
        *,*::before,*::after{box-sizing:border-box}
        html,body{margin:0;min-height:100%;background:#201717;color:#fff}
        #root{width:min(100% - 48px, 720px);margin:0 auto;padding:96px 0 40px}
        .builds-feed__list{list-style:none;margin:0;padding:0}
        .builds-post{min-height:420px}
        .builds-post__body{min-height:280px}
        .builds-post__stage{display:block!important;margin:0!important;padding:0!important}
        .builds-post__board{--builds-feed-cell:48px!important;position:relative;margin:0 auto!important}
        .builds-post__link{display:block}
        .fixture-still{display:block;width:100%;height:100%;background:rgba(90,55,44,.3)}
      </style>
    </head><body class="page-builds"><main id="root"><ul id="list" class="builds-feed__list builds-feed__list--card"><li id="card" class="builds-post">
      <div class="builds-post__body">
        <button id="play" class="build-more-tip__play builds-post__card-preview" type="button" data-feed-card-preview aria-keyshortcuts="Alt" aria-label="Play board animation" aria-pressed="false" title="Play board animation">
          <span class="build-more-tip__play-key builds-post__card-preview-key" aria-hidden="true">Alt</span>
          <img src="/assets/icons/sim/log/Play_normal.png" alt="" width="28" height="28">
        </button>
        <a class="builds-post__link" href="#"><span class="builds-post__stage"><span id="board" class="builds-post__board"><span class="fixture-still"></span></span><aside class="builds-post__info"></aside></span></a>
      </div>
    </li></ul></main></body></html>`);
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

  const desktopPromise = page.evaluate(async () => {
    const { bindCardBuildPreviews, registerCardBuildPreview } = await import('/js/pages/builds/card-preview.js');
    const card = document.querySelector('#card');
    const button = document.querySelector('#play');
    const board = document.querySelector('#board');
    const list = document.querySelector('#list');
    if (!(card instanceof HTMLElement) || !(button instanceof HTMLButtonElement) || !(board instanceof HTMLElement) || !(list instanceof HTMLElement)) {
      throw new Error('card preview fixture missing');
    }

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
    const liveHost = document.createElement('span');
    liveHost.className = 'builds-post__card-preview-live';
    liveHost.hidden = true;
    liveHost.setAttribute('aria-hidden', 'true');
    board.append(liveHost);

    registerCardBuildPreview(card, button, liveHost, {
      placements,
      itemsById,
      getSpriteUrl: (next) => `/assets/item-sprites/${next.image}`,
      root: '/',
      cellPx: 48,
    });
    const unbind = bindCardBuildPreviews(list);

    const waitFor = async (predicate, timeout = 3000) => {
      const started = performance.now();
      while (!predicate()) {
        if (performance.now() - started > timeout) throw new Error('card preview state timed out');
        await new Promise((resolve) => window.setTimeout(resolve, 25));
      }
    };

    const before = {
      hidden: button.hidden,
      opacity: getComputedStyle(button).opacity,
      pointerEvents: getComputedStyle(button).pointerEvents,
      still: Boolean(board.querySelector('.fixture-still')),
      live: Boolean(liveHost.querySelector('.build-more-tip__live-grid')),
    };

    await new Promise((resolve) => {
      window.__continueCardPreviewSmoke = resolve;
    });

    card.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, relatedTarget: document.body }));
    await new Promise((resolve) => window.setTimeout(resolve, 40));
    const hovered = {
      opacity: getComputedStyle(button).opacity,
      visibility: getComputedStyle(button).visibility,
      pointerEvents: getComputedStyle(button).pointerEvents,
      keyLabel: button.querySelector('.builds-post__card-preview-key')?.textContent?.trim() || '',
      cardOnly: !card.classList.contains('builds-post--compact') && !card.classList.contains('builds-post--grid'),
    };

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', bubbles: true }));
    await waitFor(() => button.getAttribute('aria-pressed') === 'true' && Boolean(liveHost.querySelector('.build-more-tip__live-grid')));
    const playing = {
      pressed: button.getAttribute('aria-pressed'),
      still: Boolean(board.querySelector('.fixture-still')),
      live: Boolean(liveHost.querySelector('.build-more-tip__live-grid')),
      liveItem: Boolean(liveHost.querySelector('.build-more-tip__live-grid .bpb-bg__item')),
      animationClass: Boolean(liveHost.querySelector('.build-more-tip__live-grid .sim-ani')),
    };

    card.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body }));
    await waitFor(() => button.getAttribute('aria-pressed') === 'false' && !liveHost.querySelector('.build-more-tip__live-grid'));
    const stopped = {
      pressed: button.getAttribute('aria-pressed'),
      still: Boolean(board.querySelector('.fixture-still')),
      live: Boolean(liveHost.querySelector('.build-more-tip__live-grid')),
    };

    unbind();
    return { before, hovered, playing, stopped };
  });
  await page.waitForFunction(() => typeof window.__continueCardPreviewSmoke === 'function');
  await page.hover('#card');
  await page.evaluate(() => window.__continueCardPreviewSmoke?.());
  const desktop = await desktopPromise;

  assert.equal(desktop.before.hidden, false, 'card preview control is enabled only after a board preview registers');
  assert.equal(desktop.before.opacity, '0', 'card preview indicator starts hidden');
  assert.equal(desktop.before.pointerEvents, 'none', 'hidden indicator cannot intercept the card');
  assert.equal(desktop.before.still, true, 'cached card still remains before playback');
  assert.equal(desktop.before.live, false, 'card does not mount live preview before Alt');
  assert.equal(desktop.hovered.opacity, '1', 'card hover reveals the indicator');
  assert.equal(desktop.hovered.visibility, 'visible', 'card hover makes the indicator visible');
  assert.equal(desktop.hovered.pointerEvents, 'auto', 'hovered indicator is clickable');
  assert.equal(desktop.hovered.keyLabel, 'Alt', 'indicator shows the Alt key');
  assert.equal(desktop.hovered.cardOnly, true, 'fixture uses card view only');
  assert.equal(desktop.playing.pressed, 'true', 'Alt starts card playback');
  assert.equal(desktop.playing.still, true, 'live playback preserves the cached still under its overlay');
  assert.equal(desktop.playing.live, true, 'Alt mounts the lightweight live board');
  assert.equal(desktop.playing.liveItem, true, 'live card preview paints placed items');
  assert.equal(desktop.playing.animationClass, true, 'live card preview reuses Sim activation animation');
  assert.equal(desktop.stopped.pressed, 'false', 'leaving the card stops playback');
  assert.equal(desktop.stopped.still, true, 'leaving the card keeps the cached still');
  assert.equal(desktop.stopped.live, false, 'leaving the card removes the live overlay');

  const responsive = [];
  for (const viewport of [
    { name: 'short-desktop', width: 1080, height: 720 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.hover('#card');
    const value = await page.evaluate(() => {
      const card = document.querySelector('#card');
      const button = document.querySelector('#play');
      if (!(card instanceof HTMLElement) || !(button instanceof HTMLElement)) return null;
      card.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, relatedTarget: document.body }));
      const rect = button.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      return {
        visible: getComputedStyle(button).visibility === 'visible',
        measurable: rect.width > 0 && rect.height > 0,
        cardRight: cardRect.right,
        buttonCenter: rect.left + rect.width / 2,
        viewportWidth: innerWidth,
      };
    });
    assert.ok(value, `${viewport.name}: card fixture remains mounted`);
    assert.equal(value.visible, true, `${viewport.name}: hover indicator is visible`);
    assert.equal(value.measurable, true, `${viewport.name}: indicator keeps measurable dimensions`);
    assert.ok(value.buttonCenter <= value.viewportWidth + 2, `${viewport.name}: indicator does not drift off-screen (${JSON.stringify(value)})`);
    responsive.push({ ...viewport, ...value });
  }

  await page.close();
  console.log(JSON.stringify({ desktop, responsive }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
