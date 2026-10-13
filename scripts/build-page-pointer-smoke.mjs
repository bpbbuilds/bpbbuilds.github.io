import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url);
const buildCss = await fs.readFile(new URL('./js/pages/build/build.css', root), 'utf8');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.setContent(`
    <style>${buildCss}</style>
    <main class="page-build page-build-view">
      <a class="build-info__discuss" href="#discuss">Discuss</a>
      <button class="build-round-strip__btn" type="button">Round</button>
      <button class="build-round__toggle" type="button">Items</button>
      <button class="build-round__vote-btn" type="button">Vote</button>
      <a class="build-round__remix" href="#remix">Remix</a>
      <button class="build-round__share" type="button">Share</button>
      <button class="build-round__btn" type="button">Next</button>
      <a class="build-author__thumb" href="#author">Author</a>
      <a class="build-stage__event" href="#event">Event</a>
      <img data-item-id="hammer" alt="Hammer" />
      <button class="build-round__btn" type="button" disabled>Disabled</button>
    </main>
  `);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1080, height: 720 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const cursors = await page.evaluate(() => ({
      active: [...document.querySelectorAll(
        '.build-info__discuss, .build-round-strip__btn, .build-round__toggle, .build-round__vote-btn, .build-round__remix, .build-round__share, .build-round__btn:not(:disabled), .build-author__thumb, .build-stage__event, [data-item-id]',
      )].map((node) => getComputedStyle(node).cursor),
      disabled: getComputedStyle(document.querySelector('.build-round__btn:disabled')).cursor,
    }));
    assert.deepEqual(
      cursors.active,
      Array(cursors.active.length).fill('pointer'),
      `Build controls must use the native pointer at ${viewport.width}x${viewport.height}: ${JSON.stringify(cursors)}`,
    );
    assert.equal(
      cursors.disabled,
      'default',
      `Disabled Build controls must use the native default cursor at ${viewport.width}x${viewport.height}: ${JSON.stringify(cursors)}`,
    );
  }

  console.log('build page pointer smoke: ok');
} finally {
  await browser.close();
}
