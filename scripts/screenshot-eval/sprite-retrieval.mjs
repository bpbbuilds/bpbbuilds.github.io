/**
 * P3 — Sprite/reference retrieval feasibility (eval-only).
 *
 * For each truth item (plus skills and loose jewels) on the fixed 8-shot benchmark,
 * extract the native screenshot region around its known footprint and rank ALL
 * catalog sprites by masked NCC (gray + edge channels). Never calls the importer,
 * placer, or solver; benchmark truth untouched.
 *
 *   node scripts/screenshot-eval/sprite-retrieval.mjs
 *
 * Writes scripts/_cache/screenshot-eval/baselines/2026-10-01-p3-retrieval/
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const outDir = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p3-retrieval');
fs.mkdirSync(outDir, { recursive: true });

const fixtures = ['real-001', 'real-003', 'real-007', 'real-008', 'real-010', 'real-013', 'leather-quad', 'pine-protector'];

const CELL_PX = 48;    // matching resolution, px per board cell
const JITTER = 4;      // +-px search around the footprint center
const STRIDE = 2;

// ---------- catalog ----------

const classes = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/_cache/synth-detector-v5/classes.json'), 'utf8')).classes || [];
const shapes = JSON.parse(fs.readFileSync(path.join(repo, 'assets/data/item-shapes.json'), 'utf8')).byImage || {};
const display = JSON.parse(fs.readFileSync(path.join(repo, 'assets/data/sprite-display.json'), 'utf8')).byImage || {};

const norm = (s) => String(s).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
const byNorm = new Map(classes.map((c) => [norm(c.name), c]));

const ARMS = {
  game: (image) => `/scripts/_cache/sprites-unzip/Items/${encodeURIComponent(image)}.png`,
  thumbs: (image) => `/assets/item-thumbs/2x/${encodeURIComponent(image)}.webp`,
  site: (image) => `/assets/item-sprites/${encodeURIComponent(image)}.png`,
};

/** Rotated footprint points for a class. */
function bodyCells(cls, r) {
  const m = shapes[`${cls.image}.png`] || [[1]];
  let pts = [];
  for (let y = 0; y < m.length; y++) for (let x = 0; x < (m[y] || []).length; x++) if (Number(m[y][x]) === 1) pts.push({ x, y });
  if (!pts.length) pts = [{ x: 0, y: 0 }];
  for (let i = 0; i < ((Number(r) || 0) + 4) % 4; i++) pts = pts.map((p) => ({ x: -p.y, y: p.x }));
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  return pts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
}
function boundsOf(pts) {
  return { x0: Math.min(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), x1: Math.max(...pts.map((p) => p.x)), y1: Math.max(...pts.map((p) => p.y)) };
}
const isOblong = (cls) => { const b = boundsOf(bodyCells(cls, 0)); return b.x1 - b.x0 !== b.y1 - b.y0; };

// ---------- server ----------

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
function serve() {
  const s = http.createServer((req, res) => {
    const u = new URL(req.url || '/', 'http://x');
    let file = path.join(repo, decodeURIComponent(u.pathname));
    if (!file.startsWith(repo)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => s.listen(0, '127.0.0.1', () => resolve(s)));
}

// ---------- page-side helpers ----------

/** Preload all sprite images for every arm; cache on window. */
async function preloadSprites(page, port) {
  const payload = Object.fromEntries(Object.entries(ARMS).map(([arm, url]) => [
    arm,
    classes.map((c) => ({ id: c.id, url: `http://127.0.0.1:${port}${url(c.image)}` })),
  ]));
  return page.evaluate(async (payload) => {
    window.__p3 = { sprites: {}, hay: new Map() };
    for (const [arm, list] of Object.entries(payload)) {
      const map = new Map();
      const missing = [];
      await Promise.all(list.map(({ id, url }) => new Promise((resolve) => {
        const i = new Image();
        i.onload = () => { map.set(id, i); resolve(); };
        i.onerror = () => { missing.push(id); resolve(); };
        i.src = url;
      })));
      window.__p3.sprites[arm] = map;
    }
    return Object.fromEntries(Object.entries(window.__p3.sprites).map(([a, m]) => [a, m.size]));
  }, payload);
}

/**
 * Per fixture: load screenshot, run importer's preprocess for the grid, cache gray.
 * Returns grid or null.
 */
async function loadFixture(page, dataUrl) {
  return page.evaluate(async (src) => {
    const { preprocessScreenshotForVision } = await import('/js/pages/create/screenshot-preprocess.js?v=p3');
    const pre = await preprocessScreenshotForVision(src);
    if (!pre.grid?.ok) return { gridOk: false, grid: null };
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = pre.dataUrl; });
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, W, H).data;
    const gray = new Float32Array(W * H), alpha = new Uint8Array(W * H);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) { alpha[p] = d[i + 3]; gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; }
    window.__p3.hay.set(src, { W, H, gray, alpha });
    // The returned dataUrl is cropped at NATIVE resolution (cropDataUrl rescales the
    // scaled-space rect by fullW/grayW), but grid.cellW is in the <=900px detect space.
    // Recompute cell size in cropped-buffer pixels: crop width covers bagRect.w scaled px.
    const rectW = Number(pre.grid.bagRect?.w) || pre.grid.cellW * pre.grid.cols;
    const rectH = Number(pre.grid.bagRect?.h) || pre.grid.cellH * pre.grid.rows;
    const cellW = (rectW > 0 ? (W * pre.grid.cellW) / rectW : pre.grid.cellW);
    const cellH = (rectH > 0 ? (H * pre.grid.cellH) / rectH : pre.grid.cellH);
    // Cell (0,0) starts at (0,0) in this cropped buffer — grid origin applies to the
    // ORIGINAL image and must be dropped.
    const grid = { ...pre.grid, originX: 0, originY: 0, cellW, cellH };
    return { gridOk: true, grid, W, H };
  }, dataUrl);
}

