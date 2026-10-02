/**
 * Living item art: JSON coverage + potion/glow/holo harness.
 *
 *   node scripts/_audit-item-live-art.mjs
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8792;
const JSON_PATH = path.join(ROOT, 'assets', 'data', 'item-live-art.json');
const LAYERS = path.join(ROOT, 'assets', 'item-layers');
const CSS = path.join(ROOT, 'js', 'shared', 'item-live-art', 'item-live-art.css');
const JS = path.join(ROOT, 'js', 'shared', 'item-live-art', 'index.js');
const LIQUID = path.join(ROOT, 'js', 'shared', 'item-live-art', 'potion-liquid.js');
const PIECES = path.join(ROOT, 'js', 'shared', 'backpack-grid', 'item-pieces.js');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const NEED = [
  'health_potion',
  'mana_potion',
  'stone_skin_potion',
  'lightning_potion',
  'rainbow_potion',
  'hungry_blade',
  'burning_torch',
];

function fail(msg) {
  console.error(`FAIL ${msg}`);
  process.exitCode = 1;
}
function ok(msg) {
  console.log(`ok  ${msg}`);
}

const harness = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="/js/shared/backpack-grid/backpack-grid.css" />
  <style>
    body { margin: 0; background: #2a1c14; }
    .bpb-bg { --bpb-bg-cell: 64px; position: relative; width: 980px; height: 220px; }
    .bpb-bg__item { position: absolute; width: 1.2em; height: 2em; font-size: 64px; }
  </style>
</head>
<body data-root="/">
  <div class="bpb-bg" id="board"></div>
  <script type="module">
    import { loadLiveArt, liveInnerHtml, mountLiveArt, setPotionLevel, liveArtSpec } from '/js/shared/item-live-art/index.js';
    await loadLiveArt();
    const board = document.getElementById('board');
    const ids = [
      { id: 'health_potion', src: '/assets/item-sprites/HealthPotion.png' },
      { id: 'mana_potion', src: '/assets/item-sprites/ManaPotion.png' },
      { id: 'hungry_blade', src: '/assets/item-sprites/HungryBlade.png' },
      { id: 'burning_torch', src: '/assets/item-sprites/BurningTorch.png' },
      { id: 'ace_of_spades', src: '/assets/item-sprites/AceOfSpades.png' },
      { id: 'the_lovers', src: '/assets/item-sprites/TheLovers.png' },
      { id: 'magic_staff', src: '/assets/item-sprites/MagicStaff.png' },
      { id: 'bloodthorne', src: '/assets/item-sprites/Bloodthorne.png' },
    ];
    ids.forEach((row, i) => {
      const id = row.id;
      const item = { id, name: id };
      const html = liveInnerHtml(item, { src: row.src, defer: false, sizeStyle: 'width:1em;height:2em;' });
      const el = document.createElement('div');
      el.className = 'bpb-bg__item';
      el.setAttribute('data-item-id', id);
      el.style.left = (0.2 + i * 1.15) + 'em';
      el.style.top = '0.2em';
      el.innerHTML = html || '<img class="bpb-bg__sprite" alt="" />';
      board.appendChild(el);
      mountLiveArt(el);
    });
    window.__live = {
      kinds: ids.map((row) => ({ id: row.id, kind: liveArtSpec(row.id)?.kind, has: !!document.querySelector('[data-item-id="'+row.id+'"] .bpb-live') })),
      drain() { setPotionLevel(document.querySelector('[data-item-id="health_potion"]'), -1, { ms: 0 }); },
      emptyAttr() { return document.querySelector('[data-item-id="health_potion"]')?.hasAttribute('data-potion-empty'); },
    };
  </script>
</body>
</html>`;

function staticAudit() {
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const items = data.items || {};
  const css = fs.readFileSync(CSS, 'utf8');
  const js = fs.readFileSync(JS, 'utf8');
  const liquid = fs.readFileSync(LIQUID, 'utf8');
  const pieces = fs.readFileSync(PIECES, 'utf8');
  if (Object.keys(items).length < 30) fail(`live-art map small (${Object.keys(items).length})`);
  else ok(`live-art map ${Object.keys(items).length} items`);
  for (const id of NEED) {
    if (!items[id]) fail(`missing ${id}`);
    else ok(`${id} → ${items[id].kind}`);
  }
  if (items.health_potion?.kind !== 'potion') fail('health_potion not potion');
  if (items.hungry_blade?.kind !== 'glow') fail('hungry_blade not glow');
  if (items.burning_torch?.kind !== 'flicker') fail('burning_torch not flicker');
  const files = new Set(fs.readdirSync(LAYERS));
  for (const need of ['Flask1.png', 'HealthPotionMask.png', 'Flask1_Overlay.png', 'LavaNoise.png', 'VampireSword_glow.png', 'TorchLight.png']) {
    if (!files.has(need)) fail(`layer missing ${need}`);
  }
  ok(`layers dir ${files.size} files`);
  if (!css.includes('bpb-live-glow') || !css.includes('bpb-live-flicker')) fail('CSS missing glow/flicker');
  else ok('glow/flicker CSS present');
  if (!css.includes('plus-lighter') || !css.includes('--bpb-live-op0')) {
    fail('glow CSS still uses screen + hardcoded opacity');
  } else ok('glow uses plus-lighter + spec opacity');
  if (!css.includes('overflow: hidden') || !css.includes('bpb-live--crop')) {
    fail('live art not cropped to item silhouette');
  } else ok('live wrap crops with overflow + mask');
  if (css.includes('--bpb-live-lx') || css.includes('--bpb-live-ox')) {
    fail('potion layers still translated off the flask');
  } else ok('potion layers aligned to sprite box');
  if (!css.includes('bpb-live__glow--light')) fail('missing light-plate halo class');
  else ok('light-plate halo class present');
  if (!liquid.includes('premultipliedAlpha: true') || !liquid.includes('sanitizePotionGradient')) {
    fail('potion blit still non-premultiplied / unsanitized foam');
  } else ok('potion gradient foam sanitized + premultiplied blit');
  if (!js.includes('layoutGlowPlate') || !js.includes('spec.pos')) {
    fail('glow layout ignores Godot Sprite.position');
  } else ok('glow layout uses Godot pos + texture scale');
  if (!js.includes('glowOpacityRange') || !js.includes('bpb-live__glow--light')) {
    fail('glow markup ignores spec opacity / light plates');
  } else ok('glow markup passes opacity + light class');
  if (!js.includes('cropStyle') || !js.includes('bpb-live--crop')) {
    fail('live markup missing crop mask');
  } else ok('live markup sets crop mask');
  // Glow wraps must not be masked (luminance punch-out on dark weapons).
  if (/const crop = still && !light/.test(js) || /crop = still &&/.test(js)) {
    fail('glow wraps still apply a crop mask');
  } else ok('glow wraps are unmasked');
  if (!js.includes('feedLiveDrag') || !js.includes('tiltRad')) fail('potion slosh missing tilt');
  else ok('potion slosh uses drag tilt');
  const floatSrc = fs.readFileSync(path.join(ROOT, 'js', 'pages', 'create', 'drag-float.js'), 'utf8');
  if (!floatSrc.includes('fillCursorSprite') || !floatSrc.includes('sloshCursorPotion')) {
    fail('create drag cursor missing live art');
  } else ok('create drag cursor mounts live art + slosh');
  if (!js.includes('setPotionLevel') || !pieces.includes('liveInnerHtml')) fail('grid not wired');
  else ok('createItemEl uses liveInnerHtml');
  if (!js.includes('prefers-reduced-motion') && !js.includes('prefersReduced')) fail('no reduced-motion');
  else ok('reduced-motion handled');
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/__live-harness') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(harness);
        return;
      }
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      let file = path.join(ROOT, url === '/' ? 'index.html' : url.replace(/^\//, ''));
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      const rel = path.relative(ROOT, file);
      if (rel.startsWith('..') || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function sampleWhite(buf) {
  const img = await loadImage(buf);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height).data;
  let opaque = 0;
  let white = 0;
  let red = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 40) continue;
    opaque += 1;
    if (d[i] > 225 && d[i + 1] > 225 && d[i + 2] > 225) white += 1;
    if (d[i] > 130 && d[i] > d[i + 1] + 35 && d[i] > d[i + 2] + 35) red += 1;
  }
  return {
    opaque,
    whiteShare: opaque ? white / opaque : 1,
    redShare: opaque ? red / opaque : 0,
  };
}

async function cornerLuma(buf) {
  const img = await loadImage(buf);
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height).data;
  const pad = Math.max(2, Math.floor(Math.min(img.width, img.height) * 0.08));
  const spots = [
    [0, 0],
    [img.width - pad, 0],
    [0, img.height - pad],
    [img.width - pad, img.height - pad],
  ];
  let n = 0;
  let luma = 0;
  for (const [sx, sy] of spots) {
    for (let y = sy; y < sy + pad; y += 1) {
      for (let x = sx; x < sx + pad; x += 1) {
        const i = (y * img.width + x) * 4;
        n += 1;
        luma += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      }
    }
  }
  return n ? luma / n / 255 : 1;
}

async function liveAudit() {
  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/__live-harness`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__live);
  const kinds = await page.evaluate(() => window.__live.kinds);
  for (const row of kinds) {
    if (!row.has) fail(`harness missing live node for ${row.id} (${row.kind})`);
    else ok(`harness ${row.id} ${row.kind}`);
  }

  const torchClass = await page.evaluate(() =>
    document.querySelector('[data-item-id="burning_torch"] .bpb-live__glow')?.className || '',
  );
  if (!torchClass.includes('bpb-live__glow--light')) fail('torch glow is not a light-plate halo');
  else ok('torch glow uses light-plate halo');
  const glowCss = await page.evaluate(() => {
    const g = document.querySelector('[data-item-id="hungry_blade"] .bpb-live__glow');
    if (!g) return null;
    const s = getComputedStyle(g);
    return { blend: s.mixBlendMode, op: Number.parseFloat(s.opacity) };
  });
  if (!glowCss || glowCss.blend !== 'plus-lighter') fail(`hungry_blade blend ${glowCss?.blend}`);
  else ok('hungry_blade plus-lighter');
  if (!glowCss || glowCss.op > 0.55) fail(`hungry_blade opacity too hot ${glowCss?.op}`);
  else ok(`hungry_blade opacity ${glowCss.op.toFixed(2)}`);

  const glowCrop = await page.evaluate(() => {
    const ids = ['hungry_blade', 'magic_staff', 'bloodthorne'];
    return ids.map((id) => {
      const wrap = document.querySelector(`[data-item-id="${id}"] .bpb-live`);
      if (!wrap) return { id, error: 'missing' };
      const s = getComputedStyle(wrap);
      const mask = s.webkitMaskImage || s.maskImage || '';
      const base = wrap.querySelector('img.bpb-live__base');
      return {
        id,
        mask,
        hasBase: Boolean(base),
        baseNatural: base instanceof HTMLImageElement ? base.naturalWidth : 0,
        masked: Boolean(mask && mask !== 'none'),
      };
    });
  });
  for (const row of glowCrop) {
    if (row.error) fail(`${row.id} live wrap missing`);
    else if (!row.hasBase || row.baseNatural < 8) fail(`${row.id} base sprite missing`);
    else if (row.masked) fail(`${row.id} glow wrap still masked (${row.mask})`);
    else ok(`${row.id} unmasked base visible`);
  }

  await page.waitForFunction(() => {
    const c = document.querySelector('[data-item-id="health_potion"] canvas.bpb-live__liquid');
    if (!(c instanceof HTMLCanvasElement) || !c.width) return false;
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    const d = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height * 0.6), 1, 1).data;
    return d[3] > 20;
  }, null, { timeout: 8000 }).catch(() => {});

  const shotDir = path.join(ROOT, 'scripts', '_cache', 'live-art-audit');
  fs.mkdirSync(shotDir, { recursive: true });
  const potionBuf = await page.locator('[data-item-id="health_potion"] .bpb-live').screenshot({
    omitBackground: true,
  });
  fs.writeFileSync(path.join(shotDir, 'health_potion.png'), potionBuf);
  const potionPx = await sampleWhite(potionBuf);
  if (potionPx.whiteShare > 0.32) fail(`health_potion white cover ${potionPx.whiteShare.toFixed(2)}`);
  else ok(`health_potion white share ${potionPx.whiteShare.toFixed(2)}`);
  if (potionPx.redShare < 0.04) fail(`health_potion missing liquid red ${potionPx.redShare.toFixed(2)}`);
  else ok(`health_potion liquid red ${potionPx.redShare.toFixed(2)}`);
  const potionCorners = await cornerLuma(potionBuf);
  if (potionCorners > 0.28) fail(`health_potion canvas box in corners luma ${potionCorners.toFixed(2)}`);
  else ok(`health_potion corner luma ${potionCorners.toFixed(2)}`);

  const torchBuf = await page.locator('[data-item-id="burning_torch"] .bpb-live').screenshot({
    omitBackground: true,
  });
  fs.writeFileSync(path.join(shotDir, 'burning_torch.png'), torchBuf);
  const torchPx = await sampleWhite(torchBuf);
  if (torchPx.whiteShare > 0.4) fail(`burning_torch white cover ${torchPx.whiteShare.toFixed(2)}`);
  else ok(`burning_torch white share ${torchPx.whiteShare.toFixed(2)}`);

  const loversBuf = await page.locator('[data-item-id="the_lovers"] .bpb-live').screenshot({
    omitBackground: true,
  });
  fs.writeFileSync(path.join(shotDir, 'the_lovers.png'), loversBuf);
  const loversPx = await sampleWhite(loversBuf);
  if (loversPx.whiteShare > 0.38) fail(`the_lovers holo white cover ${loversPx.whiteShare.toFixed(2)}`);
  else ok(`the_lovers holo white share ${loversPx.whiteShare.toFixed(2)}`);

  await page.evaluate(() => window.__live.drain());
  const empty = await page.evaluate(() => window.__live.emptyAttr());
  if (!empty) fail('potion drain did not set data-potion-empty');
  else ok('potion drain sets data-potion-empty');

  await page.goto(`http://127.0.0.1:${PORT}/items/index.html`, { waitUntil: 'domcontentloaded' });
  const cssOk = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="stylesheet"]')].some((l) =>
      (l.href || '').includes('backpack-grid.css'),
    ),
  );
  if (!cssOk) fail('Itemiary missing live-art CSS');
  else ok('Itemiary loads live-art CSS via backpack-grid');

  await page.waitForSelector('.bpb-live', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  const visibleIds = await page.evaluate(() =>
    [...document.querySelectorAll('.bpb-live')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 8 && r.height > 8 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth;
      })
      .slice(0, 6)
      .map((el) => el.getAttribute('data-item-id'))
      .filter(Boolean),
  );
  ok(`Itemiary visible live ${visibleIds.length}/${await page.locator('.bpb-live').count()}`);
  for (const id of visibleIds) {
    const el = page.locator(`.bpb-live[data-item-id="${id}"]`).first();
    const buf = await el.screenshot({ omitBackground: true, timeout: 5000 });
    fs.writeFileSync(path.join(shotDir, `itemiary-${id}.png`), buf);
    const px = await sampleWhite(buf);
    if (px.whiteShare > 0.38) fail(`Itemiary ${id} white cover ${px.whiteShare.toFixed(2)}`);
    else ok(`Itemiary ${id} white share ${px.whiteShare.toFixed(2)}`);
  }

  if (errors.length) fail(`page errors ${errors.join(' | ')}`);
  await browser.close();
  await new Promise((r) => server.close(r));
}

staticAudit();
await liveAudit();
if (process.exitCode) {
  console.error('live-art audit failed');
  process.exit(1);
}
console.log('live-art audit passed');
