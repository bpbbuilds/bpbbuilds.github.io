/**
 * Manual audit script for create-board drag rebuild.
 * Run: node scripts/audit-create-drag.mjs  (server on :4173)
 */
import { chromium } from 'playwright';

const BASE = process.env.BPB_URL || 'http://localhost:4173';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(`${BASE}/create/`, { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(() => localStorage.removeItem('bpb-create-draft:v1'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const boardBox = await page.locator('[data-board-stage]').boundingBox();
if (!boardBox) throw new Error('no board');

async function dragCatalogById(id, tx, ty) {
  const box = await page.evaluate((itemId) => {
    const el = [...document.querySelectorAll('.bpb-bg__item[data-item-id]:not(.bpb-bg__item--parked)')]
      .find((e) => e.getAttribute('data-item-id') === itemId && !e.closest('.create-board'));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, id);
  if (!box) return { ok: false, reason: 'not found' };
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(tx, ty, { steps: 14 });
  await page.waitForTimeout(120);
  const tiles = await page.locator('.create-board__inv-tile').count();
  const kinds = await page.locator('.create-board__inv-tile').evaluateAll((els) =>
    els.map((e) => e.dataset.kind),
  );
  await page.mouse.up();
  await page.waitForTimeout(300);
  return { ok: true, tiles, kinds };
}

async function boardItems() {
  return page.locator('.create-board .bpb-bg__item:not(.bpb-bg__item--parked)').evaluateAll((els) =>
    els.map((e) => ({
      id: e.getAttribute('data-item-id'),
      key: e.dataset.placementKey,
      bag: e.classList.contains('bpb-bg__item--bag'),
    })),
  );
}

const cx = boardBox.x + boardBox.width * 0.4;
const cy = boardBox.y + boardBox.height * 0.4;

const bagPlace = await dragCatalogById('leather_bag', cx, cy);
let items = await boardItems();

const catalogNonBags = await page.evaluate(() =>
  [...document.querySelectorAll('.bpb-bg__item[data-item-id]:not(.bpb-bg__item--parked)')]
    .filter((e) => !e.closest('.create-board') && !e.classList.contains('bpb-bg__item--bag'))
    .slice(0, 12)
    .map((e) => e.getAttribute('data-item-id')),
);

const placed = [];
for (const id of catalogNonBags) {
  if (items.filter((i) => !i.bag).length >= 2) break;
  const r = await dragCatalogById(id, cx + 15 + placed.length * 35, cy + 15);
  placed.push({ id, r });
  items = await boardItems();
}

items = await boardItems();
const nonBag = items.filter((p) => !p.bag);

let hotswap = null;
if (nonBag.length >= 2) {
  const a = nonBag[0];
  const b = nonBag[1];
  const boxes = await page.evaluate(({ ka, kb }) => {
    const ea = document.querySelector(
      `.create-board .bpb-bg__item[data-placement-key="${ka}"]`,
    );
    const eb = document.querySelector(
      `.create-board .bpb-bg__item[data-placement-key="${kb}"]`,
    );
    if (!ea || !eb) return null;
    const ra = ea.getBoundingClientRect();
    const rb = eb.getBoundingClientRect();
    return {
      ax: ra.x + ra.width / 2,
      ay: ra.y + ra.height / 2,
      bx: rb.x + rb.width / 2,
      by: rb.y + rb.height / 2,
    };
  }, { ka: a.key, kb: b.key });

  if (boxes) {
    await page.mouse.move(boxes.ax, boxes.ay);
    await page.mouse.down();
    await page.mouse.move(boxes.bx, boxes.by, { steps: 12 });
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(450);
    const cursor = await page.locator('.create-board__cursor:not([hidden])').count();
    const afterDrop = await boardItems();
    if (cursor) {
      await page.mouse.move(cx + 70, cy + 50);
      await page.mouse.down();
      await page.waitForTimeout(50);
      await page.mouse.up();
      await page.waitForTimeout(300);
    }
    hotswap = {
      cursorAfterDrop: cursor,
      afterDropCount: afterDrop.length,
      final: await boardItems(),
    };
  }
}

const beforeShift = await page.evaluate(() => {
  const el = document.querySelector('.create-board .bpb-bg__item--bag');
  return el ? { left: el.style.left, top: el.style.top } : null;
});
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
const afterShift = await page.evaluate(() => {
  const el = document.querySelector('.create-board .bpb-bg__item--bag');
  return el ? { left: el.style.left, top: el.style.top } : null;
});

const report = {
  bagPlace,
  itemAttempts: placed,
  itemsBeforeHotswap: items,
  hotswap,
  beforeShift,
  afterShift,
  shifted: beforeShift && afterShift && beforeShift.left !== afterShift.left,
  errors,
};

console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