/** Match one instance against every preloaded sprite in one arm. */
async function retrieveInstance(page, o) {
  return page.evaluate(async (o) => {
    const { bestNcc, prepareTemplateBrowser, knownScales } = await import(`/js/shared/screenshot-ncc.js?v=p3`);

    const hay0 = window.__p3.hay.get(o.dataUrl);
    if (!hay0) return { error: 'no hay' };
    const { W, H, gray, alpha } = hay0;
    const g = o.grid;

    // Region: footprint +-1.5 cells.
    const pad = Math.round(g.cellW * 1.5);
    const rx0 = Math.max(0, Math.floor(g.originX + o.b.x0 * g.cellW - pad));
    const ry0 = Math.max(0, Math.floor(g.originY + o.b.y0 * g.cellH - pad));
    const rx1 = Math.min(W, Math.ceil(g.originX + (o.b.x1 + 1) * g.cellW + pad));
    const ry1 = Math.min(H, Math.ceil(g.originY + (o.b.y1 + 1) * g.cellH + pad));
    const rw = Math.max(8, rx1 - rx0), rh = Math.max(8, ry1 - ry0);

    // Downsample region to CELL_PX per cell; build gray + Sobel-edge buffers.
    const f = g.cellW / o.cellPx;
    const sw = Math.max(8, Math.floor(rw / f)), sh = Math.max(8, Math.floor(rh / f));
    const sGray = new Float32Array(sw * sh), sAlpha = new Uint8Array(sw * sh);
    for (let y = 0; y < sh; y++) {
      const sy0 = Math.floor(y * f), sy1 = Math.min(rh, Math.max(sy0 + 1, Math.floor((y + 1) * f)));
      for (let x = 0; x < sw; x++) {
        const sx0 = Math.floor(x * f), sx1 = Math.min(rw, Math.max(sx0 + 1, Math.floor((x + 1) * f)));
        let gv = 0, av = 0, n = 0;
        for (let sy = sy0; sy < sy1; sy++) { const row = (ry0 + sy) * W + rx0; for (let sx = sx0; sx < sx1; sx++) { gv += gray[row + sx]; av += alpha[row + sx]; n++; } }
        sGray[y * sw + x] = n ? gv / n : 0; sAlpha[y * sw + x] = n ? Math.round(av / n) : 0;
      }
    }
    const sobel = (buf, w, h) => {
      const out = new Float32Array(w * h);
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = -buf[i - w - 1] - 2 * buf[i - 1] - buf[i + w - 1] + buf[i - w + 1] + 2 * buf[i + 1] + buf[i + w + 1];
        const gy = -buf[i - w - 1] - 2 * buf[i - w] - buf[i + w - 1] + buf[i + w + 1] + 2 * buf[i + w] + buf[i + w + 1];
        out[i] = Math.hypot(gx, gy);
      }
      return out;
    };
    const sEdge = sobel(sGray, sw, sh);
    const hayGray = { w: sw, h: sh, gray: sGray, alpha: sAlpha };
    const hayEdge = { w: sw, h: sh, gray: sEdge, alpha: sAlpha };

    // Expected needle center in small coordinates.
    const cxr = (g.originX + (o.b.x0 + o.b.x1 + 1) / 2 * g.cellW - rx0) / f;
    const cyr = (g.originY + (o.b.y0 + o.b.y1 + 1) / 2 * g.cellH - ry0) / f;

    const results = [];
    const sprites = window.__p3.sprites[o.arm];
    for (const [id, img] of sprites) {
      const cand = o.byHeldId[id] || o.byId[id];
      if (!cand) continue;
      const nativeW = img.naturalWidth || img.width;
      const dispW = Number(cand.displayW) || 1;
      const scale = knownScales(o.cellPx, dispW, nativeW)[2] || 1;
      const faces = cand.oblong ? [0, 1, 2, 3] : [0];
      // Anchor offset (game art can sit off-center inside its footprint). item-pieces.js
      // places the sprite at footprint-center + (anchorX,anchorY) cells, world-space
      // (face-independent, like the shadow offset).
      const ax = Number(cand.anchorX) || 0;
      const ay = Number(cand.anchorY) || 0;
      const ecx = cxr + ax * o.cellPx;
      const ecy = cyr + ay * o.cellPx;
      let best = null;
      for (const r of faces) {
        const needle = prepareTemplateBrowser(img, r * 90, scale);
        if (needle.w < 8 || needle.h < 8 || needle.w >= sw || needle.h >= sh) continue;
        const nEdge = { w: needle.w, h: needle.h, gray: sobel(needle.gray, needle.w, needle.h), alpha: needle.alpha };
        const bx0 = Math.max(0, Math.floor(ecx - needle.w / 2) - o.jitter);
        const by0 = Math.max(0, Math.floor(ecy - needle.h / 2) - o.jitter);
        const bx1 = Math.min(sw - needle.w, Math.floor(ecx - needle.w / 2) + o.jitter);
        const by1 = Math.min(sh - needle.h, Math.floor(ecy - needle.h / 2) + o.jitter);
        const bounds = { x0: bx0, y0: by0, x1: Math.max(bx0, bx1), y1: Math.max(by0, by1) };
        const gHit = bestNcc(hayGray, needle, o.stride, bounds);
        const eHit = bestNcc(hayEdge, nEdge, o.stride, bounds);
        const score = 0.5 * gHit.score + 0.5 * eHit.score;
        if (!best || score > best.score) best = { r, score, gray: gHit.score, edge: eHit.score };
      }
      if (best) results.push({ id, name: cand.name, image: cand.image, r: best.r, score: best.score, gray: best.gray, edge: best.edge });
    }
    results.sort((a, b) => b.score - a.score);
    return { results, cxr, cyr };
  }, o);
}

