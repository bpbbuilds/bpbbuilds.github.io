/**
 * Audit: onboard panel centered over .create-board (not top-left of stage).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8767;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
};

function contentType(filePath) {
  return MIME[path.extname(filePath)] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  let rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!rel || rel.endsWith('/')) rel = path.join(rel, 'index.html');
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found ' + rel);
    return;
  }
  res.writeHead(200, { 'Content-Type': contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
console.log('layout http://127.0.0.1:' + PORT + '/create/');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('browser error:', msg.text());
});
page.on('pageerror', (err) => console.log('pageerror:', err.message));

await page.goto(`http://127.0.0.1:${PORT}/create/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.removeItem('bpb-create-draft:v1');
  sessionStorage.removeItem('bpb-create-onboard-skip:v3');
});
await page.reload({ waitUntil: 'networkidle' });

await page.waitForSelector('[data-board-onboard]:not([hidden])', { timeout: 60000 });
await page.waitForSelector('[data-onboard-panel]', { timeout: 5000 });
// Allow rAF reposition
await page.waitForTimeout(400);

const metrics = await page.evaluate(() => {
  const stage = document.querySelector('[data-board-stage]');
  const park = document.querySelector('.create-board__park');
  const overlay = document.querySelector('[data-board-onboard]');
  const panel = document.querySelector('[data-onboard-panel]');
  const actions = document.querySelector('.create-onboard__actions');
  const historyBtn = document.querySelector('[data-onboard-history]');
  const mediaBtn = document.querySelector('[data-onboard-media]');
  const titleEl = document.querySelector('[data-onboard-title]');
  const bags = document.querySelector('[data-onboard-bags]');
  const classes = document.querySelector('[data-onboard-classes]');
  if (!stage || !overlay || !panel) return { error: 'missing nodes' };

  const br = stage.getBoundingClientRect();
  const parkR = park?.getBoundingClientRect();
  const or = overlay.getBoundingClientRect();
  const pr = panel.getBoundingClientRect();
  const ar = actions?.getBoundingClientRect();
  const hr = historyBtn?.getBoundingClientRect();
  const mr = mediaBtn?.getBoundingClientRect();
  const tr = titleEl?.getBoundingClientRect();

  const stageCx = br.left + br.width / 2;
  const stageCy = br.top + br.height / 2;
  const panelCx = pr.left + pr.width / 2;
  const panelCy = pr.top + pr.height / 2;
  const actionsCx = ar ? ar.left + ar.width / 2 : null;

  return {
    stage: { w: br.width, h: br.height, top: br.top, left: br.left, bottom: br.bottom },
    parkTop: parkR?.top ?? null,
    overlay: {
      w: or.width,
      h: or.height,
      top: or.top,
      left: or.left,
      bottom: or.bottom,
      inline: {
        top: overlay.style.top,
        left: overlay.style.left,
        width: overlay.style.width,
        height: overlay.style.height,
      },
    },
    panel: { w: pr.width, h: pr.height, top: pr.top, left: pr.left, bottom: pr.bottom },
    dx: panelCx - stageCx,
    dy: panelCy - stageCy,
    actionsDx: actionsCx != null ? actionsCx - stageCx : null,
    overlayEndsAbovePark:
      parkR != null ? or.bottom <= parkR.top + 2 : null,
    mediaUnderHistory: hr && mr ? mr.top > hr.bottom - 2 : null,
    mediaSameWidth: hr && mr ? Math.abs(hr.width - mr.width) < 2 : null,
    historyWide: hr && tr ? hr.width >= tr.width - 4 : null,
    historyLabel: historyBtn?.querySelector?.('.create-onboard__history-label')?.textContent?.trim() ?? null,
    mediaLabel: mediaBtn?.textContent?.trim() ?? null,
    pathText: document.querySelector('[data-onboard-path]')?.textContent?.trim() ?? null,
    hasCopy: Boolean(document.querySelector('[data-onboard-copy-path]')),
    hasSkip: Boolean(document.querySelector('[data-onboard-skip]')),
    hasHint: Boolean(document.querySelector('[data-onboard-hint]')),
    bagsDisplay: bags ? getComputedStyle(bags).display : null,
    classesDisplay: classes ? getComputedStyle(classes).display : null,
    bagsChildCount: bags?.childElementCount ?? null,
    title: document.querySelector('[data-onboard-title]')?.textContent ?? null,
  };
});

console.log('METRICS', JSON.stringify(metrics, null, 2));

const TOL = 40; // px — allow nav/font settle
let failed = false;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  } else {
    console.log('OK:', msg);
  }
}

assert(!metrics.error, metrics.error || 'nodes present');
assert(metrics.overlay?.h > 80, `overlay height > 80 (got ${metrics.overlay?.h})`);
assert(Math.abs(metrics.dx) <= TOL, `panel horizontal center vs stage |dx|=${Math.abs(metrics.dx).toFixed(1)} <= ${TOL}`);
assert(Math.abs(metrics.dy) <= TOL, `panel vertical center vs stage |dy|=${Math.abs(metrics.dy).toFixed(1)} <= ${TOL}`);
assert(metrics.overlayEndsAbovePark === true, `overlay ends above park (got ${metrics.overlayEndsAbovePark})`);
assert(
  metrics.actionsDx == null || Math.abs(metrics.actionsDx) <= TOL,
  `actions horizontal center |dx|=${metrics.actionsDx != null ? Math.abs(metrics.actionsDx).toFixed(1) : 'n/a'}`,
);
assert(metrics.mediaUnderHistory === true, `media under history (got ${metrics.mediaUnderHistory})`);
assert(metrics.mediaSameWidth === true, `media same width as history (got ${metrics.mediaSameWidth})`);
assert(metrics.historyWide === true, `history spans title width (got ${metrics.historyWide})`);
assert(metrics.historyLabel === 'history.db', `history label (${metrics.historyLabel})`);
assert(metrics.mediaLabel === 'Media', `media label (${metrics.mediaLabel})`);
assert(
  typeof metrics.pathText === 'string' && metrics.pathText.includes('Godot'),
  `path hint (${metrics.pathText})`,
);
assert(metrics.hasCopy === true, 'copy path present');
assert(metrics.hasSkip === false, 'skip button removed');
assert(metrics.hasHint === false, 'hint removed');
assert(metrics.bagsDisplay === 'none', `bags hidden on class step (got ${metrics.bagsDisplay})`);
assert(metrics.title === 'Pick a class to begin', `title ok (${metrics.title})`);

// Click Reaper (2nd class) — bags step should center too
const classBtns = page.locator('[data-onboard-classes] button');
await classBtns.nth(1).click();
await page.waitForTimeout(200);

const afterClass = await page.evaluate(() => {
  const stage = document.querySelector('[data-board-stage]');
  const panel = document.querySelector('[data-onboard-panel]');
  const bags = document.querySelector('[data-onboard-bags]');
  const classes = document.querySelector('[data-onboard-classes]');
  const br = stage.getBoundingClientRect();
  const pr = panel.getBoundingClientRect();
  return {
    title: document.querySelector('[data-onboard-title]')?.textContent,
    bagsDisplay: getComputedStyle(bags).display,
    classesDisplay: getComputedStyle(classes).display,
    bagsChildCount: bags.childElementCount,
    dx: pr.left + pr.width / 2 - (br.left + br.width / 2),
    dy: pr.top + pr.height / 2 - (br.top + br.height / 2),
  };
});
console.log('AFTER CLASS', afterClass);
assert(afterClass.title === 'Pick a starting bag', `bag title (${afterClass.title})`);
assert(afterClass.bagsDisplay === 'flex', `bags visible (${afterClass.bagsDisplay})`);
assert(afterClass.classesDisplay === 'none', `classes hidden (${afterClass.classesDisplay})`);
assert(afterClass.bagsChildCount >= 1, `bag buttons (${afterClass.bagsChildCount})`);
assert(Math.abs(afterClass.dx) <= TOL, `bag-step |dx|=${Math.abs(afterClass.dx).toFixed(1)}`);
assert(Math.abs(afterClass.dy) <= TOL, `bag-step |dy|=${Math.abs(afterClass.dy).toFixed(1)}`);

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
