#!/usr/bin/env node

/** Browser smoke for the build-animation's skeleton-free first paint. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8824;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head>
      <style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#211711}#probe{min-height:420px}</style>
    </head><body><main id="probe"></main></body></html>`);
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
      : ext === '.json'
        ? 'application/json'
        : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const animatedPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await animatedPage.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });
  await animatedPage.evaluate(async () => {
    const { initHomePromoBand } = await import('/js/pages/home/home-promo-band.js');
    initHomePromoBand('#probe', {
      variant: 'create',
      launcher: 'player',
      builds: [{
        id: 'animated-smoke-build',
        slug: 'animated-smoke-build',
        title: 'Animated smoke build',
        hero_class: 'Pyromancer',
        author_id: 'animated-smoke-author',
        placements: [
          {
            id: 'animated-bag-placement',
            x: 0,
            y: 0,
            r: 0,
            item: {
              id: 'leather_bag',
              name: 'Leather Bag',
              type: 'Bag',
              image: 'LeatherBag.png',
              shape: [[1, 1], [1, 1]],
            },
          },
          {
            id: 'animated-item-placement',
            x: 0,
            y: 0,
            r: 0,
            item: {
              id: 'smoke_item',
              name: 'Smoke Item',
              type: 'Weapon',
              image: 'SmokeItem.png',
              shape: [[1]],
            },
          },
        ],
      }],
    });
  });
  await animatedPage.waitForSelector('.home-promo__board .bpb-bg__item[data-item-id="smoke_item"]', { timeout: 5000 });
  const animatedResult = await animatedPage.evaluate(() => ({
    skeletons: document.querySelectorAll('[data-promo-skeleton-stack]').length,
    skeletonVisible: [...document.querySelectorAll('[data-promo-skeleton-stack]')].some((el) => !el.hidden && getComputedStyle(el).display !== 'none'),
    skeletonSurfaces: document.querySelectorAll('.home-promo--player-info .home-promo__skeleton-stack .bpb-skel').length,
    cardReady: document.querySelector('[data-promo-create-card]')?.getAttribute('data-promo-ready') || '',
    cardBusy: document.querySelector('[data-promo-create-card]')?.getAttribute('aria-busy') || '',
    boardItems: document.querySelectorAll('.home-promo__board .bpb-bg__item').length,
  }));
  assert.equal(animatedResult.boardItems, 2, 'animated build paints its bag and item');
  assert.equal(animatedResult.skeletons, 0, 'animated build has no skeleton mounted');
  assert.equal(animatedResult.skeletonVisible, false, 'animated build has no visible skeleton');
  assert.equal(animatedResult.skeletonSurfaces, 0, 'animated build has no skeleton surfaces');
  assert.equal(animatedResult.cardReady, '', 'animated build does not need a skeleton-ready marker');
  assert.equal(animatedResult.cardBusy, '', 'animated build does not expose a skeleton busy state');
  await animatedPage.close();

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { initHomePromoBand } = await import('/js/pages/home/home-promo-band.js');
    initHomePromoBand('#probe', {
      variant: 'create',
      launcher: 'player',
      builds: [{
        id: 'smoke-build',
        slug: 'smoke-build',
        title: 'Smoke build',
        hero_class: 'Pyromancer',
        author_id: 'smoke-author',
        placements: [{
          id: 'smoke-placement',
          x: 0,
          y: 0,
          r: 0,
          item: {
            id: 'leather_bag',
            name: 'Leather Bag',
            type: 'Bag',
            image: 'LeatherBag.png',
            shape: [[1, 1], [1, 1]],
          },
        }],
      }],
    });
  });
  await page.waitForFunction(() => document.querySelector('.home-promo__board .bpb-bg__item') !== null, null, { timeout: 5000 });
  const result = await page.evaluate(() => ({
    skeletons: document.querySelectorAll('[data-promo-skeleton-stack]').length,
    skeletonHidden: [...document.querySelectorAll('[data-promo-skeleton-stack]')].every((el) => el.hidden || getComputedStyle(el).display === 'none'),
    cardReady: document.querySelector('[data-promo-create-card]')?.getAttribute('data-promo-ready') || '',
    cardBusy: document.querySelector('[data-promo-create-card]')?.getAttribute('aria-busy') || '',
    boardItems: document.querySelectorAll('.home-promo__board .bpb-bg__item').length,
  }));
  assert.equal(result.boardItems, 1, 'first build paints its board item');
  assert.equal(result.skeletons, 0, 'build-animation has no skeleton mounted after its final view paints');
  assert.equal(result.skeletonHidden, true, 'build-animation has no visible skeleton after readiness');
  assert.equal(result.cardReady, '', 'build-animation does not need a skeleton-ready marker');
  assert.equal(result.cardBusy, '', 'build-animation does not expose a skeleton busy state');
  await page.close();

  const emptyPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await emptyPage.emulateMedia({ reducedMotion: 'reduce' });
  await emptyPage.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });
  await emptyPage.evaluate(async () => {
    const { initHomePromoBand } = await import('/js/pages/home/home-promo-band.js');
    initHomePromoBand('#probe', {
      variant: 'create',
      launcher: 'player',
      builds: [{ id: 'empty-build', slug: 'empty-build', title: 'Empty build', placements: [] }],
    });
  });
  await emptyPage.waitForTimeout(250);
  const emptyResult = await emptyPage.evaluate(() => ({
    skeletons: document.querySelectorAll('[data-promo-skeleton-stack]').length,
    skeletonHidden: [...document.querySelectorAll('[data-promo-skeleton-stack]')].every((el) => el.hidden || getComputedStyle(el).display === 'none'),
  }));
  assert.equal(emptyResult.skeletons, 0, 'empty loaded build does not leave the loading skeleton mounted');
  assert.equal(emptyResult.skeletonHidden, true, 'empty loaded build does not leave a visible skeleton');
  console.log(JSON.stringify({ firstBuild: result, emptyBuild: emptyResult }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
