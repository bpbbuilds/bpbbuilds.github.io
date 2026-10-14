#!/usr/bin/env node

/** Responsive browser smoke for the isolated Choose your hero section. */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8817;
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'short-desktop', width: 1080, height: 720 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head>
      <style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0}</style>
      <link rel="stylesheet" href="/css/theme.css">
      <link rel="stylesheet" href="/css/shared.css">
      <link rel="stylesheet" href="/js/pages/home/home-class-showcase.css">
      <link rel="stylesheet" href="/js/pages/admin/home-class-showcase-test.css">
    </head><body class="page-admin page-admin-home-class-showcase-test" data-root="/"><main><div id="probe" data-hero-preview data-style="home"></div></main></body></html>`);
    return;
  }
  const filePath = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath);
  const contentType = ext === '.js'
    ? 'text/javascript'
    : ext === '.css'
      ? 'text/css'
      : ext === '.webm'
        ? 'video/webm'
        : ext === '.webp'
          ? 'image/webp'
          : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const realFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes('/assets/data/sprite-display.json')) {
        return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/rest/v1/items')) {
        return Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return realFetch(input, init);
    };
  });
  await page.evaluate(async () => {
    const { initHomeClassShowcase } = await import('/js/pages/home/home-class-showcase.js');
    window.__showcase = initHomeClassShowcase('#probe');
  });
  await page.waitForTimeout(100);

  const animationSources = await page.evaluate(() => {
    const preview = document.querySelector('#probe');
    const ranger = preview?.querySelector('[data-hero-class="Ranger"] img');
    const video = preview?.querySelector('[data-hero-class="Ranger"] [data-ranger-video]');
    const others = [...preview?.querySelectorAll('[data-home-mobs-card]:not([data-hero-class="Ranger"]) img') || []];
    const controller = window.__showcase;
    const staticSrc = ranger?.getAttribute('src') || '';
    controller?.setRangerAnimation(true);
    const idleSrc = ranger?.getAttribute('src') || '';
    const idleFlag = ranger?.getAttribute('data-ranger-image') || '';
    const idleVideoSrc = video?.getAttribute('src') || '';
    const otherIdle = others.some((img) => String(img.getAttribute('src') || '').includes('char-ranger-idle'));
    controller?.setRangerAnimation(false);
    return { staticSrc, idleSrc, idleFlag, idleVideoSrc, otherIdle, restoredSrc: ranger?.getAttribute('src') || '' };
  });
  if (!animationSources.staticSrc.includes('char-ranger.png')) throw new Error(`Ranger starts on the static source: ${JSON.stringify(animationSources)}`);
  if (animationSources.idleFlag !== 'idle' || !animationSources.idleVideoSrc.includes('char-ranger-idle-hq.webm')) throw new Error(`Ranger game idle did not activate: ${JSON.stringify(animationSources)}`);
  if (animationSources.otherIdle) throw new Error(`Non-Ranger card received Ranger animation: ${JSON.stringify(animationSources)}`);
  if (!animationSources.restoredSrc.includes('char-ranger.png')) throw new Error(`Ranger static source did not restore: ${JSON.stringify(animationSources)}`);

  const idleLoad = await page.evaluate(async () => {
    const ranger = document.querySelector('[data-hero-class="Ranger"] img');
    const video = document.querySelector('[data-hero-class="Ranger"] [data-ranger-video]');
    window.__showcase?.setRangerAnimation(true);
    if (!(ranger instanceof HTMLImageElement)) return 0;
    if (!ranger.complete) {
      await new Promise((resolve) => {
        ranger.addEventListener('load', resolve, { once: true });
        ranger.addEventListener('error', resolve, { once: true });
      });
    }
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    let alphaAtCorner = 255;
    if (video instanceof HTMLVideoElement && video.readyState >= 2 && video.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        alphaAtCorner = ctx.getImageData(0, 0, 1, 1).data[3];
      }
    }
    return {
      width: ranger.naturalWidth,
      videoVisible: video instanceof HTMLVideoElement && !video.hidden,
      videoFrameReady: video instanceof HTMLVideoElement && video.classList.contains('is-ranger-video-ready'),
      videoReady: video instanceof HTMLVideoElement ? video.readyState : 0,
      videoWidth: video instanceof HTMLVideoElement ? video.videoWidth : 0,
      videoHeight: video instanceof HTMLVideoElement ? video.videoHeight : 0,
      videoTime: video instanceof HTMLVideoElement ? video.currentTime : 0,
      alphaAtCorner,
    };
  });
  if (idleLoad.width <= 0) throw new Error(`Ranger game idle fallback did not load (${JSON.stringify(idleLoad)})`);
  if (!idleLoad.videoVisible || !idleLoad.videoFrameReady || idleLoad.videoReady < 2 || idleLoad.videoTime <= 0) {
    throw new Error(`Ranger game idle video did not advance (${JSON.stringify(idleLoad)})`);
  }
  if (idleLoad.videoWidth < 600 || idleLoad.videoHeight < 700) {
    throw new Error(`Ranger game idle video is still too small for the rendered card (${JSON.stringify(idleLoad)})`);
  }
  if (idleLoad.alphaAtCorner >= 255) {
    throw new Error(`Ranger game idle video lost transparency (${JSON.stringify(idleLoad)})`);
  }
  await page.evaluate(() => window.__showcase?.setRangerAnimation(false));

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMotionSource = await page.evaluate(() => {
    const ranger = document.querySelector('[data-hero-class="Ranger"] img');
    const video = document.querySelector('[data-hero-class="Ranger"] [data-ranger-video]');
    const preview = document.querySelector('#probe');
    if (preview instanceof HTMLElement) preview.dataset.style = 'ranger-idle';
    window.__showcase?.setRangerAnimation(true);
    return {
      src: ranger?.getAttribute('src') || '',
      flag: ranger?.getAttribute('data-ranger-image') || '',
      videoHidden: video instanceof HTMLVideoElement ? video.hidden : false,
      sectionAnimation: preview?.querySelector('.home-mobs') instanceof HTMLElement
        ? getComputedStyle(preview.querySelector('.home-mobs')).animationName
        : '',
    };
  });
  if (!reducedMotionSource.src.includes('char-ranger.png') || reducedMotionSource.flag !== 'static' || !reducedMotionSource.videoHidden || reducedMotionSource.sectionAnimation !== 'none') {
    throw new Error(`Ranger animation ignored reduced-motion preference: ${JSON.stringify(reducedMotionSource)}`);
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.__showcase?.setRangerAnimation(false));

  const results = [];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const style of ['home', 'compact', 'wireframe', 'ranger-idle']) {
      const result = await page.evaluate((nextStyle) => {
        const preview = document.querySelector('#probe');
        const rail = preview?.querySelector('[data-home-mobs-rail]');
        const section = preview?.querySelector('.home-mobs');
        const cards = preview?.querySelectorAll('[data-home-mobs-card]') || [];
        if (preview instanceof HTMLElement) preview.dataset.style = nextStyle;
        const firstCard = preview?.querySelector('.home-mobs__card');
        const firstImage = preview?.querySelector('.home-mobs__image img');
        const rangerVideo = preview?.querySelector('.home-mobs__image-ranger-video');
        const band = preview?.querySelector('.home-mobs__band');
        const railRect = rail?.getBoundingClientRect();
        const cardRect = firstCard?.getBoundingClientRect();
        const imageStyle = firstImage ? getComputedStyle(firstImage) : null;
        const rangerVideoStyle = rangerVideo ? getComputedStyle(rangerVideo) : null;
        const sectionStyle = section ? getComputedStyle(section) : null;
        const bandStyle = band ? getComputedStyle(band) : null;
        const bandBackgroundStyle = band ? getComputedStyle(band, '::before') : null;
        const railStyle = rail ? getComputedStyle(rail) : null;
        return {
          cards: cards.length,
          railWidth: railRect?.width || 0,
          railScrollWidth: rail?.scrollWidth || 0,
          cardWidth: cardRect?.width || 0,
          imageHeight: imageStyle?.height || '',
          rangerVideoHeight: rangerVideoStyle?.height || '',
          wireframeFilter: imageStyle?.filter || '',
          sectionAnimation: sectionStyle?.animationName || '',
          bandBackgroundImage: bandStyle?.backgroundImage || '',
          bandBackgroundSize: bandStyle?.backgroundSize || '',
          bandBackgroundPseudoImage: bandBackgroundStyle?.backgroundImage || '',
          bandBackgroundPseudoSize: bandBackgroundStyle?.backgroundSize || '',
          bandBackgroundPseudoMask: bandBackgroundStyle?.webkitMaskImage || bandBackgroundStyle?.maskImage || '',
          bandBackgroundPseudoMaskSize: bandBackgroundStyle?.webkitMaskSize || bandBackgroundStyle?.maskSize || '',
          bandBackgroundPseudoLeft: bandBackgroundStyle?.left || '',
          bandBackgroundPseudoRight: bandBackgroundStyle?.right || '',
          railScrollBehavior: railStyle?.scrollBehavior || '',
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      }, style);
      if (result.cards !== 7) throw new Error(`${viewport.name}/${style}: expected 7 hero cards`);
      if (result.railWidth <= 0 || result.cardWidth <= 0) throw new Error(`${viewport.name}/${style}: section collapsed`);
      if (result.railScrollWidth < result.railWidth) throw new Error(`${viewport.name}/${style}: hero rail is not scrollable`);
      if (result.bandBackgroundImage !== 'none') {
        throw new Error(`${viewport.name}/${style}: Choose your hero band should leave the content surface transparent`);
      }
      if (!result.bandBackgroundPseudoImage.includes('bg-dark-textured.webp')) {
        throw new Error(`${viewport.name}/${style}: Choose your hero did not use the dark textured background layer`);
      }
      if (result.bandBackgroundPseudoSize !== 'cover') {
        throw new Error(`${viewport.name}/${style}: Choose your hero texture is not responsive (${result.bandBackgroundPseudoSize})`);
      }
      const tinyMobile = viewport.width <= 400;
      if (tinyMobile) {
        if (result.bandBackgroundPseudoMask !== 'none') {
          throw new Error(`${viewport.name}/${style}: Choose your hero should use the Explore Items small-screen mask fallback`);
        }
      } else {
        if (!result.bandBackgroundPseudoMask.includes('data:image/svg+xml')) {
          throw new Error(`${viewport.name}/${style}: Choose your hero background is missing the inverted top curve mask`);
        }
        const expectedMaskSize = viewport.width <= 768 ? '100px 25px' : '320px 24px';
        if (!result.bandBackgroundPseudoMaskSize.includes(expectedMaskSize)) {
          throw new Error(`${viewport.name}/${style}: Choose your hero curve is not using the Explore Items geometry (${result.bandBackgroundPseudoMaskSize})`);
        }
      }
      const expectedBleed = viewport.width > 1100 ? `-${(viewport.width * 40 / 1920)}px` : '0px';
      if (result.bandBackgroundPseudoLeft !== expectedBleed || result.bandBackgroundPseudoRight !== expectedBleed) {
        throw new Error(`${viewport.name}/${style}: Choose your hero background is not viewport-flush (${JSON.stringify(result)})`);
      }
      if (style === 'wireframe' && !result.wireframeFilter.includes('grayscale')) {
        throw new Error(`${viewport.name}/${style}: wireframe treatment was not applied`);
      }
      if (style === 'ranger-idle') {
        if (!result.sectionAnimation.includes('home-class-showcase-ranger-bottom-in')) {
          throw new Error(`${viewport.name}/${style}: section did not use the bottom-up entrance`);
        }
        if (result.railScrollBehavior !== 'auto') {
          throw new Error(`${viewport.name}/${style}: rail retained horizontal smooth scrolling`);
        }
      } else if (result.railScrollBehavior !== 'smooth') {
        throw new Error(`${viewport.name}/${style}: non-Ranger rail behavior changed to ${result.railScrollBehavior}`);
      }
      if (result.overflowX > 1) throw new Error(`${viewport.name}/${style}: horizontal overflow ${result.overflowX}px`);
      if (result.rangerVideoHeight !== result.imageHeight) {
        throw new Error(`${viewport.name}/${style}: Ranger video sizing diverged from the card art (${JSON.stringify(result)})`);
      }
      results.push({ ...viewport, style, ...result });
    }
  }
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
