/**
 * Probe magic_torch + pandamonium live-art glitches.
 *   node scripts/_audit-torch-panda.mjs
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8785;
const OUT = path.join(ROOT, 'scripts/_fixtures');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  let rel = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!rel || rel.endsWith('/')) rel = path.join(rel, 'index.html');
  const f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`http://127.0.0.1:${PORT}/items/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.bpb-bg__item', { timeout: 30000 });
await page.waitForTimeout(1200);

const search = page.locator('.il-filter__input[type="search"], input.il-filter__input[name="q"]');
fs.mkdirSync(OUT, { recursive: true });

async function capture(id) {
  if (await search.count()) {
    await search.first().fill(id.replace(/_/g, ' '));
    await page.waitForTimeout(600);
  }
  const el = page.locator(`.bpb-bg__item[data-item-id="${id}"]`).first();
  if (!(await el.count())) {
    console.log('MISS', id);
    return null;
  }
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const shot = path.join(OUT, `glitch-${id}.png`);
  await el.screenshot({ path: shot });
  const meta = await el.evaluate((node) => {
    const live = node.querySelector('.bpb-live');
    const base = node.querySelector('img.bpb-live__base');
    const glow = node.querySelector('.bpb-live__glow');
    const holo = node.querySelector('canvas.bpb-live__holo');
    const lr = live?.getBoundingClientRect();
    const gr = glow?.getBoundingClientRect();
    const hr = holo?.getBoundingClientRect();
    const gcs = glow ? getComputedStyle(glow) : null;
    const lcs = live ? getComputedStyle(live) : null;
    return {
      kind: live?.getAttribute('data-live-kind'),
      overflow: lcs?.overflow,
      isolation: lcs?.isolation,
      glow: glow
        ? {
            tag: glow.tagName,
            w: gr.width,
            h: gr.height,
            blend: gcs.mixBlendMode,
            op: gcs.opacity,
            translate: gcs.translate,
            bg: gcs.backgroundColor,
            mask: gcs.maskImage || gcs.webkitMaskImage,
          }
        : null,
      holo: holo
        ? { w: hr.width, h: hr.height, cw: holo.width, ch: holo.height }
        : null,
      live: lr ? { w: lr.width, h: lr.height } : null,
      baseNatural: base?.naturalWidth,
    };
  });
  const img = await loadImage(fs.readFileSync(shot));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);
  // Count near-gray opaque pixels (bounding-box artifact).
  let grayBox = 0;
  let opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue;
    opaque += 1;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (max - min < 18 && luma > 90 && luma < 200) grayBox += 1;
  }
  console.log(
    JSON.stringify(
      {
        id,
        meta,
        grayShare: opaque ? +(grayBox / opaque).toFixed(3) : 0,
        shot,
      },
      null,
      2,
    ),
  );
  return { id, grayShare: opaque ? grayBox / opaque : 0, meta };
}

const rows = [];
for (const id of ['magic_torch', 'pandamonium', 'burning_torch', 'oil_lamp', 'the_lovers', 'ace_of_spades']) {
  rows.push(await capture(id));
}

await browser.close();
server.close();
