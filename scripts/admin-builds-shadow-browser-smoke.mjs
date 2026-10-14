#!/usr/bin/env node

/** Responsive browser smoke for the shared Admin Builds card depth. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'js/pages/admin/admin.css'), 'utf8');
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
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body class="page-admin">
    <main class="admin-main"><div class="admin-builds-col">
      <div class="admin-cards admin-cards--compact"><article class="admin-card admin-card--compact"><span>Compact</span></article></div>
      <div class="admin-cards admin-cards--card"><article class="admin-card admin-card--card"><span>Card</span></article></div>
      <div class="admin-cards admin-cards--grid"><article class="admin-card admin-card--grid"><span>Grid</span></article></div>
    </div></main>
  </body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const result = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.admin-builds-col .admin-cards > .admin-card')];
      const shadows = cards.map((card) => getComputedStyle(card).boxShadow);
      const rectangles = cards.map((card) => card.getBoundingClientRect());
      return {
        shadows,
        widths: rectangles.map((rect) => rect.width),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (result.shadows.length !== 3) throw new Error(`${viewport.name}: missing view cards`);
    if (result.shadows.some((shadow) => shadow === 'none')) {
      throw new Error(`${viewport.name}: one or more view shadows missing`);
    }
    if (new Set(result.shadows).size !== 1) {
      throw new Error(`${viewport.name}: view shadows differ (${result.shadows.join(' | ')})`);
    }
    if (result.widths.some((width) => width <= 0)) throw new Error(`${viewport.name}: card collapsed`);
    if (result.overflowX > 1) throw new Error(`${viewport.name}: horizontal overflow ${result.overflowX}px`);
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
