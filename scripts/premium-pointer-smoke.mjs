import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url);
const [navCss, premiumCss] = await Promise.all([
  fs.readFile(new URL('./js/shared/nav.css', root), 'utf8'),
  fs.readFile(new URL('./js/shared/premium-offer.css', root), 'utf8'),
]);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.setContent(`
    <style>${navCss}\n${premiumCss}</style>
    <div class="site-nav__announce-slot">
      <button class="site-nav__announce" type="button">Free Premium</button>
    </div>
    <div class="bpb-premium-offer">
      <div class="bpb-premium-offer__panel bpb-panel--rewards">
        <button class="bpb-premium-offer__close" type="button" aria-label="Close">×</button>
        <button class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" type="button">View Premium features</button>
        <button class="bpb-premium-offer__btn bpb-premium-offer__btn--primary" type="button">Got it</button>
      </div>
    </div>
  `);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1080, height: 720 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const cursors = await page.evaluate(() =>
      [...document.querySelectorAll(
        '.site-nav__announce, .bpb-premium-offer__close, .bpb-premium-offer__btn',
      )].map((node) => getComputedStyle(node).cursor),
    );
    assert.deepEqual(
      cursors,
      ['pointer', 'pointer', 'pointer', 'pointer'],
      `premium controls must use the native pointer at ${viewport.width}x${viewport.height}: ${JSON.stringify(cursors)}`,
    );
  }

  console.log('premium pointer smoke: ok');
} finally {
  await browser.close();
}
