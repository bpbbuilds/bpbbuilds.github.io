#!/usr/bin/env node

/** Verify the build-view title/tags/vote header geometry at every supported size. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildCss = fs.readFileSync(path.join(root, 'js/pages/build/build.css'), 'utf8');
const pageSource = fs.readFileSync(path.join(root, 'js/pages/build/page.js'), 'utf8');
if (!pageSource.includes('build-stage__tags')) {
  throw new Error('renderStageHead is missing the title tag group');
}
if (!pageSource.includes('build-stage__vote-slot')) {
  throw new Error('renderStageHead is missing the header vote slot');
}
if (!pageSource.includes('moveVoteToStageHead(roundHost, main)')) {
  throw new Error('the bound vote control is not moved into the header slot');
}

const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const viewports = [
  { name: 'reference', width: 2560, height: 1440 },
  { name: 'short-desktop', width: 1920, height: 1080 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true, executablePath: edgePath });
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>${buildCss}
    .smoke-layout { width: 720px; margin: 0 auto; grid-template-columns: 0 0 720px 0 0; column-gap: 0; }
    .smoke-media { height: 315px; }
    @media (max-width: 1100px) {
      .smoke-layout { width: 360px; display: block; }
      .smoke-stage { width: 100%; }
    }
  </style></head><body class="page-build page-build-view">
    <main class="build-main"><div class="build-layout smoke-layout">
      <section class="build-stage smoke-stage">
        <header class="build-stage__head">
          <div class="build-stage__identity">
            <h1 class="build-stage__title">A long build title</h1>
            <div class="build-stage__tags"><span class="build-stage__auth">Real</span><span class="build-stage__event">Event</span></div>
          </div>
          <div class="build-stage__vote-slot"><div class="build-round__vote" role="group" aria-label="Build rating">
            <button class="build-round__vote-btn" type="button"><img class="build-round__vote-icon" alt="" width="28" height="28" /></button>
            <span class="build-round__vote-score">0</span>
            <button class="build-round__vote-btn" type="button"><img class="build-round__vote-icon" alt="" width="28" height="28" /></button>
          </div></div>
        </header>
        <div class="build-stage__media smoke-media"></div>
      </section>
    </div></main>
  </body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const result = await page.evaluate(() => {
      const head = document.querySelector('.build-stage__head');
      const title = document.querySelector('.build-stage__title');
      const tags = document.querySelector('.build-stage__tags');
      const identity = document.querySelector('.build-stage__identity');
      const voteSlot = document.querySelector('.build-stage__vote-slot');
      if (![head, title, tags, identity, voteSlot].every((el) => el instanceof HTMLElement)) {
        throw new Error('header fixture missing');
      }
      const headRect = head.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const tagsRect = tags.getBoundingClientRect();
      const identityRect = identity.getBoundingClientRect();
      const voteRect = voteSlot.getBoundingClientRect();
      return {
        headDisplay: getComputedStyle(head).display,
        titleAlign: getComputedStyle(title).textAlign,
        identityDirection: getComputedStyle(document.querySelector('.build-stage__identity')).flexDirection,
        tagsBelowTitle: tagsRect.top >= titleRect.bottom - 0.5,
        voteRightAligned: Math.abs(voteRect.right - headRect.right) <= 1,
        voteStartsWithHeader: Math.abs(voteRect.top - headRect.top) <= 1,
        voteEndsWithTags: Math.abs(voteRect.bottom - identityRect.bottom) <= 1,
        headWidth: headRect.width,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (result.headDisplay !== 'grid') throw new Error(`${viewport.name}: header is not a two-column grid`);
    if (result.titleAlign !== 'left') throw new Error(`${viewport.name}: title is not left aligned`);
    if (result.identityDirection !== 'column') throw new Error(`${viewport.name}: tags are not below the title`);
    if (!result.tagsBelowTitle) throw new Error(`${viewport.name}: tags overlap title`);
    if (!result.voteRightAligned) throw new Error(`${viewport.name}: vote slot is not right aligned`);
    if (!result.voteStartsWithHeader) throw new Error(`${viewport.name}: vote slot does not start at the header top`);
    if (!result.voteEndsWithTags) throw new Error(`${viewport.name}: vote slot does not extend through the tags`);
    if (result.headWidth <= 0 || result.overflowX > 1) throw new Error(`${viewport.name}: header collapsed or overflowed`);
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
