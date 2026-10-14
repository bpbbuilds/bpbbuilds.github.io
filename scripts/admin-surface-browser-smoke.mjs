#!/usr/bin/env node

/** Responsive browser smoke for the shared admin surface chrome. */

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
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body class="page-admin"><main class="admin-main"><div class="admin-stage admin-surface"><section class="admin-panel"><h1>Admin</h1><p>Surface smoke content</p></section></div></main></body></html>`);
  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const result = await page.evaluate(() => {
      const surface = document.querySelector('.admin-surface');
      if (!(surface instanceof HTMLElement)) return null;
      const style = getComputedStyle(surface);
      return {
        padding: style.padding,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (!result) throw new Error(`${viewport.name}: missing admin surface`);
    if (result.boxShadow === 'none') throw new Error(`${viewport.name}: surface shadow missing`);
    if (result.overflowX > 1) throw new Error(`${viewport.name}: horizontal overflow ${result.overflowX}px`);
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
