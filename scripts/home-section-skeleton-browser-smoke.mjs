#!/usr/bin/env node

/** Responsive browser smoke for the single-surface Home/nav placeholders. */

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
const sectionSpecs = [
  {
    id: 'featured-stage',
    selector: '.fs-skel-wrap',
    markup: `<div class="bpb-skel-region fs-skel-wrap" role="status" aria-busy="true">
      <div class="fs-shell fs-shell--skel"><span class="bpb-skel bpb-skel--block fs-section-skeleton" aria-hidden="true"></span></div>
    </div>`,
  },
  {
    id: 'home-promo-band',
    selector: '.home-promo__section-skeleton',
    markup: `<div class="home-promo home-promo--create"><div class="home-promo__band">
      <div class="home-promo__section-skeleton bpb-skel-region" role="status" aria-busy="true">
        <span class="bpb-skel bpb-skel--block home-promo__section-skeleton-surface" aria-hidden="true"></span>
      </div>
    </div></div>`,
  },
  {
    id: 'home-class-showcase',
    selector: '.bpb-skel-section-wrap',
    markup: `<div class="bpb-skel-region bpb-skel-section-wrap" role="status" aria-busy="true">
      <div class="bpb-skel bpb-skel--block bpb-skel-section home-mobs__section-skeleton" aria-hidden="true"></div>
    </div>`,
  },
  {
    id: 'home-items-explore',
    selector: '.bpb-skel-section-wrap',
    markup: `<div class="bpb-skel-region bpb-skel-section-wrap" role="status" aria-busy="true">
      <div class="bpb-skel bpb-skel--block bpb-skel-section home-items__section-skeleton" aria-hidden="true"></div>
    </div>`,
  },
  {
    id: 'home-builds-vault',
    selector: '.bpb-skel-section-wrap',
    markup: `<div class="bpb-skel-region bpb-skel-section-wrap" role="status" aria-busy="true">
      <div class="bpb-skel bpb-skel--block bpb-skel-section home-vault__section-skeleton" aria-hidden="true"></div>
    </div>`,
  },
];
const sectionIds = sectionSpecs.map(({ id }) => id);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    const sections = sectionSpecs.map(({ id, markup }) => `<section id="${id}">${markup}</section>`).join('');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head>
      <link rel="stylesheet" href="/css/theme.css">
      <link rel="stylesheet" href="/css/shared.css">
      <link rel="stylesheet" href="/js/pages/home/featured-stage.css">
      <link rel="stylesheet" href="/js/pages/home/home-promo-band.css">
      <link rel="stylesheet" href="/js/pages/home/home-class-showcase.css">
      <link rel="stylesheet" href="/js/pages/home/home-items-explore.css">
      <link rel="stylesheet" href="/js/pages/home/home-builds-vault.css">
    </head><body class="page-home">
      <div id="site-nav"><div class="site-nav-skel-wrap bpb-skel-region" role="status" aria-busy="true">
        <div class="site-nav-shell"><header class="site-nav site-nav--skel">
          <span class="bpb-skel bpb-skel--block site-nav__skel-surface" aria-hidden="true"></span>
        </header></div>
      </div></div>
      <main id="main">${sections}</main>
    </body></html>`);
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
    const result = await page.evaluate((specs) => {
      const nav = document.querySelector('.site-nav--skel');
      const regions = specs.map(({ id, selector }) => {
        const host = document.getElementById(id);
        const region = host?.querySelector(selector);
        const surface = region?.querySelector('.bpb-skel');
        return {
          id,
          regions: host?.querySelectorAll(selector).length || 0,
          surfaces: region?.querySelectorAll('.bpb-skel').length || 0,
          height: surface instanceof HTMLElement ? surface.getBoundingClientRect().height : 0,
        };
      });
      return {
        navSurfaces: nav?.querySelectorAll('.site-nav__skel-surface').length || 0,
        navHeight: nav instanceof HTMLElement ? nav.getBoundingClientRect().height : 0,
        regions,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, sectionSpecs);
    assert.equal(result.navSurfaces, 1, `${viewport.name}: nav has one skeleton surface`);
    assert.ok(result.navHeight > 0, `${viewport.name}: nav skeleton has height`);
    for (const region of result.regions) {
      assert.equal(region.regions, 1, `${viewport.name}/${region.id}: one section skeleton wrapper`);
      assert.equal(region.surfaces, 1, `${viewport.name}/${region.id}: one section skeleton surface`);
      assert.ok(region.height > 0, `${viewport.name}/${region.id}: section skeleton has height`);
    }
    assert.ok(result.overflowX <= 1, `${viewport.name}: skeletons introduced horizontal overflow`);
    results.push({ ...viewport, ...result });
    await page.close();
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
