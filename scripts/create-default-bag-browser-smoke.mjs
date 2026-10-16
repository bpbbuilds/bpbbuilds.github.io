import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8799;
const boardEditorSource = fs.readFileSync(path.join(ROOT, 'js/pages/create/board-editor.js'), 'utf8');
const defaultBagButtonSource = boardEditorSource.match(
  /<button\b[^>]*class="[^\"]*create-board__toggle--default-bag[^\"]*"[^>]*>[\s\S]*?<\/button>/,
)?.[0];
if (!defaultBagButtonSource) {
  throw new Error('default bag button markup is missing');
}
if (!/title="Fill with default bags"/.test(defaultBagButtonSource)) {
  throw new Error('default bag button should explain that it fills the board');
}
if (!/aria-label="Fill with default bags"/.test(defaultBagButtonSource)) {
  throw new Error('default bag button accessible label is unclear');
}
if (!/assets\/icons\/history\/BagToggle-v3\.png/.test(defaultBagButtonSource)) {
  throw new Error('default bag button should use the game backpack icon');
}
if (!/create-board__default-bag-badge/.test(defaultBagButtonSource)) {
  throw new Error('default bag button should show a fill/add cue');
}
if (/<svg[\s\S]*?create-board__default-bag-icon/.test(defaultBagButtonSource)) {
  throw new Error('default bag button must not use the lock-shaped inline SVG');
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><link rel="stylesheet" href="/js/pages/create/create.css"><body class="page-create">
      <div class="create-board is-awaiting-build"><div class="create-board__toolbar"><div class="create-board__toolbar-spacer"></div>
        <div class="create-board__toolbar-center"><div class="create-board__modes"><button class="create-board__toggle--bags"></button></div>
          <button class="create-board__toggle--clear"></button>
          <button class="create-board__toggle--default-bag" title="Fill with default bags" aria-label="Fill with default bags">
            <span class="create-board__default-bag-icon" aria-hidden="true">
              <img src="/assets/icons/history/BagToggle-v3.png" alt="" />
              <span class="create-board__default-bag-badge" aria-hidden="true">+</span>
            </span>
          </button>
        </div><div class="create-board__economy"></div>
      </div></div></body>`);
    return;
  }
  const rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const viewports = [
  { width: 1440, height: 900 },
  { width: 1080, height: 720 },
  { width: 800, height: 900 },
  { width: 390, height: 844 },
];
await page.goto(`http://127.0.0.1:${PORT}/harness`, { waitUntil: 'networkidle' });
for (const viewport of viewports) {
  await page.setViewportSize(viewport);
  const state = await page.evaluate(() => {
    const read = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const style = getComputedStyle(el);
      return { visibility: style.visibility, pointerEvents: style.pointerEvents };
    };
    return {
      defaultBag: read('.create-board__toggle--default-bag'),
      defaultBagIcon: read('.create-board__default-bag-icon'),
      defaultBagBadge: read('.create-board__default-bag-badge'),
      modes: read('.create-board__modes'),
      clear: read('.create-board__toggle--clear'),
    };
  });
  if (state.defaultBag?.visibility !== 'visible' || state.defaultBag.pointerEvents === 'none') {
    throw new Error(`default bag button unavailable at ${viewport.width}px: ${JSON.stringify(state)}`);
  }
  if (state.defaultBagIcon?.visibility !== 'visible' || state.defaultBagBadge?.visibility !== 'visible') {
    throw new Error(`default bag icon cue unavailable at ${viewport.width}px: ${JSON.stringify(state)}`);
  }
  if (state.modes?.visibility !== 'hidden' || state.clear?.visibility !== 'hidden') {
    throw new Error(`empty-board toolbar controls changed at ${viewport.width}px: ${JSON.stringify(state)}`);
  }
}
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log('create default bag browser smoke: ok (1440, 1080, narrow, mobile)');
