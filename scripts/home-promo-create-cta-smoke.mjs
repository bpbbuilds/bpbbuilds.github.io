#!/usr/bin/env node

/** Responsive contract for the Home build-animation Create CTA. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const presetCss = await fs.readFile(path.join(root, 'js', 'shared', 'button-preset.css'), 'utf8');
const css = await fs.readFile(path.join(root, 'js', 'pages', 'home', 'home-promo-band.css'), 'utf8');
const markup = await fs.readFile(path.join(root, 'js', 'pages', 'home', 'home-promo-band.js'), 'utf8');
const assemble = await fs.readFile(path.join(root, 'js', 'pages', 'home', 'home-promo-assemble.js'), 'utf8');

assert.match(markup, /class="[^"]*home-promo__cta/, 'promo keeps a real navigational CTA element');
assert.match(markup, /data-promo-remix/, 'promo exposes a dynamic Remix CTA target');
assert.match(markup, /home-promo__cta-actions/, 'Create and Remix share an action row');
assert.match(assemble, /syncPromoRemixLink/, 'promo updates Remix for the active build');
assert.match(assemble, /create\/\?remix=\$\{encodeURIComponent\(slug\)\}/, 'Remix points to the active build slug');
assert.doesNotMatch(css, /ui-btn-crimson\.png/, 'Create CTA does not depend on an image button');
assert.match(presetCss, /\.home-preset-button\s*,[\s\S]*border-radius:\s*999px/, 'Create CTA is pill-shaped');
assert.match(css, /\.home-promo__cta\s*\{[\s\S]*--home-promo-cta-gold/, 'Create CTA defines its gold inset accent');
assert.match(presetCss, /\.home-preset-button:hover\s*,[\s\S]*0 0 0 2px var\(--home-preset-gold\)/, 'Create CTA reserves the gold inset accent for hover');
assert.match(presetCss, /\.home-preset-button\.home-preset-button--blue\s*\{[\s\S]*background:\s*linear-gradient/, 'Remix CTA uses a blue gradient button surface');
assert.match(css, /\.home-promo__cta-actions\s*\{[\s\S]*display:\s*flex/, 'CTA actions use a responsive flex layout');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent(`<!doctype html><html><head><style>${presetCss}\n${css}</style></head><body>
    <div class="home-promo home-promo--create home-promo--player-info">
      <div class="home-promo__cta-block">
        <div class="home-promo__cta-actions">
          <a class="home-preset-button home-promo__cta" href="/create/"><span>Create</span></a>
          <a class="home-preset-button home-preset-button--blue home-promo__cta home-promo__cta--remix" data-promo-remix href="/create/?remix=demo-build"><span>Remix</span></a>
        </div>
      </div>
    </div>
  </body></html>`);
  for (const width of [1440, 1080, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const style = await page.locator('.home-promo__cta').first().evaluate((el) => {
      const computed = getComputedStyle(el);
      const inner = getComputedStyle(el, '::before');
      const actions = el.parentElement;
      const remix = actions?.querySelector('.home-promo__cta--remix');
      return {
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
        remixWidth: remix?.getBoundingClientRect().width || 0,
        remixHeight: remix?.getBoundingClientRect().height || 0,
        actionsDirection: actions ? getComputedStyle(actions).flexDirection : '',
        remixBackgroundImage: remix ? getComputedStyle(remix).backgroundImage : '',
        radius: computed.borderRadius,
        backgroundImage: computed.backgroundImage,
        boxShadow: computed.boxShadow,
        beforeBorder: inner.borderTopColor,
      };
    });
    assert.ok(style.width > 0 && style.height > 0, `CTA is visible at ${width}px`);
    assert.equal(style.radius, '999px', `CTA remains pill-shaped at ${width}px`);
    assert.doesNotMatch(style.backgroundImage, /url\(/, `CTA has no image background at ${width}px`);
    assert.doesNotMatch(style.boxShadow, /234, 201, 20/, `CTA keeps the outer gold ring hidden at rest at ${width}px`);
    assert.doesNotMatch(style.boxShadow, /20, 10, 5/, `CTA has no outer shadow at rest at ${width}px`);
    assert.notEqual(style.beforeBorder, 'rgba(0, 0, 0, 0)', `CTA keeps its inner rim at rest at ${width}px`);
    assert.ok(style.remixWidth > 0 && style.remixHeight > 0, `Remix CTA is visible at ${width}px`);
    assert.ok(style.width > style.remixWidth, `Create remains wider than Remix at ${width}px`);
    assert.ok(style.height > style.remixHeight, `Create remains taller than Remix at ${width}px`);
    assert.match(style.remixBackgroundImage, /linear-gradient/, `Remix uses a gradient surface at ${width}px`);
    assert.equal(
      style.actionsDirection,
      'column',
      `CTA actions use the intended layout at ${width}px`,
    );

    await page.locator('.home-promo__cta').first().hover();
    await page.waitForTimeout(200);
    const hoverStyle = await page.locator('.home-promo__cta').first().evaluate((el) => ({
      boxShadow: getComputedStyle(el).boxShadow,
      beforeBorder: getComputedStyle(el, '::before').borderTopColor,
    }));
    assert.match(hoverStyle.boxShadow, /234, 201, 20/, `CTA keeps its gold inner rim on hover at ${width}px`);
    assert.match(hoverStyle.boxShadow, /20, 10, 5/, `CTA shows its outer shadow on hover at ${width}px`);
    assert.notEqual(hoverStyle.beforeBorder, 'rgba(0, 0, 0, 0)', `CTA keeps its inner rim on hover at ${width}px`);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);
  }
} finally {
  await browser.close();
}

console.log('Home promo Create CTA smoke passed.');
