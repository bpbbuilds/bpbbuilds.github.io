/**
 * Cooldown overlay vs ItemProgress.gdshader: sprite brighten, not a white plate.
 *
 *   node scripts/_audit-sim-cd.mjs
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8798;
const OUT = path.join(ROOT, 'scripts', '_fixtures');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const harness = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="/js/shared/backpack-grid/backpack-grid.css" />
  <link rel="stylesheet" href="/js/pages/sim/fx/sim-item-chrome.css" />
  <style>
    html, body { margin: 0; background: #c4a070; }
    .sim-field { padding: 24px; display: flex; gap: 32px; align-items: flex-end; }
    .sim-field__bag { position: relative; width: 180px; height: 220px; font-size: 80px; }
    .bpb-bg__item { position: relative; width: 2em; height: 2em; }
    .bpb-bg__spin, .bpb-bg__hit { position: absolute; inset: 0; }
    .bpb-bg__sprite {
      position: absolute; top: 50%; left: 50%; translate: -50% -50%;
      width: 2em; height: 2em; object-fit: contain;
    }
  </style>
</head>
<body>
  <div class="sim-field" id="board">
    <div class="sim-field__bag">
      <div class="bpb-bg__item" data-placement-key="p0" data-face="0" data-item-id="miss_fortune">
        <div class="bpb-bg__spin">
          <button type="button" class="bpb-bg__hit">
            <img class="bpb-bg__sprite" src="/assets/item-sprites/MissFortune.png" alt="" />
          </button>
        </div>
      </div>
    </div>
  </div>
  <script type="module">
    import { createSimItemChrome } from '/js/pages/sim/fx/sim-item-chrome.js';
    const run = {
      events: [
        { t: 2.5, type: 'activate', placementKey: 'p0' },
        { t: 5.5, type: 'activate', placementKey: 'p0' },
      ],
      pieceSnapshots: [
        { t: 0, byKey: { p0: { loopCd: 3, triggerTime: 3, cooldown: 3 } } },
      ],
    };
    const chrome = createSimItemChrome({
      boardEl: document.getElementById('board'),
      run,
    });
    chrome.seek(4);
    window.__cdReady = true;
  </script>
</body>
</html>`;

const fails = [];
function check(name, ok, detail = '') {
  if (ok) console.log(`OK  ${name}`);
  else {
    console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
    fails.push(name);
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': MIME['.html'] });
    res.end(harness);
    return;
  }
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, resolve));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 520, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__cdReady === true, { timeout: 15000 });
await page.waitForTimeout(200);

const item = page.locator('.bpb-bg__item');
await item.screenshot({ path: path.join(OUT, 'sim-cd-miss-fortune.png') });

const probe = await page.evaluate(() => {
  const itemEl = document.querySelector('.bpb-bg__item');
  const cd = document.querySelector('.sim-cd-shade');
  const fillChild = document.querySelector('.sim-cd-shade__fill');
  const img = document.querySelector('img.bpb-bg__sprite');
  if (!(itemEl instanceof HTMLElement) || !(cd instanceof HTMLElement) || !(img instanceof HTMLImageElement)) {
    return { error: 'missing nodes' };
  }
  const cs = getComputedStyle(cd);
  const ir = itemEl.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(ir.width);
  canvas.height = Math.round(ir.height);
  const ctx = canvas.getContext('2d');
  ctx.drawWindow
    ? null
    : ctx.drawImage;
  return {
    error: null,
    hasFillChild: Boolean(fillChild),
    on: cd.classList.contains('is-on'),
    vis: cs.visibility,
    filter: cs.filter,
    bg: cs.backgroundImage.slice(0, 80),
    fill: cd.style.getPropertyValue('--sim-cd'),
    box: { w: ir.width, h: ir.height, x: ir.x, y: ir.y },
  };
});

check('chrome mounted', !probe.error, probe.error || '');
check('no white-plate fill child', probe.hasFillChild === false);
check('shade is on', probe.on === true, JSON.stringify(probe));
check('filter brightens the sprite', String(probe.filter).includes('brightness'), probe.filter);
check('art is the item sprite', /MissFortune/i.test(probe.bg || ''), probe.bg);
check('fill is mid-cycle', Number(probe.fill) > 0.3 && Number(probe.fill) < 0.7, probe.fill);

const shot = await item.screenshot();
const png = await page.evaluate(async (b64) => {
  const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(bmp, 0, 0);
  const { width: w, height: h } = c;
  const pix = (x, y) => {
    const p = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    return [p[0], p[1], p[2], p[3]];
  };
  const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const chroma = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b);
  // Transparent corner of the box (outside silhouette).
  const corner = pix(4, 4);
  // Head / upper third (should still read as the doll, not a white bar).
  const head = pix(w * 0.5, h * 0.22);
  // Dress / lower third (filled highlight).
  const dress = pix(w * 0.5, h * 0.72);
  return {
    w,
    h,
    corner,
    head,
    dress,
    headLuma: luma(head),
    dressLuma: luma(dress),
    headChroma: chroma(head),
    dressChroma: chroma(dress),
    cornerLuma: luma(corner),
  };
}, shot.toString('base64'));

check(
  'transparent corner is not a white plate',
  png.corner[3] < 40 || png.cornerLuma < 200,
  JSON.stringify(png.corner),
);
check(
  'head keeps doll color (not chalk white)',
  png.headChroma > 18 && png.headLuma < 230,
  JSON.stringify({ head: png.head, luma: png.headLuma, chroma: png.headChroma }),
);
check(
  'filled dress is a brighter sprite, still colored',
  png.dressChroma > 12 && png.dressLuma > png.headLuma,
  JSON.stringify({
    dress: png.dress,
    dressLuma: png.dressLuma,
    headLuma: png.headLuma,
    chroma: png.dressChroma,
  }),
);
check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 400));

await browser.close();
server.close();
if (fails.length) {
  console.error(`\n${fails.length} FAILING:\n- ${fails.join('\n- ')}`);
  process.exit(1);
}
console.log('\nall checks passed');
console.log(`shot ${path.join(OUT, 'sim-cd-miss-fortune.png')}`);
