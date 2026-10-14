#!/usr/bin/env node

/** Responsive contract for the Home build title/class dark info surface. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const css = await fs.readFile(new URL('js/pages/home/home-promo-band.css', root), 'utf8');

assert.match(css, /\.home-promo--create\s+\.home-promo__caption-head::before/, 'title surface owns a scoped dark pseudo-element');
assert.match(css, /\.home-promo--create\s+\.home-promo__caption-head\s*\{[^}]*grid-template-columns:/s, 'title surface reserves equal grid slots for the class icon');
assert.match(css, /\.home-promo--create\s+\.home-promo__caption-class\s*\{[^}]*position:\s*static/s, 'class icon stays in the reserved title grid slot');

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
      <div class="home-promo home-promo--create home-promo--player-info">
        <div class="home-promo__stage">
          <div class="home-promo__caption">
            <header class="home-promo__caption-head home-promo__caption-head--icon">
              <img class="home-promo__caption-class" src="/class.png" alt="Alchemist" width="36" height="36" />
              <span class="home-promo__caption-title">Molten Greatsword on Alchemist</span>
            </header>
          </div>
        </div>
      </div>`);

    const result = await page.evaluate(() => {
      const head = document.querySelector('.home-promo__caption-head');
      const icon = document.querySelector('.home-promo__caption-class');
      const title = document.querySelector('.home-promo__caption-title');
      if (!(head instanceof HTMLElement) || !(icon instanceof HTMLElement) || !(title instanceof HTMLElement)) {
        throw new Error('title surface probe did not mount');
      }
      const headStyle = getComputedStyle(head);
      const shadeStyle = getComputedStyle(head, '::before');
      const iconStyle = getComputedStyle(icon);
      const titleStyle = getComputedStyle(title);
      const headRect = head.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      return {
        width: headRect.width,
        height: headRect.height,
        paddingTop: parseFloat(headStyle.paddingTop),
        paddingInline: parseFloat(headStyle.paddingLeft),
        shadeContent: shadeStyle.content,
        shadeBackground: shadeStyle.backgroundColor,
        iconPosition: iconStyle.position,
        iconLeftInset: iconRect.left - headRect.left,
        iconWidth: iconRect.width,
        iconHeight: iconRect.height,
        titleWidth: titleRect.width,
        titleTextAlign: titleStyle.textAlign,
        titleCenterOffset: Math.abs((titleRect.left + titleRect.width / 2) - (headRect.left + headRect.width / 2)),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    assert.ok(result.width > 0 && result.height > 0, `${viewport.name}: title surface has layout`);
    assert.ok(result.paddingTop > 0 && result.paddingInline > 0, `${viewport.name}: title surface has responsive inset`);
    assert.equal(result.shadeContent, '""', `${viewport.name}: title surface uses a pseudo-element`);
    assert.equal(result.shadeBackground, 'rgba(14, 15, 16, 0.14)', `${viewport.name}: title surface matches Gold/Rank shade`);
    assert.equal(result.iconPosition, 'static', `${viewport.name}: class icon stays in the reserved title grid slot`);
    assert.ok(result.iconLeftInset >= 0 && result.iconLeftInset < result.width * 0.2, `${viewport.name}: class icon stays left aligned`);
    assert.ok(result.iconWidth >= 38, `${viewport.name}: class icon uses the enlarged responsive size`);
    assert.ok(Math.abs(result.iconWidth - result.iconHeight) <= 1, `${viewport.name}: class icon remains square`);
    assert.equal(result.titleTextAlign, 'center', `${viewport.name}: title remains center aligned`);
    assert.ok(result.titleCenterOffset <= 1, `${viewport.name}: title stays centered in the surface`);
    assert.ok(result.iconWidth > 0 && result.titleWidth > 0, `${viewport.name}: title and class remain visible`);
    assert.ok(result.overflow <= 1, `${viewport.name}: title surface does not cause horizontal overflow`);

    await page.close();
  }
} finally {
  await browser.close();
}

console.log('Home build title/class dark surface responsive smoke passed.');
