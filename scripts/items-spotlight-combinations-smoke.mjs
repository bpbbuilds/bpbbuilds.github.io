#!/usr/bin/env node

/** Regression for the clicked-item combinations panel's desktop safe area. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = 8837;
const viewports = [
  { name: '1440p-reference', width: 2560, height: 1440, scale: 1, nav: 250, builds: 1100 },
  { name: '1080p', width: 1920, height: 1080, scale: 0.8625, nav: 295, builds: 850 },
  { name: 'short-desktop', width: 1366, height: 768, scale: 0.6133, nav: 252, builds: 580 },
  { name: '1440-wide', width: 1440, height: 900, scale: 0.646875, nav: 250, builds: 716 },
  { name: 'tablet', width: 1024, height: 768, scale: 1, nav: 190, builds: 600 },
  { name: 'mobile', width: 390, height: 844, scale: 1, nav: 72, builds: 800 },
];

const spotlightSource = fs.readFileSync(
  path.join(root, 'js/pages/items/spotlight.js'),
  'utf8',
);
const recipesSource = fs.readFileSync(
  path.join(root, 'js/pages/items/spotlight-recipes.js'),
  'utf8',
);

assert.match(
  spotlightSource,
  /recipes\?\.showFor\([\s\S]*?bounds:\s*spotlightBounds/,
  'spotlight must pass the live nav/builds bounds to combinations',
);
assert.match(
  spotlightSource,
  /await opts\.builds\?\.showFor\(item\.id\)[\s\S]*?recipes\?\.layout/,
  'spotlight must relayout combinations after Builds using this item appears',
);
assert.match(
  recipesSource,
  /safeTop[\s\S]*?safeBottom[\s\S]*?root\.style\.maxHeight/,
  'combinations layout must clamp its height to the supplied safe area',
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
        #site-nav { position: fixed; inset: 0 0 auto; height: var(--nav-height); z-index: 50; background: #5c4030; }
        [data-stage] { position: fixed; left: 50%; top: 48%; width: 80px; height: 80px; }
        [data-piece] { width: 100%; height: 100%; background: #c9a227; }
        .il-spotlight-builds { top: var(--builds-top); right: 4%; bottom: auto; height: 120px; }
      </style>
    </head><body>
      <div id="site-nav"></div>
      <div class="il-spotlight__stage" data-stage><div class="il-spotlight__piece" data-piece></div></div>
      <aside class="il-spotlight-builds" data-builds hidden></aside>
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
    const result = await page.evaluate(async ({ scale, nav, builds }) => {
      document.documentElement.style.setProperty('--nav-height', `${nav}px`);
      document.documentElement.style.setProperty('--builds-top', `${builds}px`);
      const { buildRecipeIndex, createSpotlightRecipes } = await import('/js/pages/items/spotlight-recipes.js');
      const recipes = createSpotlightRecipes({
        getItemById: (id) => ({ id, name: id, spriteW: 1, spriteH: 1 }),
        getSpriteUrl: () => '',
        onPickItem: () => {},
      });
      recipes.el.style.setProperty('--il-spotlight-desktop-scale', String(scale));
      recipes.setIndex(buildRecipeIndex(Array.from({ length: 18 }, (_, i) => ({
        id: i + 1,
        result_item_id: `result-${i + 1}`,
        ingredients: [
          { item_id: 'focus', quantity: 1 },
          { item_id: `ingredient-${i}`, quantity: 1 },
        ],
      }))));

      const stage = document.querySelector('[data-stage]');
      const buildsEl = document.querySelector('[data-builds]');
      const bounds = () => {
        const navRect = document.querySelector('#site-nav').getBoundingClientRect();
        const buildsRect = buildsEl.getBoundingClientRect();
        return {
          top: navRect.bottom + 12,
          bottom: buildsRect.height > 0 ? buildsRect.top - 12 : window.innerHeight - 12,
          left: 12,
          right: window.innerWidth - 12,
        };
      };

      // Match the real async sequence: combinations paint while Builds is
      // still loading, then Builds appears and forces a second layout pass.
      recipes.showFor('focus', { stage, bounds });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const beforeBuilds = recipes.el.getBoundingClientRect();
      buildsEl.hidden = false;
      recipes.layout({ remeasureWidth: false });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const afterBuilds = recipes.el.getBoundingClientRect();
      const navRect = document.querySelector('#site-nav').getBoundingClientRect();
      const buildsRect = buildsEl.getBoundingClientRect();
      recipes.destroy();
      return {
        beforeBuilds: { top: beforeBuilds.top, bottom: beforeBuilds.bottom },
        afterBuilds: { left: afterBuilds.left, top: afterBuilds.top, right: afterBuilds.right, bottom: afterBuilds.bottom },
        navBottom: navRect.bottom,
        buildsTop: buildsRect.top,
      };
    }, viewport);

    if (viewport.width <= 900) {
      assert.ok(
        result.afterBuilds.right <= viewport.width + 1,
        `${viewport.name}: combinations exceed the mobile viewport: ${JSON.stringify(result)}`,
      );
    } else {
      const gap = 12;
      assert.ok(
        result.afterBuilds.top >= result.navBottom + gap - 1,
        `${viewport.name}: combinations overlap the navigation: ${JSON.stringify(result)}`,
      );
      assert.ok(
        result.afterBuilds.bottom <= result.buildsTop - gap + 1,
        `${viewport.name}: combinations overlap Builds using this item: ${JSON.stringify(result)}`,
      );
      assert.ok(
        result.afterBuilds.right <= viewport.width - gap + 1,
        `${viewport.name}: combinations exceed the viewport: ${JSON.stringify(result)}`,
      );
    }
    await page.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('Items spotlight combinations smoke passed.');
