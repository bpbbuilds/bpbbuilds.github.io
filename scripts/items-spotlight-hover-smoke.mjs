#!/usr/bin/env node

/** Regression for clicked-item showcase hover/focus feedback. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const css = await fs.readFile(
  new URL('../js/pages/items/spotlight.css', import.meta.url),
  'utf8',
);

for (const selector of [
  '.il-spotlight-recipes__item:hover',
  '.il-spotlight-builds__link:hover',
]) {
  const block = css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?\\}`))?.[0] || '';
  assert.match(block, /transform:\s*[^;]*scale\(/, `${selector} needs a scale treatment`);
  assert.match(block, /filter:\s*[\s\S]*brightness\(/, `${selector} needs a brightness treatment`);
  assert.match(block, /filter:\s*[\s\S]*drop-shadow/, `${selector} needs a neutral depth shadow`);
  assert.doesNotMatch(block, /rgba\(234,\s*201,\s*20|#eac914|color-mix\([^;]*#eac914/, `${selector} must not use a gold hover glow`);
  assert.doesNotMatch(block, /outline\s*:/, `${selector} must not use an outline hover treatment`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.setContent(`
    <style>${css}</style>
    <style>
      .il-spotlight-recipes__sprite--empty { width: 40px; height: 40px; }
    </style>
    <main>
      <aside class="il-spotlight-recipes">
        <button class="il-spotlight-recipes__item" type="button"><span class="il-spotlight-recipes__sprite il-spotlight-recipes__sprite--empty"></span></button>
      </aside>
      <aside class="il-spotlight-builds">
        <a class="il-spotlight-builds__link" href="#build">
          <span class="il-spotlight-builds__board"></span>
          <span class="il-spotlight-builds__meta"><span class="il-spotlight-builds__name">Build</span></span>
        </a>
      </aside>
    </main>
  `);

  for (const viewport of [
    { width: 2560, height: 1440 },
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const recipe = page.locator('.il-spotlight-recipes__item');
    const build = page.locator('.il-spotlight-builds__link');

    await page.mouse.move(2, 2);
    const recipeBox = await recipe.boundingBox();
    await page.mouse.move(recipeBox.x + recipeBox.width / 2, recipeBox.y + recipeBox.height / 2);
    const recipeHover = await recipe.evaluate((el) => {
      const style = getComputedStyle(el);
      return { transform: style.transform, outline: style.outlineStyle, filter: style.filter };
    });
    assert.notEqual(recipeHover.transform, 'none', `Recipe hover must grow at ${viewport.width}x${viewport.height}`);
    assert.equal(recipeHover.outline, 'none', `Recipe hover must not draw an outline at ${viewport.width}x${viewport.height}`);
    assert.match(recipeHover.filter, /brightness\(/, `Recipe hover must brighten at ${viewport.width}x${viewport.height}`);
    assert.doesNotMatch(recipeHover.filter, /rgba\(234, 201, 20|color-mix/, `Recipe hover must not glow gold at ${viewport.width}x${viewport.height}`);

    await page.mouse.move(2, 2);
    const buildBox = await build.boundingBox();
    await page.mouse.move(buildBox.x + buildBox.width / 2, buildBox.y + buildBox.height / 2);
    const buildHover = await build.evaluate((el) => {
      const style = getComputedStyle(el);
      return { transform: style.transform, outline: style.outlineStyle, filter: style.filter };
    });
    assert.notEqual(buildHover.transform, 'none', `Build hover must grow at ${viewport.width}x${viewport.height}`);
    assert.equal(buildHover.outline, 'none', `Build hover must not draw an outline at ${viewport.width}x${viewport.height}`);
    assert.match(buildHover.filter, /brightness\(/, `Build hover must brighten at ${viewport.width}x${viewport.height}`);
    assert.doesNotMatch(buildHover.filter, /rgba\(234, 201, 20|color-mix/, `Build hover must not glow gold at ${viewport.width}x${viewport.height}`);
  }

  await page.locator('.il-spotlight-recipes__item').focus();
  const focus = await page.locator('.il-spotlight-recipes__item').evaluate((el) => {
    const style = getComputedStyle(el);
    return { transform: style.transform, outline: style.outlineStyle };
  });
  assert.notEqual(focus.transform, 'none', 'Recipe keyboard focus must retain the highlight treatment');
  assert.equal(focus.outline, 'none', 'Recipe keyboard focus must not use the old outline');

  console.log('Items spotlight hover smoke passed.');
} finally {
  await browser.close();
}
