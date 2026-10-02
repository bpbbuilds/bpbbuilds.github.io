/**
 * Drag-resize check for the three Combat Log sections (game ResizableControl).
 * Verifies handle rects vs game px and that a pointer drag grows only the
 * dragged section, clamped to its min.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8783;
const OUT = path.join(ROOT, 'scripts/_fixtures');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  let rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!rel || rel.endsWith('/')) rel = path.join(rel, 'index.html');
  const filePath = path.join(ROOT, rel);
  if (
    !filePath.startsWith(ROOT) ||
    !fs.existsSync(filePath) ||
    fs.statSync(filePath).isDirectory()
  ) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
  });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1400 } });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(`http://127.0.0.1:${PORT}/sim/log-ui/`, {
  waitUntil: 'domcontentloaded',
});
await page.waitForSelector('.sim-clog-resize--log', { timeout: 20000 });
await page.waitForTimeout(400);

const checks = [];
const ok = (label, pass, got) =>
  checks.push(`${pass ? 'OK  ' : 'FAIL'} ${label}${pass ? '' : ` — got ${got}`}`);
const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;

/** handle rect relative to its section, vs game margins */
async function handleRect(section, handle) {
  return page.evaluate(
    ([s, h]) => {
      const sec = document.querySelector(s);
      const btn = document.querySelector(h);
      if (!sec || !btn) return null;
      const a = sec.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      return {
        left: Math.round(b.left - a.left),
        right: Math.round(a.right - b.right),
        top: Math.round(b.top - a.bottom),
        bottom: Math.round(b.bottom - a.bottom),
        h: Math.round(b.height),
        cursor: getComputedStyle(btn).cursor,
      };
    },
    [section, handle],
  );
}

// Game VerticalResizeButton margins (bottom-anchored)
const GAME = {
  log: { sel: '.sim-clog-panel', hs: '.sim-clog-resize--log', left: 3, right: 56, top: -23, bottom: 34 },
  you: { sel: '.sim-clog-tab--you', hs: '.sim-clog-resize--you', left: 11, right: 48, top: -17, bottom: 33 },
  opp: { sel: '.sim-clog-tab--opp', hs: '.sim-clog-resize--opp', left: 38, right: 21, top: -22, bottom: 29 },
};

for (const [id, g] of Object.entries(GAME)) {
  const r = await handleRect(g.sel, g.hs);
  ok(
    `${id} handle x ${g.left}/${g.right} y ${g.top}/${g.bottom}`,
    r &&
      near(r.left, g.left) &&
      near(r.right, g.right) &&
      near(r.top, g.top) &&
      near(r.bottom, g.bottom),
    JSON.stringify(r),
  );
  ok(`${id} handle cursor ns-resize`, r?.cursor === 'ns-resize', r?.cursor);
}

/** @returns {Promise<{log:number, you:number, opp:number}>} */
async function heights() {
  return page.evaluate(() => ({
    log: Math.round(document.querySelector('.sim-clog-panel').getBoundingClientRect().height),
    you: Math.round(document.querySelector('.sim-clog-tab--you').getBoundingClientRect().height),
    opp: Math.round(document.querySelector('.sim-clog-tab--opp').getBoundingClientRect().height),
  }));
}

