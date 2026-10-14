import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'js/pages/builds/builds.css'), 'utf8');

assert.match(css, /\.builds-post\s*\{[\s\S]*?--builds-surface-pad-inline:\s*clamp\(/,
  'build surfaces define a fluid inline inset');
assert.match(css, /\.builds-post\s*\{[\s\S]*?--builds-surface-pad-block:\s*clamp\(/,
  'build surfaces define a fluid block inset');
assert.match(css, /\.builds-post__body\s*\{[\s\S]*?padding:\s*var\(--builds-surface-pad-block\)\s+var\(--builds-surface-pad-inline\)/,
  'card content uses the fluid surface inset');
assert.match(css, /\.builds-post__compact\s*\{[\s\S]*?padding:\s*var\(--builds-surface-pad-block\)\s+var\(--builds-surface-pad-inline\)/,
  'compact content uses the fluid surface inset');
assert.match(css, /\.builds-post__grid\s*\{[\s\S]*?padding:\s*var\(--builds-surface-pad-block\)\s+var\(--builds-surface-pad-inline\)/,
  'grid content uses the fluid surface inset');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body class="page-builds">
    <main class="builds-main"><ul class="builds-feed__list">
      <li class="builds-post"><div class="builds-post__body"><span>Card</span></div></li>
      <li class="builds-post builds-post--compact"><div class="builds-post__compact"><span>Compact</span></div></li>
      <li class="builds-post builds-post--grid"><div class="builds-post__grid"><span>Grid</span></div></li>
    </ul></main></body></html>`);
  const result = await page.evaluate(() => [...document.querySelectorAll('.builds-post__body, .builds-post__compact, .builds-post__grid')]
    .map((node) => ({ paddingInline: parseFloat(getComputedStyle(node).paddingLeft), paddingBlock: parseFloat(getComputedStyle(node).paddingTop) })));
  assert.equal(result.length, 3, 'all three build surfaces mount');
  for (const surface of result) {
    assert.ok(surface.paddingInline >= 12, `surface inline padding is expanded (${surface.paddingInline}px)`);
    assert.ok(surface.paddingBlock >= 12, `surface block padding is expanded (${surface.paddingBlock}px)`);
  }
} finally {
  await browser.close();
}

console.log('builds surface padding smoke passed.');
