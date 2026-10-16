#!/usr/bin/env node

/** Browser regression for the Home static Night fallback and live windmill. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8852;
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'short-desktop', width: 1080, height: 720 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  const filePath = path.join(root, decodeURIComponent(url.pathname.replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
  }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const combatRequests = new Set();
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.includes('/assets/theme/backgrounds/combat/')) {
        combatRequests.add(url.pathname.split('/').pop());
      }
    });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.combat-sky', { timeout: 3000 });
    const state = await page.evaluate(() => {
      const host = document.querySelector('.combat-sky');
      const windmill = host?.querySelector('.combat-sky__windmill');
      const blades = host?.querySelector('.combat-sky__blades');
      const hostStyle = host ? getComputedStyle(host) : null;
      return {
        bodyBackground: getComputedStyle(document.body).backgroundImage,
        fixedHost: hostStyle?.position === 'fixed',
        hostBackground: hostStyle?.backgroundColor,
        hostBackgroundImage: hostStyle?.backgroundImage,
        hasWindmill: Boolean(windmill),
        hasFullSkyLayer: Boolean(host?.querySelector('.combat-sky__sky')),
        hasCelestialImages: (host?.querySelectorAll('.combat-sky__celestial').length || 0) > 0,
        bladeAnimation: blades ? getComputedStyle(blades).animationName : 'none',
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    state.combatRequests = [...combatRequests].sort();
    assert.match(state.bodyBackground, /CombatNightStatic\.png/, `${viewport.name}: static Night fallback is painted`);
    assert.equal(state.fixedHost, true, `${viewport.name}: combat sky remains fixed`);
    assert.equal(state.hostBackground, 'rgba(0, 0, 0, 0)', `${viewport.name}: fixed host is transparent`);
    assert.match(state.hostBackgroundImage, /CombatNightStatic\.png/, `${viewport.name}: fixed host paints the static Night frame`);
    assert.deepEqual(
      state.combatRequests,
      ['CombatNightStatic.png', 'Windmill.png', 'WindmillBlades.png'],
      `${viewport.name}: Home loads only the static frame and windmill assets`,
    );
    assert.equal(state.hasWindmill, true, `${viewport.name}: live windmill is mounted`);
    assert.equal(state.hasFullSkyLayer, false, `${viewport.name}: Home does not mount the full sky layer`);
    assert.equal(state.hasCelestialImages, false, `${viewport.name}: Home does not mount celestial image layers`);
    assert.equal(state.bladeAnimation, 'combat-sky-spin', `${viewport.name}: windmill blades still animate`);
    assert.ok(state.overflowX <= 1, `${viewport.name}: background introduces no horizontal overflow`);
    await page.close();
  }
  console.log('Home background first-paint browser smoke passed.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
