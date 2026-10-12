import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.BPB_BASE_URL || 'http://127.0.0.1:5501/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const state = await page.evaluate(() => ({
    htmlCursor: getComputedStyle(document.documentElement).cursor,
    follower: document.querySelector('.bpb-cursor-follower'),
    liveClass: document.documentElement.classList.contains('bpb-live-cursor'),
  }));
  assert.equal(state.htmlCursor, 'auto', `custom cursor still active: ${JSON.stringify(state)}`);
  assert.equal(state.follower, null, `custom follower still mounted: ${JSON.stringify(state)}`);
  assert.equal(state.liveClass, false, `custom cursor state still active: ${JSON.stringify(state)}`);
  console.log('native cursor smoke: ok');
} finally {
  await browser.close();
}