async function drag(sel, dy) {
  const box = await page.locator(sel).boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy / 2, { steps: 4 });
  await page.mouse.move(x, y + dy, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

const start = await heights();

// Meters track the log while untouched (game close(): margin_bottom 0)
await drag('.sim-clog-resize--log', 160);
const afterLog = await heights();
ok(
  'log drag +160 grows log',
  near(afterLog.log, Math.min(start.log + 160, 1400 - 96), 6),
  `${start.log} -> ${afterLog.log}`,
);
ok('log drag carries open meters', near(afterLog.you, afterLog.log, 6), `${afterLog.you} vs ${afterLog.log}`);

// One meter only
await drag('.sim-clog-resize--you', 120);
const afterYou = await heights();
ok('you drag +120 grows you', near(afterYou.you, afterLog.you + 120, 8), `${afterLog.you} -> ${afterYou.you}`);
ok('you drag leaves log', near(afterYou.log, afterLog.log, 2), `${afterYou.log}`);
ok('you drag leaves opp', near(afterYou.opp, afterLog.opp, 2), `${afterYou.opp}`);

await drag('.sim-clog-resize--opp', 90);
const afterOpp = await heights();
ok('opp drag +90 grows opp', near(afterOpp.opp, afterYou.opp + 90, 8), `${afterYou.opp} -> ${afterOpp.opp}`);
ok('opp drag leaves you', near(afterOpp.you, afterYou.you, 2), `${afterOpp.you}`);

// Mins: DamageMeter rect_min_size.y 200 while open, CombatLog 300
await drag('.sim-clog-resize--you', -900);
const minYou = await heights();
ok('you min 200', near(minYou.you, 200, 2), `${minYou.you}`);
await drag('.sim-clog-resize--log', -900);
const minLog = await heights();
ok('log min 300', near(minLog.log, 300, 2), `${minLog.log}`);

// Reopen resets the dragged meter (game DamageMeter.open(): rect_size.y = 500)
await drag('.sim-clog-resize--opp', 140);
await page.click('.sim-clog-tab--opp .sim-clog-tab__chev');
await page.click('.sim-clog-tab--opp .sim-clog-tab__chev');
await page.waitForTimeout(150);
const reopened = await page.evaluate(
  () => document.querySelector('.sim-clog-tab--opp').style.height || '(none)',
);
ok('reopen clears dragged height', reopened === '(none)', reopened);

// Collapsed meters hide the strip (game close(): vResizeButton.hide())
await page.click('.sim-clog-tab--you .sim-clog-tab__chev');
await page.waitForTimeout(120);
const hidden = await page.evaluate(
  () => getComputedStyle(document.querySelector('.sim-clog-resize--you')).display,
);
ok('collapsed you hides strip', hidden === 'none', hidden);
await page.click('.sim-clog-tab--you .sim-clog-tab__chev');
await page.waitForTimeout(120);

// Leave the three sections at different heights, then clip wide enough for the
// flaps that hang outside .sim-clog-ui.
await drag('.sim-clog-resize--you', 130);
await drag('.sim-clog-resize--opp', -60);
const uiBox = await page.locator('.sim-clog-ui').boundingBox();
await page.screenshot({
  path: path.join(OUT, 'clog-resize.png'),
  clip: {
    x: Math.max(0, uiBox.x - 500),
    y: Math.max(0, uiBox.y - 60),
    width: Math.min(1800, uiBox.width + 1000),
    height: Math.min(1340 - uiBox.y, uiBox.height + 200),
  },
});

// Smoke the live page: handles present, no console errors
const errors = [];
const sim = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
sim.on('pageerror', (e) => errors.push(e.message));
sim.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await sim.goto(`http://127.0.0.1:${PORT}/sim/`, { waitUntil: 'domcontentloaded' });
await sim.waitForTimeout(2500);
// A bare /sim/ load has no run, so the logbook shell only exists after a fight.
const opener = sim.locator('[data-logbook-toggle]');
if (await opener.count()) {
  await opener.first().click();
  await sim.waitForTimeout(600);
  const simHandles = await sim.evaluate(
    () => document.querySelectorAll('[data-resize-handle]').length,
  );
  ok('/sim/ mounts 3 handles', simHandles === 3, String(simHandles));
} else {
  checks.push('SKIP /sim/ handle count (no run on a bare load)');
}
ok('/sim/ no console errors', errors.length === 0, errors.join(' | ').slice(0, 300));

console.log(checks.join('\n'));
console.log(checks.some((c) => c.startsWith('FAIL')) ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');

await browser.close();
server.close();
