#!/usr/bin/env node

/** Regression for static Items-page art and complete catalog WebP coverage. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFile(path.join(root, file), 'utf8');
const [itemsPage, catalog, pieces, pool, spotlight, liveArt, manifestText] = await Promise.all([
  read('items/index.html'),
  read('js/pages/items/catalog/index.js'),
  read('js/shared/backpack-grid/item-pieces.js'),
  read('js/shared/backpack-grid/item-pool.js'),
  read('js/pages/items/spotlight.js'),
  read('js/shared/item-live-art/index.js'),
  read('assets/data/sprite-thumbs.json'),
]);

assert.match(itemsPage, /items-static-art-20261016a/);
assert.match(
  catalog,
  /liveArt:\s*false/,
  'Items catalog must explicitly opt out of live item art',
);
assert.match(
  catalog,
  /paintGrid\(host, \{ appear: false, filtered \}\)/,
  'Items filtering must not replay per-item entrance animation',
);
assert.match(
  await read('js/pages/items/catalog/shell.js'),
  /appear:\s*false/,
  'Items loading preview must not animate item entrance',
);
assert.match(
  pieces,
  /opts\.liveArt\s*!==\s*false/,
  'item creation must support a static-art opt-out',
);
assert.match(
  pool,
  /liveArt:\s*opts\.liveArt/,
  'pooled catalog entries must receive the static-art opt-out',
);
assert.match(
  spotlight,
  /liveArt:\s*false/,
  'Items spotlight must keep its item art static too',
);
assert.doesNotMatch(
  spotlight,
  /mountLiveArt\(itemEl\)/,
  'Items spotlight must not mount live art after opening',
);
assert.match(
  liveArt,
  /if \(!document\.body\?\.classList\.contains\('page-items'\)\) void loadLiveArt\(\)/,
  'Items page must skip automatic live-art manifest loading',
);
assert.match(
  liveArt,
  /export function ensureLiveArt\(\) \{\s*if \(document\.body\?\.classList\.contains\('page-items'\)\) return;/,
  'Items page must skip explicit live-art bootstrap too',
);

const manifest = JSON.parse(manifestText);
const sourceNames = (await fs.readdir(path.join(root, 'assets/item-sprites')))
  .filter((name) => name.toLowerCase().endsWith('.png'))
  .sort();
const manifestNames = new Set(manifest.images || []);
assert.deepEqual(
  manifestNames,
  new Set(sourceNames),
  'every catalog sprite must be represented by the WebP manifest',
);

for (const density of ['1x', '2x']) {
  const dir = path.join(root, 'assets/item-thumbs', density);
  for (const name of sourceNames) {
    const webp = path.join(dir, name.replace(/\.png$/i, '.webp'));
    await fs.access(webp);
  }
}

const liveArtData = JSON.parse(
  await read('assets/data/item-live-art.json'),
);
const liveFixtureId = Object.keys(liveArtData.items || {})[0];
assert.ok(liveFixtureId, 'live-art fixture must contain an item id');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const filePath = path.resolve(root, decodeURIComponent(url.pathname.replace(/^\/+/, '')));
  if (!filePath.startsWith(root) || !(await fs.stat(filePath).catch(() => null))) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
  }[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
  });
  res.end(await fs.readFile(filePath));
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const port = typeof address === 'object' && address ? address.port : 0;
assert.ok(port, 'static-art smoke server started');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html><body data-root="./"></body></html>');
  const runtime = await page.evaluate(async ({ serverPort, fixtureId }) => {
    const { loadLiveArt } = await import(
      `http://127.0.0.1:${serverPort}/js/shared/item-live-art/index.js`
    );
    await loadLiveArt();
    const { createItemEl } = await import(
      `http://127.0.0.1:${serverPort}/js/shared/backpack-grid/item-pieces.js`
    );
    const { mountItemiaryGrid } = await import(
      `http://127.0.0.1:${serverPort}/js/shared/backpack-grid/item-pool.js`
    );
    const item = {
      id: fixtureId,
      name: 'Static fixture',
      image: 'AceofSpades.png',
      shape: [[1]],
      type: 'Accessory',
      rarity: 'Common',
    };
    const eager = createItemEl(
      item,
      () => '/assets/item-thumbs/1x/AceofSpades.webp',
      1,
      0,
      [],
      { liveArt: false },
    );
    const deferred = createItemEl(
      item,
      () => '/assets/item-thumbs/1x/AceofSpades.webp',
      1,
      0,
      [],
      { liveArt: false, deferSprite: true },
    );
    const host = document.createElement('div');
    host.dataset.bpbLiveArt = 'off';
    document.body.appendChild(host);
    const grid = mountItemiaryGrid(host, {
      getSpriteUrl: () => '/assets/item-thumbs/1x/AceofSpades.webp',
      cellPx: 34,
      cols: 4,
    });
    grid.ensurePool([item]);
    const pooledRoot = host.querySelector('.bpb-bg');
    const pooledItem = host.querySelector('.bpb-bg__item');
    const inheritedLiveArtOff = pooledRoot?.getAttribute('data-bpb-live-art') === 'off';
    const inheritedPoolHasLiveLayer = Boolean(pooledItem?.querySelector('.bpb-live'));
    grid.destroy();
    return {
      eagerHasLiveLayer: Boolean(eager?.querySelector('.bpb-live')),
      eagerSpriteSrc: eager?.querySelector('img.bpb-bg__sprite')?.getAttribute('src') || '',
      deferredHasLiveLayer: Boolean(deferred?.querySelector('.bpb-live')),
      deferredSpriteDataSrc: deferred?.querySelector('img.bpb-bg__sprite')?.getAttribute('data-src') || '',
      inheritedLiveArtOff,
      inheritedPoolHasLiveLayer,
    };
  }, { serverPort: port, fixtureId: liveFixtureId });

  assert.equal(runtime.eagerHasLiveLayer, false, 'static eager item must not contain live layers');
  assert.match(runtime.eagerSpriteSrc, /item-thumbs\/1x\/AceofSpades\.webp$/);
  assert.equal(runtime.deferredHasLiveLayer, false, 'static deferred item must not contain live layers');
  assert.match(runtime.deferredSpriteDataSrc, /item-thumbs\/1x\/AceofSpades\.webp$/);
  assert.equal(runtime.inheritedLiveArtOff, true, 'host static-art opt-out must reach the Itemiary root');
  assert.equal(runtime.inheritedPoolHasLiveLayer, false, 'host static-art opt-out must reach pooled items');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log(`Items static-art smoke passed (${sourceNames.length} sprites, 2 WebP densities, runtime fixture verified)`);
