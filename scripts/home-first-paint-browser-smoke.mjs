#!/usr/bin/env node

/** Browser smoke for the empty Home shell before section modules mount. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8822;
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'short-desktop', width: 1080, height: 720 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const sectionIds = [
  'featured-stage',
  'home-promo-band',
  'home-class-showcase',
  'home-items-explore',
  'home-builds-vault',
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  const filePath = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
  }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.route('**/js/pages/home/index.js*', (route) => route.abort());
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
    const state = await page.evaluate((ids) => {
      const sections = ids.map((id) => {
        const host = document.getElementById(id);
        return {
          id,
          regions: host?.querySelectorAll('.bpb-skel-region').length || 0,
          surfaces: host?.querySelectorAll('.bpb-skel').length || 0,
          childCount: host?.children.length || 0,
        };
      });
      const footer = document.querySelector('#site-footer');
      const frame = getComputedStyle(document.body, '::after').backgroundImage;
      const bodyBg = getComputedStyle(document.body).backgroundImage;
      return {
        sections,
        footerRegions: footer?.querySelectorAll('.bpb-skel-region').length || 0,
        footerSurfaces: footer?.querySelectorAll('.bpb-skel').length || 0,
        footerChildCount: footer?.children.length || 0,
        navRegions: document.querySelectorAll('#site-nav .bpb-skel-region').length || 0,
        frame,
        bodyBg,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, sectionIds);

    for (const section of state.sections) {
      assert.equal(section.regions, 0, `${viewport.name}/${section.id}: no page-level skeleton region`);
      assert.equal(section.surfaces, 0, `${viewport.name}/${section.id}: no page-level skeleton surface`);
      assert.equal(section.childCount, 0, `${viewport.name}/${section.id}: section host starts empty`);
    }
    assert.equal(state.footerRegions, 0, `${viewport.name}: footer has no page-level skeleton region`);
    assert.equal(state.footerSurfaces, 0, `${viewport.name}: footer has no page-level skeleton surface`);
    assert.equal(state.footerChildCount, 0, `${viewport.name}: footer host starts empty`);
    assert.equal(state.navRegions, 0, `${viewport.name}: nav host starts empty before shared init`);
    assert.match(state.bodyBg, /CombatNightStatic\.png/, `${viewport.name}: static Night background is present before boot`);
    if (viewport.width > 1100) {
      assert.match(state.frame, /ui-screen-frame\.png/, `${viewport.name}: desktop frame is present before boot`);
    }
    assert.ok(state.overflowX <= 1, `${viewport.name}: first-paint shell introduced horizontal overflow`);
    await page.close();
  }
  console.log('Home first-paint browser smoke passed.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
