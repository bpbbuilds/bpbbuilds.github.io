/**
 * Audit: create onboard bag-step icon alignment.
 * Opens the create page empty, clicks a class, screenshots the bag step,
 * and measures each bag icon's center vs the row center.
 *
 * Run: node scripts/_audit-onboard-bags.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scripts', '_cache');
const URL = 'http://localhost:5500/create/';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(URL, { waitUntil: 'networkidle' });

const overlay = page.locator('[data-board-onboard]');
await overlay.waitFor({ state: 'visible', timeout: 15000 });

// Click a class to advance to the bag step
await page.locator('[data-onboard-class]').first().click();
await page.waitForTimeout(400);

const bagsEl = page.locator('[data-onboard-bags]');
await bagsEl.waitFor({ state: 'visible', timeout: 5000 });

// Measure
const report = await page.evaluate(() => {
  const grid = document.querySelector('[data-onboard-bags]');
  if (!grid) return { error: 'no bags grid' };
  const gRect = grid.getBoundingClientRect();
  const imgs = [...grid.querySelectorAll('.create-onboard__icon-btn--bag')];
  const items = imgs.map((btn) => {
    const img = btn.querySelector('img');
    const r = img ? img.getBoundingClientRect() : btn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    return {
      label: btn.getAttribute('aria-label') || '',
      imgW: Math.round(r.width),
      imgH: Math.round(r.height),
      btnW: Math.round(btn.getBoundingClientRect().width),
      centerX: Math.round(cx),
      centerY: Math.round(cy),
    };
  });
  const rowTop = Math.min(...items.map((i) => i.centerY - i.imgH / 2));
  const rowBottom = Math.max(...items.map((i) => i.centerY + i.imgH / 2));
  return {
    grid: { left: Math.round(gRect.left), width: Math.round(gRect.width) },
    items,
    rowTop: Math.round(rowTop),
    rowBottom: Math.round(rowBottom),
    centers: items.map((i) => i.centerY),
  };
});
console.log(JSON.stringify(report, null, 2));

const clip = await page.evaluate(() => {
  const g = document.querySelector('[data-onboard-bags]');
  const r = g.getBoundingClientRect();
  return { x: Math.max(0, r.left - 80), y: Math.max(0, r.top - 110), width: r.width + 160, height: r.height + 180 };
});
await page.screenshot({ path: path.join(OUT, 'onboard-bags-before.png'), clip });

// Panel + title + grid geometry for center comparison
const panelReport = await page.evaluate(() => {
  const panel = document.querySelector('[data-onboard-panel]');
  const title = document.querySelector('[data-onboard-title]');
  const grid = document.querySelector('[data-onboard-bags]');
  const btns = [...document.querySelectorAll('[data-onboard-bag]')];
  const c = (el) => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), width: Math.round(r.width), centerX: Math.round(r.left + r.width / 2) };
  };
  return {
    panel: c(panel),
    title: c(title),
    grid: c(grid),
    btns: btns.map(c),
  };
});
console.log(JSON.stringify(panelReport, null, 2));

// --- Item-warning state: same title size, wraps to 2 lines OK ---
// Always test on a fresh load — the class click above can remount the overlay.
await page.goto(URL, { waitUntil: 'networkidle' });
await page.locator('[data-board-onboard]').waitFor({ state: 'visible', timeout: 15000 });
await page.evaluate(() => {
  const overlay = document.querySelector('[data-board-onboard]');
  const title = overlay.querySelector('[data-onboard-title]');
  overlay.hidden = false;
  overlay.classList.add('is-place-back', 'is-item-warning');
  title.textContent = 'Please place a bag before placing an item';
});
await page.waitForTimeout(200);
const warnReport = await page.evaluate(() => {
  const overlay = document.querySelector('[data-board-onboard]');
  const title = overlay.querySelector('[data-onboard-title]');
  const panel = document.querySelector('[data-onboard-panel]');
  const cs = getComputedStyle(title);
  const range = document.createRange();
  range.selectNodeContents(title);
  const lines = [...range.getClientRects()].map((r) => Math.round(r.top)).filter((v, i, a) => a.indexOf(v) === i);
  const c = (el) => {
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), width: Math.round(r.width), centerX: Math.round(r.left + r.width / 2) };
  };
  return {
    fontSize: cs.fontSize,
    lineCount: lines.length,
    title: c(title),
    panel: c(panel),
  };
});
console.log(JSON.stringify(warnReport, null, 2));

const warnClip = await page.evaluate(() => {
  const t = document.querySelector('[data-onboard-title]');
  const r = t.getBoundingClientRect();
  return { x: Math.max(0, r.left - 120), y: Math.max(0, r.top - 40), width: r.width + 240, height: r.height + 80 };
});
await page.screenshot({ path: path.join(OUT, 'onboard-item-warning.png'), clip: warnClip });

await browser.close();
console.log('saved scripts/_cache/onboard-bags-before.png');
console.log('saved scripts/_cache/onboard-item-warning.png');
