/**
 * Visual proof: glow weapons show colored base art, not shadow silhouettes.
 *   node scripts/_audit-glow-weapons.mjs
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8787;
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

const WANT = [
  'hungry_blade',
  'bloodthorne',
  'magic_staff',
  'flame_whip',
  'manathirst',
  'lightsaber',
  'burning_sword',
  'spectral_dagger',
  // Soft CircleLight discs — must not paint white squares on 1×1 badges.
  'leaf_badge',
  'wolf_badge',
  'skull_badge',
  'puzzle_badge',
  'cog_badge',
  'rainbow_badge',
  'poison_ivy',
  'yggdrasil_leaf',
];

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

const fails = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails.push(name);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`http://127.0.0.1:${PORT}/items/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.bpb-bg__item', { timeout: 30000 });
await page.waitForTimeout(1500);

const search = page.locator('.il-filter__input[type="search"], input.il-filter__input[name="q"]');

/** Scroll / search until an id is in the DOM (virtualized catalog). */
async function findItem(id) {
  const loc = page.locator(`.bpb-bg__item[data-item-id="${id}"]`);
  if (await loc.count()) return loc.first();
  if (await search.count()) {
    const q = id.replace(/_/g, ' ');
    await search.first().fill(q);
    await page.waitForTimeout(500);
    if (await loc.count()) return loc.first();
  }
  for (let i = 0; i < 80; i += 1) {
    await page.evaluate(() => {
      const stage = document.querySelector('.bpb-bg--itemiary');
      if (stage) stage.scrollTop += 450;
    });
    await page.waitForTimeout(50);
    if (await loc.count()) return loc.first();
  }
  return null;
}

fs.mkdirSync(OUT, { recursive: true });

for (const id of WANT) {
  const el = await findItem(id);
  if (!el) {
    check(`${id} found`, false);
    continue;
  }
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const shotPath = path.join(OUT, `glow-${id}.png`);
  await el.screenshot({ path: shotPath });

  const meta = await el.evaluate((node) => {
    const live = node.querySelector('.bpb-live');
    const base = node.querySelector('img.bpb-live__base');
    const glow = node.querySelector('img.bpb-live__glow');
    const cs = live ? getComputedStyle(live) : null;
    const gcs = glow ? getComputedStyle(glow) : null;
    const lr = live?.getBoundingClientRect();
    const gr = glow?.getBoundingClientRect();
    return {
      masked: cs ? (cs.webkitMaskImage || cs.maskImage || 'none') !== 'none' : false,
      mask: cs ? (cs.webkitMaskImage || cs.maskImage || '').slice(0, 80) : '',
      baseNatural: base instanceof HTMLImageElement ? base.naturalWidth : 0,
      glowNatural: glow instanceof HTMLImageElement ? glow.naturalWidth : 0,
      pending: node.classList.contains('bpb-bg__item--sprite-pending'),
      glowW: gr?.width || 0,
      liveH: lr?.height || 0,
      // 0 = top of item, 1 = bottom — glow center along the item.
      glowCenterY: lr && gr && lr.height ? (gr.top + gr.height / 2 - lr.top) / lr.height : null,
      translate: gcs?.translate || '',
    };
  });

  check(`${id} not pending`, !meta.pending);
  check(`${id} unmasked`, !meta.masked, meta.mask);
  check(`${id} base loaded`, meta.baseNatural > 8, JSON.stringify(meta));

  const isLightBadge = /badge|poison_ivy|yggdrasil_leaf|^flame$/.test(id);
  if (!isLightBadge) {
    check(
      `${id} glow not stretched to full item`,
      meta.glowW > 0 && meta.liveH > 0 && meta.glowW < meta.liveH * 1.35,
      JSON.stringify({ glowW: meta.glowW, liveH: meta.liveH }),
    );
  } else {
    const liveW = await el.evaluate((node) => {
      const live = node.querySelector('.bpb-live');
      return live?.getBoundingClientRect().width || 0;
    });
    check(
      `${id} light plate sized to item`,
      meta.glowW > 0 && liveW > 0 && meta.glowW < liveW * 2.2 && meta.glowW > liveW * 0.8,
      JSON.stringify({ glowW: meta.glowW, liveW }),
    );
  }

  // Magic Staff orb glow must sit in the upper half (Godot pos y = -250).
  if (id === 'magic_staff' && meta.glowCenterY != null) {
    check(
      `${id} glow near orb (upper half)`,
      meta.glowCenterY < 0.45,
      `centerY=${meta.glowCenterY.toFixed(2)} translate=${meta.translate}`,
    );
  }

  const img = await loadImage(fs.readFileSync(shotPath));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);
  let colored = 0;
  let darkOnly = 0;
  let opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 40) continue;
    opaque += 1;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (chroma > 28 && luma > 35) colored += 1;
    else if (luma < 55) darkOnly += 1;
  }
  const colorShare = opaque ? colored / opaque : 0;
  const darkShare = opaque ? darkOnly / opaque : 1;
  check(
    `${id} has colored art`,
    colorShare > 0.12,
    `color=${colorShare.toFixed(2)} dark=${darkShare.toFixed(2)} opaque=${opaque}`,
  );
}

console.log(fails.length ? `\n${fails.length} FAILING` : '\nall checks passed');
await browser.close();
server.close();
process.exit(fails.length ? 1 : 0);
