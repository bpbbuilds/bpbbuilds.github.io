#!/usr/bin/env node

/** Verify Build Info uses the reusable CSS gold divider preset in all states. */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tooltipCss = fs.readFileSync(path.join(root, 'js/shared/tooltip.css'), 'utf8');
const buildCss = fs.readFileSync(path.join(root, 'js/pages/build/build.css'), 'utf8');
const infoRail = fs.readFileSync(path.join(root, 'js/pages/build/info-rail.js'), 'utf8');

assert.match(tooltipCss, /\.bpb-divider\s*\{/, 'Reusable divider preset is missing');
assert.match(tooltipCss, /\.bpb-divider--gold[\s\S]*\{/, 'Gold divider variant is missing');
assert.match(tooltipCss, /\.bpb-divider--legendary\s*\{/, 'Rarity divider variants are not reusable');
assert.match(
  infoRail,
  /class="bpb-divider bpb-divider--gold bpb-divider--vertical build-info__divider"/,
  'Build Info divider markup is not using the gold preset',
);
assert.match(buildCss, /\.build-info__divider\s*\{[\s\S]*?margin-inline:/, 'Build Info divider layout contract is missing');

const port = 8843;
const server = http.createServer((req, res) => {
  if (req.url === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><head><style>${tooltipCss}\n${buildCss}
      html, body { margin: 0; min-height: 100%; background: #211714; }
      .fixture { width: 320px; padding: 24px; }
      .fixture .build-info__icons, .fixture .build-info__skills { display:flex; align-items:center; }
    </style></head><body><div class="fixture">
      <span class="bpb-divider bpb-divider--gold build-info__divider"></span>
      <span class="bpb-divider bpb-divider--gold build-info__divider"></span>
      <span class="bpb-divider bpb-divider--gold build-info__divider"></span>
      <span class="bpb-divider bpb-divider--gold build-info__divider"></span>
    </div></body></html>`);
    return;
  }
  const filePath = path.resolve(root, decodeURIComponent((req.url || '/').replace(/^\//, '')));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${port}/harness`, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(() => {
    const dividers = [...document.querySelectorAll('.bpb-divider--gold')];
    return {
      count: dividers.length,
      boxes: dividers.map((divider) => {
        const style = getComputedStyle(divider);
        const rect = divider.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          backgroundImage: style.backgroundImage,
          backgroundColor: style.backgroundColor,
        };
      }),
    };
  });

  assert.equal(result.count, 4, `expected four Build Info divider instances: ${JSON.stringify(result)}`);
  for (const box of result.boxes) {
    assert.ok(box.width > 0 && box.height > 0, `divider has no visible box: ${JSON.stringify(result)}`);
    assert.notEqual(box.backgroundImage, 'none', `divider is missing its CSS texture: ${JSON.stringify(result)}`);
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('Build Info divider preset smoke passed.');
