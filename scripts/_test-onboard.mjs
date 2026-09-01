/**
 * Browser audit: create onboard class → bag step.
 * Serves a tiny harness + runs Playwright.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8765;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};

const harnessHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Onboard harness</title>
  <link rel="stylesheet" href="/css/theme.css" />
  <link rel="stylesheet" href="/js/pages/build/build.css" />
  <link rel="stylesheet" href="/js/pages/create/create.css" />
</head>
<body class="page-create" data-root="/">
  <div id="stage" class="create-board__stage" style="width:640px;height:480px;margin:2rem;border:1px solid #333;position:relative;">
    <!-- Simulate backpack hit pads that previously stole clicks (z ~30k–50k) -->
    <div class="bpb-bg__hit" style="position:absolute;inset:0;z-index:50000;background:rgba(255,0,0,0.05);"></div>
    <div style="padding:2rem;position:relative;z-index:1">fake board</div>
  </div>
  <pre id="log"></pre>
  <script type="module">
    import { mountBoardOnboard } from '/js/pages/create/board-onboard.js';
    import { HERO_CLASSES } from '/js/pages/items/filter-logic.js';
    import { CLASS_STARTING_BAG_IDS } from '/js/shared/starting-bags.js';

    const log = (m) => {
      document.getElementById('log').textContent += m + '\\n';
      console.log(m);
    };

    const draft = {
      placements: [],
      starting_bag_id: null,
      hero_class: null,
    };
    const listeners = new Set();
    const state = {
      getDraft: () => draft,
      patchMeta(partial) {
        Object.assign(draft, partial);
        for (const fn of listeners) fn();
      },
      addPlacement(p) {
        draft.placements = [...draft.placements, { ...p, key: p.key || 'k1' }];
        for (const fn of listeners) fn();
        return draft.placements[draft.placements.length - 1];
      },
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
    };

    const itemsById = new Map();
    for (const bags of Object.values(CLASS_STARTING_BAG_IDS)) {
      for (const id of bags) {
        itemsById.set(id, {
          id,
          name: id,
          type: 'Bag',
          shape: [[1, 1], [1, 1]],
        });
      }
    }

    sessionStorage.removeItem('bpb-create-onboard-skip:v3');

    const stage = document.getElementById('stage');
    mountBoardOnboard(stage, {
      state,
      itemsById,
      getSpriteUrl: () => '/assets/icons/classes/AdventurerIcon.png',
      root: '/',
    });

    window.__onboard = {
      HERO_CLASSES,
      get step() {
        return document.querySelector('[data-board-onboard]')?.dataset?.step;
      },
      get title() {
        return document.querySelector('[data-onboard-title]')?.textContent;
      },
      get bagCount() {
        const g = document.querySelector('[data-onboard-bags]');
        if (!g || g.style.display === 'none') return 0;
        return g.querySelectorAll('button').length;
      },
      get classCount() {
        const g = document.querySelector('[data-onboard-classes]');
        if (!g || g.style.display === 'none') return 0;
        return g.querySelectorAll('button').length;
      },
      get overlayHidden() {
        return document.querySelector('[data-board-onboard]')?.hidden;
      },
      draft,
    };
    log('ready classes=' + HERO_CLASSES.length);
  </script>
</body>
</html>`;

function contentType(filePath) {
  return MIME[path.extname(filePath)] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/' || url.pathname === '/harness') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(harnessHtml);
    return;
  }
  const rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
console.log('harness http://127.0.0.1:' + PORT + '/harness');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (msg) => console.log('browser:', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('pageerror:', err.message));

await page.goto(`http://127.0.0.1:${PORT}/harness`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__onboard);

const before = await page.evaluate(() => ({
  step: window.__onboard.step,
  title: window.__onboard.title,
  classCount: window.__onboard.classCount,
  bagCount: window.__onboard.bagCount,
  hidden: window.__onboard.overlayHidden,
}));
console.log('BEFORE', before);

const classBtn = page.locator('[data-onboard-classes] button').first();
await classBtn.waitFor({ state: 'visible' });
const box = await classBtn.boundingBox();
console.log('classBtn box', box);

// What is on top at click point?
const topEl = await page.evaluate(() => {
  const btn = document.querySelector('[data-onboard-classes] button');
  const r = btn.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const el = document.elementFromPoint(x, y);
  return {
    x,
    y,
    tag: el?.tagName,
    className: el?.className,
    onboard: !!el?.closest('[data-board-onboard]'),
  };
});
console.log('elementFromPoint', topEl);

await classBtn.click({ force: false });
await page.waitForTimeout(100);

const after = await page.evaluate(() => ({
  step: window.__onboard.step,
  title: window.__onboard.title,
  classCount: window.__onboard.classCount,
  bagCount: window.__onboard.bagCount,
  hero: window.__onboard.draft.hero_class,
  bagsDisplay: document.querySelector('[data-onboard-bags]')?.style?.display,
  classesDisplay: document.querySelector('[data-onboard-classes]')?.style?.display,
}));
console.log('AFTER', after);

let bagClickOk = false;
if (after.bagCount > 0) {
  await page.locator('[data-onboard-bags] button').first().click();
  await page.waitForTimeout(100);
  const placed = await page.evaluate(() => ({
    placements: window.__onboard.draft.placements.length,
    bag: window.__onboard.draft.starting_bag_id,
    hidden: window.__onboard.overlayHidden,
  }));
  console.log('AFTER BAG', placed);
  bagClickOk = placed.placements === 1 && !!placed.bag && placed.hidden === true;
}

await browser.close();
server.close();

const ok =
  before.classCount >= 7 &&
  after.step === 'bag' &&
  after.bagCount === 2 &&
  after.title.includes('starting bag') &&
  bagClickOk;

if (!ok) {
  console.error('FAIL onboard flow');
  process.exit(1);
}
console.log('PASS onboard class → bag → place');
