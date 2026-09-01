import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto('http://localhost:4173/create/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('bpb-create-draft:v1'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const boardBox = await page.locator('[data-board-stage]').boundingBox();
const cx = boardBox.x + boardBox.width * 0.42;
const cy = boardBox.y + boardBox.height * 0.42;

async function drag(id, tx, ty) {
  const box = await page.evaluate((itemId) => {
    const el = [...document.querySelectorAll('.bpb-bg__item[data-item-id]:not(.bpb-bg__item--parked)')]
      .find((e) => e.getAttribute('data-item-id') === itemId && !e.closest('.create-board'));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, id);
  if (!box) return { missing: id };
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(tx, ty, { steps: 16 });
  await page.waitForTimeout(100);
  const kinds = await page.locator('.create-board__inv-tile').evaluateAll((els) =>
    els.map((e) => e.dataset.kind),
  );
  await page.mouse.up();
  await page.waitForTimeout(400);
  const board = await page
    .locator('.create-board .bpb-bg__item:not(.bpb-bg__item--parked)')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-item-id')));
  return { kinds, board };
}

console.log('bag', JSON.stringify(await drag('leather_bag', cx, cy)));
console.log('stone', JSON.stringify(await drag('stone', cx + 8, cy + 8)));
console.log('coal', JSON.stringify(await drag('lump_of_coal', cx + 40, cy + 8)));

const items = await page
  .locator('.create-board .bpb-bg__item:not(.bpb-bg__item--parked)')
  .evaluateAll((els) =>
    els.map((e) => ({
      id: e.getAttribute('data-item-id'),
      key: e.dataset.placementKey,
      bag: e.classList.contains('bpb-bg__item--bag'),
    })),
  );
console.log('items', JSON.stringify(items));

const non = items.filter((i) => !i.bag);
if (non.length >= 2) {
  const boxes = await page.evaluate(({ a, b }) => {
    const ea = document.querySelector(`[data-placement-key="${a}"]`);
    const eb = document.querySelector(`[data-placement-key="${b}"]`);
    const ra = ea.getBoundingClientRect();
    const rb = eb.getBoundingClientRect();
    return {
      ax: ra.x + ra.width / 2,
      ay: ra.y + ra.height / 2,
      bx: rb.x + rb.width / 2,
      by: rb.y + rb.height / 2,
    };
  }, { a: non[0].key, b: non[1].key });

  await page.mouse.move(boxes.ax, boxes.ay);
  await page.mouse.down();
  await page.mouse.move(boxes.bx, boxes.by, { steps: 12 });
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(500);
  const cursor = await page.locator('.create-board__cursor:not([hidden])').count();
  console.log('hotswap cursor', cursor);
  if (cursor) {
    // Place away from remaining board item
    await page.mouse.move(cx - 20, cy + 45);
    await page.mouse.down();
    await page.waitForTimeout(40);
    await page.mouse.up();
    await page.waitForTimeout(400);
    const cursor2 = await page.locator('.create-board__cursor:not([hidden])').count();
    console.log('cursor after place', cursor2);
  }
  const final = await page
    .locator('.create-board .bpb-bg__item:not(.bpb-bg__item--parked)')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-item-id')));
  console.log('final', JSON.stringify(final));
} else {
  console.log('need 2 items for hotswap, got', non.length);
}

await browser.close();