// ---------- main ----------

const server = await serve();
const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[page error]', e.message));
await page.goto(`http://127.0.0.1:${port}/dev/screenshot-import/`);
await page.waitForFunction(() => window.__stbReady === true, null, { timeout: 60000 }).catch(() => {});

// Candidate descriptors (name/image/display/shape) shipped once per call.
const candMeta = classes.map((c) => ({
  id: c.id, name: c.name, image: c.image, type: c.type || '',
  displayW: Number((display[`${c.image}.png`] || {}).w) || 1,
  anchorX: Number((display[`${c.image}.png`] || {}).anchorX) || 0,
  anchorY: Number((display[`${c.image}.png`] || {}).anchorY) || 0,
  oblong: isOblong(c),
  w: boundsOf(bodyCells(c, 0)).x1 + 1, h: boundsOf(bodyCells(c, 0)).y1 + 1,
}));
const byId = Object.fromEntries(candMeta.map((c) => [c.id, c]));

await preloadSprites(page, port);

/** @type {any[]} */
const allRows = [];
/** @type {any[]} */
const perFixture = [];

for (const name of fixtures) {
  const fixtureDir = fs.existsSync(path.join(repo, 'fixtures', `${name}.png`)) ? path.join(repo, 'fixtures') : path.join(repo, 'scripts/screenshot-eval/fixtures');
  const truth = JSON.parse(fs.readFileSync(path.join(fixtureDir, `${name}.truth.json`), 'utf8'));
  const dataUrl = `data:image/png;base64,${fs.readFileSync(path.join(fixtureDir, `${name}.png`)).toString('base64')}`;

  const load = await loadFixture(page, dataUrl);
  if (!load.gridOk) { perFixture.push({ fixture: name, gridOk: false }); console.log(`${name}: GRID FAIL`); continue; }
  const grid = load.grid;
  console.log(`\n== ${name} grid=${grid.cols}x${grid.rows} cell=${grid.cellW.toFixed(1)}`);

  const instances = [];
  for (const t of truth.items || []) instances.push({ t, kind: 'item' });
  for (const t of truth.skills || []) instances.push({ t, kind: 'skill' });
  for (const t of truth.jewels || []) instances.push({ t, kind: 'jewel' });

  const rows = [];
  for (const { t, kind } of instances) {
    const cls = byNorm.get(norm(t.name));
    if (!cls) { rows.push({ fixture: name, kind, name: t.name, x: t.x, y: t.y, r: t.r, missing: 'no-class' }); continue; }
    const r0 = t.r == null ? 0 : t.r;
    // Footprint bounds offset by the item's board cell — the window must track position.
    const fb = boundsOf(bodyCells(cls, r0));
    const b = { x0: fb.x0 + t.x, y0: fb.y0 + t.y, x1: fb.x1 + t.x, y1: fb.y1 + t.y };
    const oblong = isOblong(cls);
    const row = { fixture: name, kind, name: t.name, x: t.x, y: t.y, r: t.r, truthId: cls.id, oblong, b };
    for (const arm of Object.keys(ARMS)) {
      const res = await retrieveInstance(page, {
        dataUrl, grid, b, arm,
        cellPx: CELL_PX, jitter: JITTER, stride: STRIDE,
        byId, byHeldId: {},
      });
      if (res.error) { row[arm] = { error: res.error }; continue; }
      const rank = res.results.findIndex((q) => q.id === cls.id) + 1;
      row[arm] = {
        n: res.results.length,
        rank,
        top5: res.results.slice(0, 5).map((q) => ({ id: q.id, name: q.name, r: q.r, score: Math.round(q.score * 1000) / 1000 })),
        truthScore: rank ? Math.round(res.results[rank - 1].score * 1000) / 1000 : null,
        truthFace: rank ? res.results[rank - 1].r : null,
      };
    }
    rows.push(row);
    const a = row.game || row.thumbs || row.site || {};
    console.log(`  [${kind}] ${t.name} r=${t.r ?? '?'} game#=${row.game?.rank ?? '-'}/${row.game?.n ?? '-'} thumbs#=${row.thumbs?.rank ?? '-'}/${row.thumbs?.n ?? '-'} site#=${row.site?.rank ?? '-'}/${row.site?.n ?? '-'} top=${a.top5?.[0]?.name ?? '-'}`);
  }
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify({ fixture: name, rows }, null, 2));
  allRows.push(...rows);
  perFixture.push({ fixture: name, gridOk: true, grid: `${grid.cols}x${grid.rows}`, cell: Math.round(grid.cellW * 10) / 10, instances: rows.length });
}

