#!/usr/bin/env node

/** Responsive browser smoke for the Home Player info animation preset. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'js/pages/home/home-promo-band.css'), 'utf8');
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'short-desktop', width: 1080, height: 720 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true, executablePath: edgePath });
try {
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><html><head><style>*,*::before,*::after{box-sizing:border-box;}html,body{margin:0;min-height:100%;}body{background:#211711;}</style><style>${css}</style></head><body>
    <div class="home-promo home-promo--create home-promo--parchment home-promo--player-info">
      <div class="home-promo__band"><div class="home-promo__card">
      <div class="home-promo__side home-promo__side--player"><aside class="home-promo__creator home-promo__player"><span class="home-promo__creator-face"><span class="home-promo__caption-avatar bpb-face"><img class="bpb-face__base" alt="" /></span></span><strong class="home-promo__creator-name">Player</strong><span class="home-promo__creator-count home-promo__info-shade"><span class="home-promo__creator-count-label">Builds</span><strong class="home-promo__creator-count-number">11</strong></span></aside></div>
        <div class="home-promo__stage"><div class="home-promo__caption"><h2 class="home-promo__caption-title">A long Player Info build title that should remain readable without overflowing the board</h2></div><div class="home-promo__board-wrap"><a class="home-promo__board-link"><div class="home-promo__board" style="height:18rem;width:23rem"></div></a></div><div class="home-promo__board-tags" data-promo-board-tags><span class="home-promo__board-tag">Real</span></div></div>
        <div class="home-promo__side home-promo__side--right home-promo__side--cta"><div class="home-promo__cta-block"><p class="home-promo__cta-lead">Create your build now.</p><a class="home-promo__cta" href="#">Create</a></div></div>
      </div></div>
    </div>
  </body></html>`);

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const result = await page.evaluate(() => {
      const player = document.querySelector('.home-promo__side--player');
      const face = document.querySelector('.home-promo__player .home-promo__creator-face');
      const name = document.querySelector('.home-promo__player .home-promo__creator-name');
      const title = document.querySelector('.home-promo__caption-title');
      const kicker = document.querySelector('.home-promo__player .home-promo__creator-kicker');
      const count = document.querySelector('.home-promo__player .home-promo__creator-count');
      const countLabel = count?.querySelector('.home-promo__creator-count-label');
      const countNumber = count?.querySelector('.home-promo__creator-count-number');
      const boardTags = document.querySelector('.home-promo__board-tags');
      const card = document.querySelector('.home-promo__card');
      const board = document.querySelector('.home-promo__board');
      const profileProbe = document.createElement('span');
      profileProbe.className = 'home-promo__creator-face';
      profileProbe.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;';
      profileProbe.innerHTML = '<img class="home-promo__caption-avatar" alt="" />';
      document.body.append(profileProbe);
      const blobStyle = face ? getComputedStyle(face) : null;
      const profileStyle = getComputedStyle(profileProbe);
      const playerRect = player?.getBoundingClientRect();
      const boardRect = board?.getBoundingClientRect();
      const cardStyle = card ? getComputedStyle(card) : null;
      return {
        playerWidth: playerRect?.width || 0,
        playerDisplay: player ? getComputedStyle(player).display : 'none',
        faceWidth: face?.getBoundingClientRect().width || 0,
        blobBorderRadius: blobStyle?.borderRadius || '',
        blobOverflow: blobStyle?.overflow || '',
        profileBorderRadius: profileStyle.borderRadius || '',
        profileOverflow: profileStyle.overflow || '',
        nameFontSize: name ? parseFloat(getComputedStyle(name).fontSize) || 0 : 0,
        titleFontSize: title ? parseFloat(getComputedStyle(title).fontSize) || 0 : 0,
        titleDisplay: title ? getComputedStyle(title).display : '',
        titleWhiteSpace: title ? getComputedStyle(title).whiteSpace : '',
        titleLineClamp: title ? getComputedStyle(title).webkitLineClamp : '',
        titleLineHeight: title ? parseFloat(getComputedStyle(title).lineHeight) || 0 : 0,
        titleHeight: title?.getBoundingClientRect().height || 0,
        hasKicker: Boolean(kicker),
        countShade: count?.classList.contains('home-promo__info-shade') === true,
        countBeforeColor: count ? getComputedStyle(count, '::before').backgroundColor : '',
        countLabelBeforeNumber: Boolean(countLabel && countNumber && countLabel.compareDocumentPosition(countNumber) & Node.DOCUMENT_POSITION_FOLLOWING),
        boardTagsDisplay: boardTags ? getComputedStyle(boardTags).display : 'missing',
        boardWidth: boardRect?.width || 0,
        cardAreas: cardStyle?.gridTemplateAreas || '',
        cardBackgroundImage: cardStyle?.backgroundImage || '',
        cardBackgroundColor: cardStyle?.backgroundColor || '',
        cardBorderTopWidth: cardStyle?.borderTopWidth || '',
        cardShadow: cardStyle?.boxShadow || '',
        hasCatalog: Boolean(document.querySelector('.home-promo__catalog')),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    if (result.playerWidth <= 0 || result.playerDisplay === 'none') throw new Error(`${viewport.name}: Player info column is hidden (${JSON.stringify(result)})`);
    if (result.faceWidth < 200) throw new Error(`${viewport.name}: Player blob/profile is not enlarged (${JSON.stringify(result)})`);
    if (result.blobBorderRadius !== '0px' || result.blobOverflow !== 'visible') throw new Error(`${viewport.name}: blob face is still clipped by a circular frame (${JSON.stringify(result)})`);
    if (result.profileBorderRadius !== '50%' || result.profileOverflow !== 'hidden') throw new Error(`${viewport.name}: profile photo lost its circular crop (${JSON.stringify(result)})`);
    if (result.nameFontSize < 20) throw new Error(`${viewport.name}: creator name is not enlarged (${JSON.stringify(result)})`);
    if (result.titleFontSize < 20.5) throw new Error(`${viewport.name}: build title is not enlarged (${JSON.stringify(result)})`);
    if (!['-webkit-box', 'flow-root'].includes(result.titleDisplay) || result.titleWhiteSpace !== 'normal' || result.titleLineClamp !== '2') throw new Error(`${viewport.name}: Player Info title is not two-line clamped (${JSON.stringify(result)})`);
    if (result.titleHeight < result.titleLineHeight * 1.8) throw new Error(`${viewport.name}: Player Info title does not have room for two lines (${JSON.stringify(result)})`);
    if (result.hasKicker) throw new Error(`${viewport.name}: Player info kicker is still visible (${JSON.stringify(result)})`);
    if (!result.countShade || result.countBeforeColor !== 'rgba(14, 15, 16, 0.14)') throw new Error(`${viewport.name}: build count is missing the dark stat shade (${JSON.stringify(result)})`);
    if (!result.countLabelBeforeNumber) throw new Error(`${viewport.name}: Builds label is not above the count (${JSON.stringify(result)})`);
    if (result.boardTagsDisplay !== 'none') throw new Error(`${viewport.name}: Player Info board tags are still visible (${JSON.stringify(result)})`);
    if (result.boardWidth <= 0) throw new Error(`${viewport.name}: board collapsed`);
    if (result.cardBackgroundImage !== 'none' || result.cardBackgroundColor !== 'rgba(0, 0, 0, 0)') throw new Error(`${viewport.name}: Player info card still has a background (${JSON.stringify(result)})`);
    if (result.cardBorderTopWidth !== '0px' || result.cardShadow !== 'none') throw new Error(`${viewport.name}: Player info card still has border/shadow (${JSON.stringify(result)})`);
    if (result.hasCatalog) throw new Error(`${viewport.name}: catalog mounted in Player info mode`);
    if (result.overflowX > 1) throw new Error(`${viewport.name}: horizontal overflow ${result.overflowX}px`);
    results.push({ ...viewport, ...result });
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
}
