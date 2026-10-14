#!/usr/bin/env node

/** Browser smoke for the static Home shell before module boot/hydration. */

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
        const region = host?.querySelector('.bpb-skel-region');
        const surface = region?.querySelector('.bpb-skel');
        return {
          id,
          regions: host?.querySelectorAll('.bpb-skel-region').length || 0,
          surfaces: region?.querySelectorAll('.bpb-skel').length || 0,
          height: surface instanceof HTMLElement ? surface.getBoundingClientRect().height : 0,
        };
      });
      const footer = document.querySelector('#site-footer');
      const footerSurface = footer?.querySelector('.bpb-skel');
      const frame = getComputedStyle(document.body, '::after').backgroundImage;
      const bodyBg = getComputedStyle(document.body).backgroundImage;
      return {
        sections,
        footerRegions: footer?.querySelectorAll('.bpb-skel-region').length || 0,
        footerSurfaces: footer?.querySelectorAll('.bpb-skel').length || 0,
        footerHeight: footerSurface instanceof HTMLElement ? footerSurface.getBoundingClientRect().height : 0,
        frame,
        bodyBg,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, sectionIds);

    for (const section of state.sections) {
      assert.equal(section.regions, 1, `${viewport.name}/${section.id}: one first-paint region`);
      assert.equal(section.surfaces, 1, `${viewport.name}/${section.id}: one first-paint surface`);
      assert.ok(section.height > 0, `${viewport.name}/${section.id}: skeleton has height`);
    }
    assert.equal(state.footerRegions, 1, `${viewport.name}: footer has one first-paint region`);
    assert.equal(state.footerSurfaces, 1, `${viewport.name}: footer has one first-paint surface`);
    assert.ok(state.footerHeight > 0, `${viewport.name}: footer skeleton has height`);
    assert.match(state.bodyBg, /bg-town-square\.jpg/, `${viewport.name}: Home background is present before boot`);
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
