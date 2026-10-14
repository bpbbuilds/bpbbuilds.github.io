#!/usr/bin/env node

/** Regression for long Home build titles colliding with the class icon. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const css = await fs.readFile(new URL('js/pages/home/home-promo-band.css', root), 'utf8');
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of [
    { width: 1440, height: 900, name: 'desktop' },
    { width: 1080, height: 720, name: 'short-desktop' },
    { width: 768, height: 900, name: 'tablet' },
    { width: 390, height: 844, name: 'mobile' },
  ]) {
    const page = await browser.newPage({ viewport });
    await page.setContent(`<!doctype html>
      <style>
        *,*::before,*::after{box-sizing:border-box}
        html,body{margin:0;min-height:100%;background:#211711}
      </style>
      <style>${css}</style>
      <div class="home-promo home-promo--create home-promo--player-info" style="--promo-stage-h:20.2rem">
        <div class="home-promo__stage">
          <div class="home-promo__caption">
            <header class="home-promo__caption-head home-promo__caption-head--icon">
              <img class="home-promo__caption-class" src="/class.png" alt="Pyromancer" width="36" height="36" />
              <span class="home-promo__caption-title">Enranged Phonix Crazy Builds with a very long title</span>
            </header>
          </div>
        </div>
      </div>`);

    const result = await page.evaluate(() => {
      const head = document.querySelector('.home-promo__caption-head');
      const icon = document.querySelector('.home-promo__caption-class');
      const title = document.querySelector('.home-promo__caption-title');
      if (!(head instanceof HTMLElement) || !(icon instanceof HTMLElement) || !(title instanceof HTMLElement)) {
        throw new Error('long-title probe did not mount');
      }
      const headRect = head.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const titleStyle = getComputedStyle(title);
      return {
        headLeft: headRect.left,
        headRight: headRect.right,
        headCenter: headRect.left + headRect.width / 2,
        titleLeft: titleRect.left,
        titleRight: titleRect.right,
        titleCenter: titleRect.left + titleRect.width / 2,
        iconLeft: iconRect.left,
        iconRight: iconRect.right,
        titleDisplay: titleStyle.display,
        titleWhiteSpace: titleStyle.whiteSpace,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    assert.notEqual(result.titleDisplay, 'none', `${viewport.name}: title keeps a measurable layout box`);
    assert.notEqual(result.titleWhiteSpace, 'nowrap', `${viewport.name}: long title can wrap before truncating`);
    assert.ok(result.titleLeft >= result.iconRight + 4, `${viewport.name}: title reserves space after the class icon`);
    assert.ok(result.titleRight <= result.headRight - 4, `${viewport.name}: title stays inside the title surface`);
    assert.ok(Math.abs(result.titleCenter - result.headCenter) <= 1, `${viewport.name}: title remains centered`);
    assert.ok(result.overflow <= 1, `${viewport.name}: long title does not cause horizontal overflow`);

    await page.close();
  }
} finally {
  await browser.close();
}

console.log('Home build long-title/icon responsive smoke passed.');
