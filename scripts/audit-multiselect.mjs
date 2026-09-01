import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:4173/create/', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('bpb-create-draft:v1'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const boardBox = await page.locator('[data-board-stage]').boundingBox();
const cx = boardBox.x + boardBox.width * 0.4;
const cy = boardBox.y + boardBox.height * 0.4;

async function drag(id, tx, ty) {
  const box = await page.evaluate((itemId) => {
    const el = [...document.querySelectorAll('.bpb-bg__item[data-item-id]:not(.bpb-bg__item--parked)')]
      .find((e) => e.getAttribute('data-item-id') === itemId && !e.closest('.create-board'));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, id);
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(tx, ty, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(350);
}

await drag('leather_bag', cx, cy);
await drag('stone', cx + 10, cy + 10);
await drag('banana', cx + 45, cy + 10);

const keys = await page
  .locator('.create-board .bpb-bg__item:not(.bpb-bg__item--parked):not(.bpb-bg__item--bag)')
  .evaluateAll((els) => els.map((e) => e.dataset.placementKey));

if (keys.length >= 2) {
  const b0 = await page.evaluate((k) => {
    const el = document.querySelector(`.create-board .bpb-bg__item[data-placement-key="${k}"]`);
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, keys[0]);
  const b1 = await page.evaluate((k) => {
    const el = document.querySelector(`.create-board .bpb-bg__item[data-placement-key="${k}"]`);
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, keys[1]);

  await page.keyboard.down('Shift');
  await page.mouse.click(b0.x, b0.y);
  await page.mouse.click(b1.x, b1.y);
  await page.keyboard.up('Shift');
  await page.waitForTimeout(100);
  const multi = await page.locator('.create-board .bpb-bg__item.is-multi-selected').count();
  console.log(JSON.stringify({ keys, multi, errors }));
} else {
  console.log(JSON.stringify({ keys, errors }));
}

await browser.close();
