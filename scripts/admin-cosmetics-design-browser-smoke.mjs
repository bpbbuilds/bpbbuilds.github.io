#!/usr/bin/env node

/** Responsive browser smoke for the Admin Cosmetics shared surface treatment. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminCss = fs.readFileSync(path.join(root, 'js/pages/admin/admin.css'), 'utf8');
const filterCss = fs.readFileSync(path.join(root, 'js/pages/items/filters.css'), 'utf8');
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'short-desktop', width: 1080, height: 720 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true, executablePath: edgePath });
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>${filterCss}\n${adminCss}</style></head><body class="page-admin">
    <main class="admin-main"><div class="admin-stage admin-surface">
      <div class="admin-cosmetics-layout">
        <div class="admin-cosmetics-col"><section class="admin-panel admin-cosmetics">
          <div class="admin-panel__head"><h2 class="admin-panel__title">Cosmetics</h2></div>
          <p class="admin-panel__blurb">Review cosmetics.</p>
          <div class="admin-panel__body"><section class="admin-cosmetics__section">
            <h3 class="admin-cosmetics__section-title">Live catalog</h3>
            <ul class="admin-cosmetics__list admin-cosmetics__catalog-grid">
              <li class="admin-cosmetics__card admin-cosmetics__row"><div class="admin-cosmetics__thumb">Art</div><div class="admin-cosmetics__row-main"><p class="admin-cosmetics__name">Cosmetic</p></div><div class="admin-cosmetics__card-status">Draft</div><div class="admin-cosmetics__card-actions"><button class="cr-btn-quiet">Edit</button><button class="cr-btn-quiet">Publish</button></div></li>
              <li class="admin-cosmetics__card admin-cosmetics__row"><div class="admin-cosmetics__thumb">Art</div><div class="admin-cosmetics__row-main"><p class="admin-cosmetics__name">Cosmetic</p></div><div class="admin-cosmetics__card-status">Published</div><div class="admin-cosmetics__card-actions"><button class="cr-btn-quiet">Published</button></div></li>
            </ul>
          </section></div>
        </section></div>
        <aside class="items-filters il-filter admin-cosmetics-filters"><div class="il-filter__head"><p class="il-filter__count">2 cosmetics shown.</p></div><div class="il-filter__shade"><label class="cr-label">Search</label><input class="cr-input" /></div></aside>
      </div>
    </div></main>
  </body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const result = await page.evaluate(() => {
      const layout = document.querySelector('.admin-cosmetics-layout');
      const section = document.querySelector('.admin-cosmetics__section');
      const card = document.querySelector('.admin-cosmetics__card');
      const filter = document.querySelector('.admin-cosmetics-filters');
      if (!(layout instanceof HTMLElement) || !(section instanceof HTMLElement) || !(card instanceof HTMLElement) || !(filter instanceof HTMLElement)) return null;
      const sectionStyle = getComputedStyle(section);
      const cardStyle = getComputedStyle(card);
      const filterStyle = getComputedStyle(filter);
      return {
        layout: getComputedStyle(layout).display,
        sectionShadow: sectionStyle.boxShadow,
        sectionBackground: sectionStyle.backgroundColor,
        cardShadow: cardStyle.boxShadow,
        filterOverflowY: filterStyle.overflowY,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (!result) throw new Error(`${viewport.name}: fixture missing Cosmetics surface`);
    if (result.sectionShadow === 'none') throw new Error(`${viewport.name}: section shadow missing`);
    if (result.cardShadow === 'none') throw new Error(`${viewport.name}: catalog card shadow missing`);
    if (result.overflowX > 1) throw new Error(`${viewport.name}: horizontal overflow ${result.overflowX}px`);
    if (viewport.width >= 1241 && result.layout !== 'grid') throw new Error(`${viewport.name}: desktop layout should remain grid`);
    if (viewport.width <= 1240 && result.layout !== 'flex') throw new Error(`${viewport.name}: narrow layout should stack`);
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
