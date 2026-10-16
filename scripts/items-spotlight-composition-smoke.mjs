#!/usr/bin/env node

/** Regression for the clicked-item showcase desktop composition scale. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = 8835;
const viewports = [
  { name: '1440p-reference', width: 2560, height: 1440, scale: 1, safeTop: 250, safeBottom: 1100 },
  { name: '1080p', width: 1920, height: 1080, scale: 0.8625, safeTop: 295, safeBottom: 850 },
  { name: 'short-desktop', width: 1366, height: 768, scale: 0.6133, safeTop: 252, safeBottom: 580 },
  { name: '1440-wide', width: 1440, height: 900, scale: 0.646875, safeTop: 250, safeBottom: 716 },
  { name: 'tablet', width: 1024, height: 768, scale: 1, safeTop: 190, safeBottom: 600 },
  { name: 'mobile', width: 390, height: 844, scale: 1, safeTop: 72, safeBottom: 800 },
];

const css = fs.readFileSync(
  path.join(root, 'js/pages/items/spotlight.css'),
  'utf8',
);
const spotlightSource = fs.readFileSync(
  path.join(root, 'js/pages/items/spotlight.js'),
  'utf8',
);

assert.match(
  spotlightSource,
  /navDesktopScale/,
  'spotlight must use the shared desktop composition scale',
);
assert.match(
  spotlightSource,
  /--il-spotlight-desktop-scale/,
  'spotlight must publish the desktop composition scale',
);
assert.match(
  css,
  /scale\(var\(--il-spotlight-desktop-scale/,
  'spotlight CSS must scale the desktop sections from one variable',
);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="/js/pages/items/spotlight.css">
      <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #1e1714; }
        .il-spotlight { visibility: visible; }
        [data-stage] { width: 400px; height: 300px; }
        [data-piece] { width: 100%; height: 100%; background: #c9a227; }
        [data-recipes] { width: 440px; height: 500px; left: 300px; top: 250px; }
        [data-builds] { width: 896px; height: 220px; left: 50%; bottom: 30px; }
      </style>
    </head><body>
      <div class="il-spotlight">
        <div class="il-spotlight__stage" data-stage><div class="il-spotlight__piece" data-piece></div></div>
      </div>
      <aside class="il-spotlight-recipes" data-recipes></aside>
      <aside class="il-spotlight-builds" data-builds></aside>
    </body></html>`);
    return;
  }

  const filePath = path.resolve(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const contentType = path.extname(filePath) === '.js'
    ? 'text/javascript; charset=utf-8'
    : 'text/css; charset=utf-8';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });
    const result = await page.evaluate(async ({ expectedScale, expectedSafeTop, expectedSafeBottom }) => {
      document
        .querySelectorAll('.il-spotlight, [data-recipes], [data-builds]')
        .forEach((el) =>
          el.style.setProperty('--il-spotlight-desktop-scale', String(expectedScale)),
        );
      const { buildRecipeIndex, createSpotlightRecipes } = await import('/js/pages/items/spotlight-recipes.js');
      const recipes = createSpotlightRecipes({
        getItemById: (id) => ({ id, name: id, spriteW: 1, spriteH: 1 }),
        getSpriteUrl: () => '',
        onPickItem: () => {},
      });
      recipes.el.style.setProperty('--il-spotlight-desktop-scale', String(expectedScale));
      recipes.setIndex(buildRecipeIndex(Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        result_item_id: `result-${i + 1}`,
        ingredients: [{ item_id: 'focus', quantity: 1 }],
      }))));
      const safeTop = expectedSafeTop;
      const safeBottom = expectedSafeBottom;
      recipes.showFor('focus', {
        stage: document.querySelector('[data-stage]'),
        piece: document.querySelector('[data-piece]'),
        bounds: () => ({
          top: safeTop,
          bottom: safeBottom,
          left: 12,
          right: window.innerWidth - 12,
        }),
      });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const recipeFixture = document.querySelector('[data-recipes]');
      const buildsFixture = document.querySelector('[data-builds]');
      const { createSpotlight } = await import('/js/pages/items/spotlight.js');
      const runtime = createSpotlight({
        host: document.body,
        getTip: () => null,
        getSpriteUrl: () => '',
        getItemById: () => null,
        getFilteredOrder: () => [],
        recipes: { el: recipeFixture, hide: () => {} },
        builds: { el: buildsFixture, hide: () => {} },
      });
      const runtimeScale = Number(
        getComputedStyle(runtime.el).getPropertyValue('--il-spotlight-desktop-scale'),
      );
      runtime.destroy();
      const selectors = ['[data-stage]', '[data-recipes]', '[data-builds]'];
      const boxes = selectors.map((selector) => {
        const el = document.querySelector(selector);
        const rect = el.getBoundingClientRect();
        return { selector, width: rect.width, height: rect.height };
      });
      const recipeRect = recipes.el.getBoundingClientRect();
      const recipeNatural = {
        width: recipes.el.offsetWidth,
        height: recipes.el.offsetHeight,
      };
      recipes.destroy();
      return {
        boxes,
        recipe: { rect: recipeRect, natural: recipeNatural },
        runtimeScale,
        safeTop,
        safeBottom,
      };
    }, {
      expectedScale: viewport.scale,
      expectedSafeTop: viewport.safeTop,
      expectedSafeBottom: viewport.safeBottom,
    });

    assert.ok(
      Math.abs(result.runtimeScale - viewport.scale) < 0.0001,
      `${viewport.name}: runtime spotlight scale is wrong: ${JSON.stringify(result)}`,
    );

    if (viewport.width <= 900) {
      assert.ok(
        result.recipe.rect.width <= viewport.width + 1,
        `${viewport.name}: live recipe panel exceeds the mobile viewport: ${JSON.stringify(result.recipe)}`,
      );
      await page.close();
      continue;
    }

    for (const entry of result.boxes) {
      const natural = entry.selector === '[data-stage]'
        ? { width: 400, height: 300 }
        : entry.selector === '[data-recipes]'
          ? { width: 440, height: 500 }
          : { width: 896, height: 220 };
      assert.ok(
        Math.abs(entry.width - natural.width * viewport.scale) < 1,
        `${viewport.name}: ${entry.selector} width is not scaled: ${JSON.stringify({ entry, natural, viewport })}`,
      );
      assert.ok(
        Math.abs(entry.height - natural.height * viewport.scale) < 1,
        `${viewport.name}: ${entry.selector} height is not scaled: ${JSON.stringify({ entry, natural, viewport })}`,
      );
    }
    assert.ok(
      Math.abs(result.recipe.rect.width - result.recipe.natural.width * viewport.scale) < 1,
      `${viewport.name}: live recipe panel width is not scaled: ${JSON.stringify(result.recipe)}`,
    );
    assert.ok(
      Math.abs(result.recipe.rect.height - result.recipe.natural.height * viewport.scale) < 1,
      `${viewport.name}: live recipe panel height is not scaled: ${JSON.stringify(result.recipe)}`,
    );
    assert.ok(
      result.recipe.rect.top >= result.safeTop - 1,
      `${viewport.name}: recipe panel overlaps the navigation safe area: ${JSON.stringify(result)}`,
    );
    assert.ok(
      result.recipe.rect.bottom <= result.safeBottom + 1,
      `${viewport.name}: recipe panel overlaps the Builds safe area: ${JSON.stringify(result)}`,
    );
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('Items spotlight composition smoke passed.');
