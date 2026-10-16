#!/usr/bin/env node

/**
 * Verify the dedicated Builds-view composition remains inside the short
 * desktop viewport while preserving the unscaled 1440p reference.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const themeCss = fs.readFileSync(path.join(root, 'css/theme.css'), 'utf8');
const sharedCss = fs.readFileSync(path.join(root, 'css/shared.css'), 'utf8');
const buildCss = fs.readFileSync(path.join(root, 'js/pages/build/build.css'), 'utf8');

const viewports = [
  { name: '1440p-reference', width: 2560, height: 1440, expectedScale: 1 },
  { name: '1080p-short-desktop', width: 1920, height: 1080, expectedScale: 0.75 },
  { name: '900p-short-desktop', width: 1600, height: 900, expectedScale: 0.625 },
  { name: 'tablet-stacked', width: 1024, height: 900, expectedScale: 1 },
  { name: 'mobile-stacked', width: 390, height: 844, expectedScale: 1 },
];

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});

try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>${themeCss}\n${sharedCss}\n${buildCss}
    .smoke-nav { height: 96px; }
    .smoke-space { height: 96px; }
    .smoke-layout { width: 100%; }
    .smoke-stage__media { height: 560px; }
    .smoke-info { min-height: 1px; }
    .smoke-info .build-info__shade { min-height: 86px; }
    .smoke-info .build-info__how-body { min-height: 180px; }
    .smoke-round { min-height: 112px; }
    @media (max-width: 1100px) {
      .smoke-stage__media { height: 420px; }
      .smoke-info { min-height: 720px; }
    }
  </style></head><body class="page-build page-build-view">
    <div id="site-nav" class="smoke-nav"></div>
    <div id="site-nav-space" class="smoke-space"></div>
    <main id="main" class="build-main"><div class="build-layout smoke-layout">
      <aside class="build-author"><div class="build-author__card"><div class="build-author__avatar-wrap"></div><p>Author</p></div></aside>
      <section class="build-stage">
        <header class="build-stage__head"><div class="build-stage__identity"><h1 class="build-stage__title">A build with a long title</h1><div class="build-stage__tags"><span>Real</span><span>Event</span></div></div><div class="build-stage__vote-slot"></div></header>
        <div class="build-stage__media smoke-stage__media"><div class="build-bag"><div class="bpb-bg"><div class="bpb-bg__board"></div></div></div></div>
        <div class="build-round-host smoke-round"><div class="build-round-panel"><div class="build-round-strip">${'<button class="build-round-strip__btn" type="button"></button>'.repeat(10)}</div><div class="build-round"><div class="build-round__toggles"></div><div class="build-round__nav"><span class="build-round__label">Round 10/10</span></div><div class="build-round__actions"></div></div></div></div>
      </section>
      <aside class="build-info smoke-info"><header class="build-info__head"><h2 class="build-info__title build-info__ui-text">Build Info</h2></header><section class="build-info__meta-wrap"><div class="build-info__meta"><div class="build-info__icons"><span class="build-info__icon"></span><span class="build-info__divider"></span><span class="build-info__icon"></span></div><div class="build-info__skills"><span class="build-info__icon"></span><span class="build-info__divider"></span><span class="build-info__icon"></span></div></div></section><section class="build-info__ess"><div class="build-info__ess-grid"><div class="build-info__tier build-info__shade"><h4 class="build-info__tier-label build-info__ui-text">Needs</h4><p class="build-info__empty">—</p></div><div class="build-info__tier build-info__shade"><h4 class="build-info__tier-label build-info__ui-text">Wants</h4><p class="build-info__empty">—</p></div><div class="build-info__tier build-info__shade"><h4 class="build-info__tier-label build-info__ui-text">Gold</h4><p class="build-info__empty">—</p></div><div class="build-info__tier build-info__shade"><h4 class="build-info__tier-label build-info__ui-text">Rank</h4><p class="build-info__empty">—</p></div><div class="build-info__tier build-info__tier--wide build-info__shade"><h4 class="build-info__tier-label build-info__ui-text">Good to have</h4><p class="build-info__empty">—</p></div></div></section><section class="build-info__how"><div class="build-info__how-body build-info__shade"><p class="build-info__how-text">A long build description with enough copy to represent the real information rail at its maximum content height.</p></div></section><section class="build-info__discuss-wrap"><a class="build-info__discuss" href="#discuss"><span class="build-info__discuss-label">Discuss</span></a></section></aside>
    </div></main>
    <footer id="site-footer" class="site-footer site-footer--slim"><div class="site-footer__inner site-footer__inner--slim"><p class="site-footer__brand">BPB Builds</p><nav class="site-footer__nav"><a href="#about">About</a><a href="#items">Items</a></nav><div class="site-footer__socials"></div></div></footer>
  </body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate((scale) => {
      document.body.style.setProperty('--build-desktop-scale', String(scale));
    }, viewport.expectedScale);
    const result = await page.evaluate(() => {
      const layout = document.querySelector('.build-layout');
      const stage = document.querySelector('.build-stage');
      const footer = document.querySelector('#site-footer');
      if (!(layout instanceof HTMLElement) || !(stage instanceof HTMLElement) || !(footer instanceof HTMLElement)) {
        throw new Error('Builds-view fixture missing');
      }
      const layoutRect = layout.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const style = getComputedStyle(document.body);
      return {
        layoutWidth: layoutRect.width,
        layoutHeight: layoutRect.height,
        stageLeft: stageRect.left,
        stageRight: stageRect.right,
        stageWidth: stageRect.width,
        footerTop: footerRect.top,
        footerBottom: footerRect.bottom,
        viewportHeight: window.innerHeight,
        bodyScrollHeight: document.body.scrollHeight,
        documentScrollHeight: document.documentElement.scrollHeight,
        scale: Number.parseFloat(style.getPropertyValue('--build-desktop-scale')) || 1,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (viewport.expectedScale < 1 && result.bodyScrollHeight > viewport.height + 1) {
      throw new Error(`${viewport.name}: composition still requires page scrolling (${result.bodyScrollHeight}px > ${viewport.height}px)`);
    }
    if (result.overflowX > 1) {
      throw new Error(`${viewport.name}: horizontal overflow ${result.overflowX}px`);
    }
    if (result.stageLeft < -1 || result.stageRight > viewport.width + 1) {
      throw new Error(`${viewport.name}: stage is outside the viewport (${result.stageLeft.toFixed(1)}-${result.stageRight.toFixed(1)}px)`);
    }
    if (viewport.expectedScale === 1 && Math.abs(result.scale - 1) > 0.001) {
      throw new Error(`${viewport.name}: reference composition was scaled`);
    }
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
