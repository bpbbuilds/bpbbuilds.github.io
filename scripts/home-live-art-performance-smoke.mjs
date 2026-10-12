import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.BPB_BASE_URL || 'http://127.0.0.1:5501/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const state = await page.evaluate(() => {
    const catalog = document.querySelector('[data-promo-catalog]');
    return {
      staticCatalog: catalog?.getAttribute('data-bpb-live-art'),
      liveItems: catalog?.querySelectorAll('.bpb-live.is-live').length ?? 0,
    };
  });
  assert.equal(state.staticCatalog, 'off', `Home catalog must opt out of live art: ${JSON.stringify(state)}`);
  assert.equal(state.liveItems, 0, `Home catalog mounted live art: ${JSON.stringify(state)}`);
  console.log('home live-art performance smoke: ok');
} finally {
  await browser.close();
}
