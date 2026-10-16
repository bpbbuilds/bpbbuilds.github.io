#!/usr/bin/env node

/** Responsive regression for Builds class, rank, and event filter groups. */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const filterHtml = await readFile(new URL('../js/pages/builds/feed-filters.js', import.meta.url), 'utf8');
const buildsCss = await readFile(new URL('../js/pages/builds/builds.css', import.meta.url), 'utf8');
const itemsCss = await readFile(new URL('../js/pages/items/filters.css', import.meta.url), 'utf8');
const presetCss = await readFile(new URL('../js/shared/filter-preset.css', import.meta.url), 'utf8');

assert.match(filterHtml, /class="il-filter__shade builds-feed-filters__events"/, 'Events has a named filter shade');
assert.match(filterHtml, /class="builds-feed-filters__event-grid"/, 'Events uses a checkmark grid');
assert.match(filterHtml, /class="il-filter__shade builds-feed-filters__classes"/, 'Hero class has a named filter shade');
assert.match(filterHtml, /builds-feed-filters__class-icons/, 'Hero class uses a dedicated icon row');
assert.match(filterHtml, /builds-feed-filters__rank-icons/, 'League rank uses a dedicated icon grid');
assert.doesNotMatch(filterHtml, /data-feed-event-trigger|data-feed-event-menu/, 'Events no longer depend on a dropdown trigger/menu');
assert.match(buildsCss, /\.builds-feed-filters__class-icons\s*\{[\s\S]*?flex-wrap:\s*nowrap/, 'Hero class stays in one row');
assert.match(buildsCss, /\.builds-feed-filters__rank-icons\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/, 'League rank uses four columns');
assert.match(buildsCss, /\.builds-feed-filters__event-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/, 'Events use compact checkmark columns');

const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head>
    <style>html,body{margin:0;background:#8b5d3b;--bpb-cursor-pointer:pointer}</style>
    <style>${itemsCss}</style>
    <style>${presetCss}</style>
    <style>${buildsCss}</style>
    <style>.items-filters.builds-feed-filters{width:22rem;max-width:100%}@media (max-width:1240px){.items-filters.builds-feed-filters{width:100%}}</style>
  </head><body><aside class="items-filters il-filter bpb-filter-preset builds-feed-filters">
    <div class="il-filter__shade builds-feed-filters__events"><p class="il-filter__sticker">Events</p>
      <div class="builds-feed-filters__event-grid" role="group" aria-label="Build events">
        <button type="button" class="il-filter__check builds-feed-filters__event is-on" data-feed-event="" aria-pressed="true"><span class="il-filter__box"></span><span class="il-filter__check-label">All events</span></button>
        <button type="button" class="il-filter__check builds-feed-filters__event" data-feed-event="highest-dps" aria-pressed="false"><span class="il-filter__box"></span><span class="il-filter__check-label">Highest DPS</span></button>
      </div>
    </div>
    <div class="il-filter__shade builds-feed-filters__classes"><p class="il-filter__sticker">Hero class</p>
      <div class="builds-feed-filters__class-icons" role="group" aria-label="Hero class">
        ${['Neutral', 'Ranger', 'Reaper', 'Pyromancer', 'Berserker', 'Mage', 'Adventurer', 'Engineer'].map((name) => `<button type="button" class="il-filter__icon-btn" data-feed-class="${name}"><img src="" alt="${name}"></button>`).join('')}
      </div>
    </div>
    <div class="il-filter__shade builds-feed-filters__ranks"><p class="il-filter__sticker">League rank</p>
      <div class="builds-feed-filters__rank-icons" role="group" aria-label="League rank">
        ${['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'grandma'].map((name) => `<button type="button" class="il-filter__icon-btn" data-feed-rank="${name}"><img src="" alt="${name}"></button>`).join('')}
      </div>
    </div>
  </aside></body></html>`);

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'short-desktop', width: 1080, height: 720 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const result = await page.evaluate(() => {
      const classGroup = document.querySelector('.builds-feed-filters__class-icons');
      const rankGroup = document.querySelector('.builds-feed-filters__rank-icons');
      const eventGroup = document.querySelector('.builds-feed-filters__event-grid');
      const readGroup = (group) => {
        const style = group ? getComputedStyle(group) : null;
        const buttons = group ? [...group.querySelectorAll('button')] : [];
        return {
          display: style?.display || '',
          wrap: style?.flexWrap || '',
          columns: style?.gridTemplateColumns || '',
          rects: buttons.map((button) => {
            const rect = button.getBoundingClientRect();
            return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
          }),
        };
      };
      return {
        classes: readGroup(classGroup),
        ranks: readGroup(rankGroup),
        events: readGroup(eventGroup),
        pressed: [...document.querySelectorAll('[data-feed-event]')].map((button) => button.getAttribute('aria-pressed')),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (result.classes.display !== 'flex' || result.classes.wrap !== 'nowrap') throw new Error(`${viewport.name}: hero class row wrapped`);
    if (result.classes.rects.length !== 8 || new Set(result.classes.rects.map((rect) => Math.round(rect.top))).size !== 1) {
      throw new Error(`${viewport.name}: hero class icons are not one readable row`);
    }
    if (result.ranks.display !== 'grid' || result.ranks.columns.split(' ').length !== 4) throw new Error(`${viewport.name}: league rank grid is not four columns`);
    if (result.ranks.rects.length !== 8 || new Set(result.ranks.rects.map((rect) => Math.round(rect.top))).size !== 2) {
      throw new Error(`${viewport.name}: league rank icons are not a two-row grid`);
    }
    if (result.events.display !== 'grid' || result.events.columns.split(' ').length !== 2 || result.events.rects.some((rect) => rect.width <= 0 || rect.height <= 0)) {
      throw new Error(`${viewport.name}: event checkmarks are not a compact grid`);
    }
    if (result.pressed.join(',') !== 'true,false') throw new Error(`${viewport.name}: event checkmark state contract changed`);
    if (result.overflowX > 1) throw new Error(`${viewport.name}: horizontal overflow ${result.overflowX}px`);
  }
  console.log('Builds class/rank/event filter groups responsive smoke passed.');
} finally {
  await browser.close();
}
