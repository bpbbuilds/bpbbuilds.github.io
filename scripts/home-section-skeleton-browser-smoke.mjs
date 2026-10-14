#!/usr/bin/env node

/** Responsive browser smoke for the Home page's intentionally clean boot. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8818;
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
  if (url.pathname === '/harness') {
    const sections = sectionIds.map((id) => `<section id="${id}"></section>`).join('');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head>
      <link rel="stylesheet" href="/css/theme.css">
      <link rel="stylesheet" href="/css/shared.css">
      <link rel="stylesheet" href="/js/pages/home/featured-stage.css">
      <link rel="stylesheet" href="/js/pages/home/home-promo-band.css">
      <link rel="stylesheet" href="/js/pages/home/home-class-showcase.css">
      <link rel="stylesheet" href="/js/pages/home/home-items-explore.css">
      <link rel="stylesheet" href="/js/pages/home/home-builds-vault.css">
    </head><body class="page-home"><div id="site-nav"></div><main>${sections}</main><div id="site-footer"></div></body></html>`);
    return;
  }
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
  const results = [];
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });
    const result = await page.evaluate((ids) => ({
      sections: ids.map((id) => {
        const host = document.getElementById(id);
        return {
          id,
          skeletonRegions: host?.querySelectorAll('.bpb-skel-region').length || 0,
          skeletonSurfaces: host?.querySelectorAll('.bpb-skel').length || 0,
          children: host?.children.length || 0,
        };
      }),
      navSkeletons: document.querySelectorAll('#site-nav .bpb-skel, #site-nav .site-nav--skel').length,
      footerSkeletons: document.querySelectorAll('#site-footer .bpb-skel').length,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }), sectionIds);

    for (const section of result.sections) {
      assert.equal(section.skeletonRegions, 0, `${viewport.name}/${section.id}: no skeleton region`);
      assert.equal(section.skeletonSurfaces, 0, `${viewport.name}/${section.id}: no skeleton surface`);
      assert.equal(section.children, 0, `${viewport.name}/${section.id}: clean empty host before async data`);
    }
    assert.equal(result.navSkeletons, 0, `${viewport.name}: Home nav has no skeleton`);
    assert.equal(result.footerSkeletons, 0, `${viewport.name}: Home footer has no skeleton`);
    assert.ok(result.overflowX <= 1, `${viewport.name}: clean Home shell has no horizontal overflow`);
    results.push({ ...viewport, ...result });
    await page.close();
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
