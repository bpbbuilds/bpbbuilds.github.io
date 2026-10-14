#!/usr/bin/env node

/** Responsive regression for the Builds card Class/Rank/Sub/Gold tiles. */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const css = await fs.readFile(new URL('js/pages/builds/builds.css', root), 'utf8');
assert.match(css, /\.builds-post__info-cell\s*\{[\s\S]*?background:\s*radial-gradient\(/, 'card info tiles use the Home hero radial surface');
assert.match(css, /\.builds-post__info-cell\s*\{[\s\S]*?border:\s*1px solid #3a322c/, 'card info tiles use the Home hero edge');
assert.match(css, /\.builds-post__info-cell\s*\{[\s\S]*?border-radius:\s*1\.5rem/, 'card info tiles use the Home hero radius');
assert.doesNotMatch(css, /\.builds-post__info-cell::before\s*\{/, 'card info tiles no longer paint the faded Patch3 overlay');

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
      <style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;background:#211711}</style>
      <style>${css}</style>
      <article class="builds-post">
        <div class="builds-post__body">
          <aside class="builds-post__info" aria-label="Build details">
            <div class="builds-post__info-grid">
              <div class="builds-post__info-cell"><span>Class</span><span>Pyro</span></div>
              <div class="builds-post__info-cell"><span>Rank</span><span>Diamond</span></div>
              <div class="builds-post__info-cell builds-post__info-cell--wide"><span>Sub</span><span>Dragon</span></div>
              <div class="builds-post__info-cell builds-post__info-cell--wide"><span>Gold</span><span>314</span></div>
            </div>
          </aside>
        </div>
      </article>`);

    const result = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.builds-post__info-cell')];
      return {
        cells: cells.map((cell) => {
          const style = getComputedStyle(cell);
          const before = getComputedStyle(cell, '::before');
          return {
            backgroundImage: style.backgroundImage,
            backgroundColor: style.backgroundColor,
            borderRadius: style.borderRadius,
            borderTopColor: style.borderTopColor,
            borderTopWidth: style.borderTopWidth,
            beforeContent: before.content,
          };
        }),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    assert.equal(result.cells.length, 4, `${viewport.name}: all four info tiles mounted`);
    assert.ok(result.cells.every((cell) => cell.backgroundImage.includes('radial-gradient')), `${viewport.name}: info tiles use the hero radial surface`);
    assert.ok(result.cells.every((cell) => cell.backgroundColor === 'rgb(20, 17, 15)'), `${viewport.name}: info tiles use the hero dark fallback`);
    assert.ok(result.cells.every((cell) => cell.borderRadius === '24px'), `${viewport.name}: info tiles share the hero radius`);
    assert.ok(result.cells.every((cell) => cell.borderTopColor === 'rgb(58, 50, 44)' && cell.borderTopWidth === '1px'), `${viewport.name}: info tiles share the hero edge`);
    assert.ok(result.cells.every((cell) => cell.beforeContent === 'none'), `${viewport.name}: faded overlay is removed`);
    assert.ok(result.overflowX <= 1, `${viewport.name}: card info tiles do not cause horizontal overflow`);

    await page.close();
  }
} finally {
  await browser.close();
}

console.log('Builds card info surface responsive smoke passed.');
