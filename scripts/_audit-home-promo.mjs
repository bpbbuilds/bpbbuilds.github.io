/**
 * Homepage create-promo: catalog is one copy, board is promo (no hover chrome),
 * fly ghosts animate transform only.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8793;
const SHOT = path.join(ROOT, 'scripts/_fixtures/home-promo.png');

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

const errors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.home-promo--create', { timeout: 15000 });

const skel = await page.evaluate(() => {
  const tiles = [...document.querySelectorAll('.home-promo__skel-item')];
  const first = tiles[0];
  const cs = first ? getComputedStyle(first) : null;
  const board = document.querySelector('.home-promo__skel-board');
  const boardBg = board ? getComputedStyle(board).backgroundImage : '';
  return {
    catalogTiles: tiles.length,
    firstPacked: first?.style.getPropertyValue('--w') === '2' && first?.style.getPropertyValue('--h') === '2',
    firstAbs: cs?.position === 'absolute',
    boardPouch: Boolean(board && boardBg.includes('FilledSlot')),
    captionMeta: Boolean(document.querySelector('.home-promo__caption .home-promo__caption-meta.home-promo__info-shade')),
    goldLabel: document.querySelector('.home-promo__info-label')?.textContent?.trim() || '',
    rankLabel:
      [...document.querySelectorAll('.home-promo__info-label')].map((el) => el.textContent?.trim())[1] || '',
  };
});
const skelShot = path.join(ROOT, 'scripts/_fixtures/home-promo-skel.png');
const promoEl = page.locator('.home-promo--create');
if (await promoEl.count()) await promoEl.screenshot({ path: skelShot });

await page.waitForSelector('.home-promo__catalog .bpb-bg--promo', { timeout: 25000 });
await page.waitForTimeout(1800);

const info = await page.evaluate(() => {
  const catalog = document.querySelector('[data-promo-catalog-root]');
  const track = catalog?.querySelector('.home-promo__catalog-track');
  const grids = track ? track.querySelectorAll(':scope > .bpb-bg') : [];
  const items = [...(catalog?.querySelectorAll('.bpb-bg__item') || [])];
  const markers = catalog?.querySelectorAll('.bpb-bg__markers') || [];
  const board = document.querySelector('[data-promo-empty-board] .bpb-bg');
  const fly = document.querySelector('.home-promo__fly');
  const flyCs = fly ? getComputedStyle(fly) : null;
  const pending = items.filter((i) =>
    i.classList.contains('bpb-bg__item--sprite-pending'),
  );
  const clipRect =
    catalog instanceof HTMLElement ? catalog.getBoundingClientRect() : null;
  const inClip = items.filter((i) => {
    if (!(i instanceof HTMLElement) || i.classList.contains('bpb-bg__item--parked')) {
      return false;
    }
    if (!clipRect) return false;
    const r = i.getBoundingClientRect();
    return r.bottom > clipRect.top + 2 && r.top < clipRect.bottom - 2;
  });
  const clipPending = inClip.filter((i) =>
    i.classList.contains('bpb-bg__item--sprite-pending'),
  );
  const pendingHidden = clipPending.filter(
    (i) => getComputedStyle(i).visibility === 'hidden',
  ).length;
  const clipWithSrc = inClip.filter((i) =>
    i.querySelector('img.bpb-bg__sprite[src], img.bpb-live__layer[src]'),
  ).length;
  const parked = items.filter((i) => i.classList.contains('bpb-bg__item--parked'));
  const zeroRect = items.filter((i) => {
    if (i.classList.contains('bpb-bg__item--parked')) return false;
    if (i.classList.contains('home-promo__item--depart')) return false;
    if (i.classList.contains('home-promo__item--appear')) return false;
    const r = i.getBoundingClientRect();
    return r.width < 2 || r.height < 2;
  });
  let deepest = null;
  let maxTop = -1;
  for (const i of items) {
    if (i.classList.contains('bpb-bg__item--parked')) continue;
    const top = parseFloat(i.style.top) || 0;
    if (top > maxTop) {
      maxTop = top;
      deepest = i;
    }
  }
  let seek = null;
  if (
    catalog instanceof HTMLElement &&
    track instanceof HTMLElement &&
    deepest instanceof HTMLElement
  ) {
    const clip = catalog.getBoundingClientRect();
    const grid = deepest.closest('.bpb-bg');
    const cellPx =
      parseFloat(getComputedStyle(grid).getPropertyValue('--bpb-bg-cell')) || 22;
    const hEm = parseFloat(deepest.style.height) || 1;
    const mid = (maxTop + hEm / 2) * cellPx;
    const copyH = track.firstElementChild?.offsetHeight || 0;
    const minY = Math.min(0, clip.height - copyH);
    const targetY = Math.max(minY, Math.min(0, clip.height * 0.38 - mid));
    track.style.transition = 'none';
    track.style.transform = `translateY(${targetY}px)`;
    const r = deepest.getBoundingClientRect();
    seek = {
      deepestId: deepest.dataset.itemId || '',
      deepestTopEm: maxTop,
      targetY,
      inClip: r.bottom > clip.top + 2 && r.top < clip.bottom - 2,
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  }
  return {
    catalogGrids: grids.length,
    catalogItems: items.length,
    catalogPending: pending.length,
    catalogParked: parked.length,
    catalogClip: inClip.length,
    catalogClipSrc: clipWithSrc,
    catalogPendingHidden: pendingHidden,
    catalogZeroRect: zeroRect.length,
    catalogMarkers: markers.length,
    catalogPromo: catalog?.querySelector('.bpb-bg')?.classList.contains('bpb-bg--promo') || false,
    boardPromo: board?.classList.contains('bpb-bg--promo') || false,
    flyTransition: flyCs?.transitionProperty || '',
    flyWillChange: flyCs?.willChange || '',
    seek,
  };
});

const board = page.locator('[data-promo-empty-board]');
if (await board.count()) {
  await board.hover({ force: true });
  await page.waitForTimeout(400);
}
const hover = await page.evaluate(() => ({
  sparks: document.querySelectorAll('.home-promo .bpb-bg__sparks').length,
  lit: document.querySelectorAll('.home-promo .bpb-bg__cell--rarity.is-lit').length,
}));

fs.mkdirSync(path.dirname(SHOT), { recursive: true });
const promo = page.locator('.home-promo--create');
if (await promo.count()) await promo.screenshot({ path: SHOT });

await browser.close();
server.close();

const fail = [];
if (skel.catalogTiles < 16) fail.push(`catalog skel tiles ${skel.catalogTiles} (want packed stamp)`);
if (!skel.firstPacked) fail.push('catalog skel missing 2×2 packed lead tile');
if (!skel.firstAbs) fail.push('catalog skel tiles are not packed (absolute)');
if (!skel.boardPouch) fail.push('board skel missing FilledSlot pouch grid');
if (!skel.captionMeta) fail.push('caption skel missing Patch3 meta row');
if (skel.goldLabel !== 'Gold') fail.push(`info skel gold label ${JSON.stringify(skel.goldLabel)}`);
if (skel.rankLabel !== 'Rank') fail.push(`info skel rank label ${JSON.stringify(skel.rankLabel)}`);
if (info.catalogGrids !== 1) fail.push(`catalog grids ${info.catalogGrids} (want 1)`);
if (!info.catalogPromo) fail.push('catalog missing bpb-bg--promo');
if (!info.boardPromo) fail.push('board missing bpb-bg--promo');
if (info.catalogItems < 80) fail.push(`catalog items ${info.catalogItems} (want packed full library)`);
if (info.catalogPendingHidden > 0) {
  fail.push(`visible pending items are hidden (${info.catalogPendingHidden}) — catalog would look blank`);
}
if (info.catalogClip > 4 && info.catalogClipSrc < 1) {
  fail.push(`clip has ${info.catalogClip} items but none have sprite src`);
}
if (info.catalogZeroRect > 0) {
  fail.push(`catalog ${info.catalogZeroRect} packed items have 0-size boxes (seek cannot scroll to them)`);
}
if (info.seek && !info.seek.inClip) {
  fail.push(`deep catalog item ${info.seek.deepestId} not in clip after layout seek`);
}
if (info.catalogMarkers > 0) fail.push(`catalog still has ${info.catalogMarkers} hover marker trees`);
if (hover.sparks > 0) fail.push(`hover spawned ${hover.sparks} sparks`);
if (hover.lit > 0) fail.push(`hover lit ${hover.lit} rarity cells`);
if (errors.length) fail.push(`page errors: ${errors.join(' | ')}`);

console.log(JSON.stringify({ skel, info, hover, shot: SHOT, skelShot, fail }, null, 2));
if (fail.length) process.exit(1);
