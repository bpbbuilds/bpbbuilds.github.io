#!/usr/bin/env node

/** Browser smoke for shared tooltip fade-in/fade-out behavior. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8823;
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head>
      <link rel="stylesheet" href="/js/shared/tooltip.css">
      <link rel="stylesheet" href="/js/pages/build/more-build-tip.css">
      <link rel="stylesheet" href="/js/pages/build/event-banner-tip.css">
      <style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0}#root{padding:80px}.test-surface{position:fixed;left:12px;top:12px;width:24px;height:24px;background:#222}</style>
    </head><body><main id="root"><button id="item" data-item-id="hammer">Item</button></main></body></html>`);
    return;
  }
  const filePath = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath);
  const contentType = ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'networkidle' });
  const result = await page.evaluate(async () => {
    window.ItemTooltip = {
      render(item) {
        const tip = document.createElement('div');
        tip.className = 'bpb-tooltip';
        tip.textContent = item.name;
        return tip;
      },
    };
    const { createTooltipHover } = await import('/js/shared/tooltip-hover.js');
    const { hideTooltip, showTooltip } = await import('/js/shared/tooltip-motion.js');
    const root = document.querySelector('#root');
    const item = document.querySelector('#item');
    const tip = createTooltipHover();
    tip.bind(root, {
      selector: '[data-item-id]',
      getItem: () => ({ name: 'Hammer' }),
    });

    const enterProbe = document.createElement('div');
    enterProbe.className = 'bpb-tooltip-float';
    enterProbe.hidden = true;
    document.body.append(enterProbe);
    showTooltip(enterProbe);
    const enterImmediate = getComputedStyle(enterProbe).opacity;
    await new Promise((resolve) => window.setTimeout(resolve, 45));
    const enterMid = getComputedStyle(enterProbe).opacity;
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    const enterFinished = getComputedStyle(enterProbe).opacity;
    enterProbe.remove();

    item.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: 120, clientY: 120 }));
    const host = tip.host;
    const visibleEntryStyle = getComputedStyle(host);
    const visibleEntryOpacity = visibleEntryStyle.opacity;
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    const visibleStyle = getComputedStyle(host);
    const visible = {
      classVisible: host.classList.contains('is-visible'),
      hasContent: host.childElementCount === 1,
      entryOpacity: visibleEntryOpacity,
      opacity: visibleStyle.opacity,
      transitionDuration: visibleStyle.transitionDuration,
      transitionProperty: visibleStyle.transitionProperty,
    };

    item.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body }));
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    const hidingStyle = getComputedStyle(host);
    const hiding = {
      classHiding: host.classList.contains('is-hiding'),
      stillMounted: host.childElementCount === 1,
      visibility: hidingStyle.visibility,
      opacity: hidingStyle.opacity,
    };
    await new Promise((resolve) => window.setTimeout(resolve, 170));
    const finished = {
      hidden: host.hidden,
      classHiding: host.classList.contains('is-hiding'),
      hasContent: host.childElementCount > 0,
    };

    const custom = [];
    for (const className of ['build-more-tip', 'build-event-tip']) {
      const el = document.createElement('div');
      el.className = `${className} bpb-tooltip`;
      el.hidden = true;
      document.body.append(el);
      showTooltip(el);
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      const shown = getComputedStyle(el);
      const shownOpacity = shown.opacity;
      const shownVisibility = shown.visibility;
      const transitionDuration = shown.transitionDuration;
      hideTooltip(el);
      await new Promise((resolve) => window.setTimeout(resolve, 60));
      const faded = getComputedStyle(el);
      custom.push({
        className,
        shownOpacity,
        shownVisibility,
        fadedOpacity: faded.opacity,
        fadedVisibility: faded.visibility,
        transitionDuration,
      });
    }

    return { visible, hiding, finished, custom, enter: { immediate: enterImmediate, mid: enterMid, finished: enterFinished } };
  });

  assert.equal(result.visible.classVisible, true, 'shared tooltip enters the visible state');
  assert.equal(result.visible.hasContent, true, 'shared tooltip mounts its content before fading in');
  assert.equal(result.visible.opacity, '1', 'shared tooltip fades to full opacity');
  assert.ok(parseFloat(result.visible.entryOpacity) < 1, 'shared tooltip begins its enter transition below full opacity');
  assert.match(result.visible.transitionProperty, /opacity/, 'shared tooltip transitions opacity');
  assert.ok(result.visible.transitionDuration.split(',').some((duration) => parseFloat(duration) > 0), 'shared tooltip has a non-zero fade duration');
  assert.ok(parseFloat(result.enter.immediate) < 1, 'shared tooltip starts transparent before the enter transition');
  assert.ok(parseFloat(result.enter.mid) > parseFloat(result.enter.immediate) && parseFloat(result.enter.mid) < 1, 'shared tooltip is visibly fading in before the transition completes');
  assert.equal(result.enter.finished, '1', 'shared tooltip finishes the fade-in at full opacity');
  assert.equal(result.hiding.classHiding, true, 'shared tooltip enters the hiding state');
  assert.equal(result.hiding.stillMounted, true, 'shared tooltip keeps content mounted during fade-out');
  assert.equal(result.hiding.visibility, 'visible', 'shared tooltip remains visible while fading out');
  assert.ok(parseFloat(result.hiding.opacity) < 1, 'shared tooltip fades out while content remains mounted');
  assert.equal(result.finished.hidden, true, 'shared tooltip hides after the fade completes');
  assert.equal(result.finished.classHiding, false, 'shared tooltip clears the hiding state after the fade');
  assert.equal(result.finished.hasContent, false, 'shared tooltip cleans up content after the fade');
  for (const custom of result.custom) {
    assert.equal(custom.shownOpacity, '1', `${custom.className} fades in`);
    assert.equal(custom.shownVisibility, 'visible', `${custom.className} becomes visible`);
    assert.ok(parseFloat(custom.fadedOpacity) < 1, `${custom.className} fades out`);
    assert.equal(custom.fadedVisibility, 'visible', `${custom.className} stays visible during fade-out`);
    assert.ok(parseFloat(custom.transitionDuration) > 0, `${custom.className} has a fade duration`);
  }
  const responsive = [];
  for (const viewport of [
    { name: 'short-desktop', width: 1080, height: 720 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const probe = await page.evaluate(async () => {
      const elements = ['bpb-tooltip-float', 'build-more-tip', 'build-event-tip'].map((className) => {
        const el = document.createElement('div');
        el.className = `${className} is-visible`;
        document.body.append(el);
        return el;
      });
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      const values = elements.map((el) => {
        const style = getComputedStyle(el);
        return { opacity: style.opacity, visibility: style.visibility, duration: style.transitionDuration };
      });
      elements.forEach((el) => el.remove());
      return values;
    });
    for (const value of probe) {
      assert.equal(value.opacity, '1', `${viewport.name}: tooltip fades in at full opacity`);
      assert.equal(value.visibility, 'visible', `${viewport.name}: tooltip is visible`);
      assert.ok(parseFloat(value.duration) > 0, `${viewport.name}: tooltip keeps its fade duration`);
    }
    responsive.push({ ...viewport, probe });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMotion = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'bpb-tooltip-float is-visible';
    document.body.append(el);
    const style = getComputedStyle(el);
    const value = { duration: style.transitionDuration, opacity: style.opacity };
    el.remove();
    return value;
  });
  assert.equal(reducedMotion.duration, '0s', 'reduced motion disables tooltip transitions');
  assert.equal(reducedMotion.opacity, '1', 'reduced motion keeps tooltip visible without fading');
  await page.close();
  console.log(JSON.stringify({ desktop: result, responsive, reducedMotion }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