await browser.close();
server.close();

// ---------- metrics ----------

function armMetrics(arm, filter) {
  const sel = allRows.filter((r) => !r.missing && r[arm] && !r[arm].error && r[arm].n > 0).filter(filter || (() => true));
  const withSprite = sel.filter((r) => r[arm].rank > 0);
  const noSprite = sel.length - withSprite.length;
  const rank = (r) => r[arm].rank;
  const met = (list) => ({
    n: list.length,
    top1: list.filter((r) => rank(r) === 1).length,
    top3: list.filter((r) => rank(r) <= 3).length,
    top5: list.filter((r) => rank(r) <= 5).length,
    top10: list.filter((r) => rank(r) <= 10).length,
    top20: list.filter((r) => rank(r) <= 20).length,
    meanRank: list.length ? Math.round((list.reduce((a, r) => a + rank(r), 0) / list.length) * 10) / 10 : null,
  });
  return { ...met(withSprite), truthSpriteMissingInArm: noSprite, byKind: Object.fromEntries(['item', 'skill', 'jewel'].map((k) => [k, met(withSprite.filter((r) => r.kind === k))])) };
}

function rotationMetrics(arm) {
  const sel = allRows.filter((r) => !r.missing && r[arm]?.rank > 0 && r.r != null && r.oblong);
  const top1CorrectFace = sel.filter((r) => r[arm].truthFace === r.r);
  // Top-1 identity with any correct face in its top-5 entries isn't stored; use truthFace of the ranked truth entry.
  return { n: sel.length, truthEntryFaceCorrect: top1CorrectFace.length, note: 'face = best-scoring rotation of the truth class itself, judged only on oblong items with known r' };
}

const report = {
  date: '2026-10-01',
  experiment: 'P3 sprite/reference retrieval feasibility',
  method: `native screenshot region per truth footprint (+-1.5 cells), downsampled to ${CELL_PX}px/cell; every catalog sprite ranked by masked NCC on gray + Sobel-edge channels (0.5/0.5), all 518 classes, oblong candidates searched over 4 faces, window = footprint center ±${JITTER}px stride ${STRIDE}; three sprite arms compared (game extract PNGs, site thumbs webp, site item-sprites). No importer/placer/solver involved; truth untouched.`,
  fixtures,
  perFixture,
  game: armMetrics('game'),
  thumbs: armMetrics('thumbs'),
  site: armMetrics('site'),
  rotation: { game: rotationMetrics('game'), thumbs: rotationMetrics('thumbs'), site: rotationMetrics('site') },
  exitCriterion: 'correct identities regularly appear in a small top-K list; if not, do not expand sprite matching into a full catalog scan',
};
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, 'all-rows.json'), JSON.stringify(allRows, null, 2));

console.log('\n===== P3 RETRIEVAL TOTALS =====');
console.log(JSON.stringify({ game: report.game, thumbs: report.thumbs, site: report.site, rotation: report.rotation }, null, 2));
