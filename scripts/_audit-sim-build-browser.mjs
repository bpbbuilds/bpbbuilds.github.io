/**
 * Public-build picker on /sim/: no dark overlay on the parchment cards.
 *
 *   node scripts/_audit-sim-build-browser.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8796;
const OUT = path.join(ROOT, 'scripts/_fixtures');
const SLUG = process.argv[2] || 'bpbb-cool-poison-build-80sj12';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/js/shared/premium-gate.js') {
    const src = fs
      .readFileSync(path.join(ROOT, 'js/shared/premium-gate.js'), 'utf8')
      .replace(
        'export async function getPremiumEntitlement() {',
        'export async function getPremiumEntitlement() {\n' +
          '  return { signedIn: true, entitled: true, profile: { plan: "founding", display_name: "Audit" } };',
      );
    res.writeHead(200, { 'Content-Type': MIME['.js'] });
    res.end(src);
    return;
  }
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

const fails = [];
/** @param {string} name @param {boolean} ok @param {string} [detail] */
function check(name, ok, detail = '') {
  if (!ok) fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(`http://127.0.0.1:${PORT}/sim/?slug=${SLUG}`, {
  waitUntil: 'domcontentloaded',
});
await page.waitForSelector('.sim-hud[data-hud="player"]', { timeout: 30000 });
await page.waitForTimeout(800);

const foeBtn = page.locator('[data-sim-foe-rail="opponent"]');
await foeBtn.click();
await page.waitForTimeout(200);
await page.locator('[data-foe-mode="build"]').click();
await page.waitForSelector('[data-sim-build-browser]', { timeout: 15000 });
await page.waitForSelector('.sim-bb__card, .sim-bb__empty, .bpb-skel', {
  timeout: 20000,
});
await page.waitForTimeout(1200);

await page.screenshot({
  path: path.join(OUT, 'sim-build-browser.png'),
  fullPage: false,
});
await page.locator('[data-sim-build-browser]').screenshot({
  path: path.join(OUT, 'sim-build-browser-panel.png'),
});

const probe = await page.evaluate(() => {
  const panel = document.querySelector('.sim-bb__panel');
  if (!(panel instanceof HTMLElement)) return { error: 'no panel' };
  const pr = panel.getBoundingClientRect();
  const dummy = document.querySelector('[data-sim-avatar="foe"]');
  const stack = document.querySelector('.sim-avatar-stack--foe');
  const hit = (x, y) => {
    const top = document.elementFromPoint(x, y);
    return {
      cls: top?.className?.toString?.().slice(0, 90) || top?.tagName || '',
      inBrowser: Boolean(top?.closest?.('[data-sim-build-browser]')),
      isAvatar: Boolean(top?.closest?.('[data-sim-avatar]')),
    };
  };
  const dummyRect = dummy?.getBoundingClientRect();
  return {
    panel: true,
    dummyVis: dummy ? getComputedStyle(dummy).visibility : '',
    stackVis: stack ? getComputedStyle(stack).visibility : '',
    dummyHit: dummyRect
      ? hit(dummyRect.left + dummyRect.width / 2, dummyRect.top + dummyRect.height / 2)
      : null,
    panelBottomHit: hit(pr.left + pr.width * 0.45, pr.bottom - 28),
  };
});

check('picker opened', Boolean(probe.panel), probe.error || '');
check(
  'foe avatar is hidden while picker is open',
  probe.stackVis === 'hidden' || probe.dummyVis === 'hidden',
  JSON.stringify({ vis: probe.dummyVis, stackVis: probe.stackVis }),
);
check(
  'dummy does not sit on top of the picker',
  Boolean(probe.dummyHit?.inBrowser) && !probe.dummyHit?.isAvatar,
  JSON.stringify(probe.dummyHit),
);
check(
  'panel bottom is picker chrome, not the dummy',
  Boolean(probe.panelBottomHit?.inBrowser) && !probe.panelBottomHit?.isAvatar,
  JSON.stringify(probe.panelBottomHit),
);
check('no console errors', errors.length === 0, errors.join(' | ').slice(0, 300));

console.log(
  fails.length ? `\n${fails.length} FAILING:\n- ${fails.join('\n- ')}` : '\nall checks passed',
);

await browser.close();
server.close();
process.exit(fails.length ? 1 : 0);
