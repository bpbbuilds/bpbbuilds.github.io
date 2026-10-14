#!/usr/bin/env node

/** Responsive smoke for the Curated Build Loadouts board/meta relationship. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8826;
const homeCss = fs.readFileSync(path.join(root, 'js/pages/home/home-builds-vault.css'), 'utf8');
const homeJs = fs.readFileSync(path.join(root, 'js/pages/home/home-builds-vault.js'), 'utf8');
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'short-desktop', width: 1080, height: 720 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

assert.match(homeCss, /\.home-vault__cell\s*\{[\s\S]*?gap:\s*0;/, 'loadout cards remove the extra board/meta flex gap');
assert.match(homeCss, /padding-bottom:\s*calc\([\s\S]*?clamp\(0\.25rem,\s*0\.45vw,\s*0\.4rem\)/, 'loadout boards reserve a compact overhang');
assert.match(homeCss, /width:\s*clamp\(3rem,\s*4\.25vw,\s*4rem\)\s*!important/, 'loadout faces use the larger responsive width');
assert.match(homeJs, /className:\s*'home-vault__cell-avatar',\s*size:\s*64/, 'loadout face source is requested at the larger size');

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  const filePath = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath);
  const contentType = ext === '.css' ? 'text/css' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/js/pages/home/home-builds-vault.css`, { waitUntil: 'domcontentloaded' });
  await page.setContent(`<!doctype html><html><head>
    <link rel="stylesheet" href="http://127.0.0.1:${port}/css/theme.css">
    <link rel="stylesheet" href="http://127.0.0.1:${port}/css/shared.css">
    <link rel="stylesheet" href="http://127.0.0.1:${port}/js/shared/board-still/board-still.css">
    <link rel="stylesheet" href="http://127.0.0.1:${port}/js/pages/home/home-builds-vault.css">
  </head><body class="page-home">
    <main><section id="home-builds-vault"><div class="home-vault"><div class="home-vault__band"><div class="home-vault__inner"><div class="home-vault__marquee"><div class="home-vault__cell">
      <span class="home-vault__cell-media"><span class="home-vault__board"><span class="bpb-board-still"><img class="bpb-board-still__img is-ready" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt="" width="308" height="252"></span></span></span>
      <span class="home-vault__cell-meta"><span class="home-vault__cell-avatar home-vault__cell-avatar--initials">AB</span><span class="home-vault__cell-copy"><span class="home-vault__cell-author-name">Author</span><span class="home-vault__cell-name home-vault__cell-label--gold">A build title</span></span><span class="home-vault__cell-class"></span></span>
    </div></div></div></div></div></section></main>
  </body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const result = await page.evaluate(() => {
      const cell = document.querySelector('.home-vault__cell');
      const board = document.querySelector('.home-vault__board');
      const image = document.querySelector('.bpb-board-still__img');
      const meta = document.querySelector('.home-vault__cell-meta');
      const avatar = document.querySelector('.home-vault__cell-avatar');
      const boardStyle = board ? getComputedStyle(board) : null;
      const cellStyle = cell ? getComputedStyle(cell) : null;
      const cellRect = cell?.getBoundingClientRect();
      const imageRect = image?.getBoundingClientRect();
      const metaRect = meta?.getBoundingClientRect();
      const avatarRect = avatar?.getBoundingClientRect();
      return {
        cellWidth: cellRect?.width || 0,
        cellGap: cellStyle?.gap || '',
        boardPaddingBottom: boardStyle?.paddingBottom || '',
        imageBottom: imageRect?.bottom || 0,
        metaTop: metaRect?.top || 0,
        avatarWidth: avatarRect?.width || 0,
        avatarHeight: avatarRect?.height || 0,
        viewportWidth: document.documentElement.clientWidth,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert.ok(result.cellWidth > 0, `${viewport.name}: loadout card exists`);
    assert.equal(result.cellGap, '0px', `${viewport.name}: board/meta gap is compact`);
    assert.ok(result.boardPaddingBottom !== '28px', `${viewport.name}: full still overhang padding was not reduced`);
    assert.ok(result.metaTop - result.imageBottom <= 0, `${viewport.name}: metadata should sit at the image edge (${JSON.stringify(result)})`);
    assert.ok(result.metaTop - result.imageBottom >= -8, `${viewport.name}: metadata overlaps too far into the board (${JSON.stringify(result)})`);
    assert.ok(result.avatarWidth >= 48 && result.avatarWidth <= 64, `${viewport.name}: creator face width is responsive (${JSON.stringify(result)})`);
    assert.ok(Math.abs(result.avatarWidth - result.avatarHeight) < 0.5, `${viewport.name}: creator face stays square`);
    assert.ok(result.overflowX <= 1, `${viewport.name}: no horizontal overflow (${JSON.stringify(result)})`);
    results.push({ ...viewport, ...result, imageToMetaPx: result.metaTop - result.imageBottom });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
