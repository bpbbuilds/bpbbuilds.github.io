/**
 * P4 — Candidate-recall prototype (eval-only).
 *
 * For each labeled benchmark region, propose a candidate list from geometry
 * first (footprint, rotation, board bounds, bag support), then rank only the
 * catalog items whose shape matches that footprint. Visual and edge scores are
 * retained beside geometry. Detector is retained and left unrun. No solver,
 * no placer, no importer change, no truth edit.
 *
 *   node scripts/screenshot-eval/candidate-recall.mjs
 *
 * Writes scripts/_cache/screenshot-eval/baselines/2026-10-01-p4-candidates/
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const outDir = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p4-candidates');
fs.mkdirSync(outDir, { recursive: true });

const fixtures = ['real-001', 'real-003', 'real-007', 'real-008', 'real-010', 'real-013', 'leather-quad', 'pine-protector'];
const BRIGHT = new Set(['real-001', 'real-010', 'pine-protector']);

const CELL_PX = 48;
const JITTER = 4;
const STRIDE = 2;

const classes = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/_cache/synth-detector-v5/classes.json'), 'utf8')).classes || [];
const shapes = JSON.parse(fs.readFileSync(path.join(repo, 'assets/data/item-shapes.json'), 'utf8')).byImage || {};
const display = JSON.parse(fs.readFileSync(path.join(repo, 'assets/data/sprite-display.json'), 'utf8')).byImage || {};

const norm = (s) => String(s).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
const byNorm = new Map(classes.map((c) => [norm(c.name), c]));

function bodyCells(cls, r) {
  const m = shapes[`${cls.image}.png`] || [[1]];
  let pts = [];
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < (m[y] || []).length; x++) if (Number(m[y][x]) === 1) pts.push({ x, y });
  }
  if (!pts.length) pts = [{ x: 0, y: 0 }];
  for (let i = 0; i < ((Number(r) || 0) + 4) % 4; i++) pts = pts.map((p) => ({ x: -p.y, y: p.x }));
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  return pts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
}

function shapeKey(pts) {
  return pts.map((p) => `${p.x},${p.y}`).sort().join('|');
}

const candMeta = classes.map((c) => {
  const disp = display[`${c.image}.png`] || {};
  return {
    id: c.id,
    name: c.name,
    image: c.image,
    type: c.type || '',
    displayW: Number(disp.w) || 1,
    anchorX: Number(disp.anchorX) || 0,
    anchorY: Number(disp.anchorY) || 0,
  };
});
const byId = Object.fromEntries(candMeta.map((c) => [c.id, c]));

/** shape key -> unique {id, r} (first rotation that produces the key). */
const byShape = new Map();
for (const c of classes) {
  const seen = new Set();
  for (let r = 0; r < 4; r++) {
    const key = shapeKey(bodyCells(c, r));
    if (seen.has(key)) continue;
    seen.add(key);
    const list = byShape.get(key) || [];
    list.push({ id: c.id, r });
    byShape.set(key, list);
  }
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp' };
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

async function preloadThumbs(page, port) {
  const list = classes.map((c) => ({
    id: c.id,
    url: `http://127.0.0.1:${port}/assets/item-thumbs/2x/${encodeURIComponent(c.image)}.webp`,
  }));
  return page.evaluate(async (list) => {
    window.__p4 = { sprites: new Map(), hay: new Map() };
    const missing = [];
    await Promise.all(list.map(({ id, url }) => new Promise((resolve) => {
      const i = new Image();
      i.onload = () => { window.__p4.sprites.set(id, i); resolve(); };
      i.onerror = () => { missing.push(id); resolve(); };
      i.src = url;
    })));
    return { loaded: window.__p4.sprites.size, missing: missing.length };
  }, list);
}

async function loadFixture(page, dataUrl) {
  return page.evaluate(async (src) => {
    const { preprocessScreenshotForVision } = await import('/js/pages/create/screenshot-preprocess.js?v=p4');
    const pre = await preprocessScreenshotForVision(src);
    if (!pre.grid?.ok) return { gridOk: false, grid: null };
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = pre.dataUrl;
    });
    const W = img.naturalWidth || img.width;
    const H = img.naturalHeight || img.height;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, W, H).data;
    const gray = new Float32Array(W * H);
    const alpha = new Uint8Array(W * H);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      alpha[p] = d[i + 3];
      gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }
    window.__p4.hay.set(src, { W, H, gray, alpha });
    const rectW = Number(pre.grid.bagRect?.w) || pre.grid.cellW * pre.grid.cols;
    const rectH = Number(pre.grid.bagRect?.h) || pre.grid.cellH * pre.grid.rows;
    const cellW = rectW > 0 ? (W * pre.grid.cellW) / rectW : pre.grid.cellW;
    const cellH = rectH > 0 ? (H * pre.grid.cellH) / rectH : pre.grid.cellH;
    const grid = { ...pre.grid, originX: 0, originY: 0, cellW, cellH };
    return { gridOk: true, grid, W, H };
  }, dataUrl);
}

/**
 * Rank one region's shape-compatible pool. Occupancy is a retained mean, not a filter.
 * @param {import('playwright').Page} page
 * @param {object} o
 */
async function rankPool(page, o) {
  return page.evaluate(async (o) => {
    const { bestNcc, prepareTemplateBrowser, knownScales } = await import('/js/shared/screenshot-ncc.js?v=p4');
    const hay0 = window.__p4.hay.get(o.dataUrl);
    if (!hay0) return { error: 'no hay' };
    const { W, H, gray, alpha } = hay0;
    const g = o.grid;

    const cellScore = (x, y) => {
      const x0 = Math.max(0, Math.floor(g.originX + x * g.cellW));
      const y0 = Math.max(0, Math.floor(g.originY + y * g.cellH));
      const x1 = Math.min(W, Math.ceil(g.originX + (x + 1) * g.cellW));
      const y1 = Math.min(H, Math.ceil(g.originY + (y + 1) * g.cellH));
      const vals = [];
      const edge = [];
      const mx = Math.max(1, Math.floor((x1 - x0) * 0.2));
      const my = Math.max(1, Math.floor((y1 - y0) * 0.2));
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const v = gray[py * W + px];
          (px < x0 + mx || px >= x1 - mx || py < y0 + my || py >= y1 - my ? edge : vals).push(v);
        }
      }
      const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
      const m = mean(vals);
      const variance = mean(vals.map((v) => (v - m) ** 2));
      return Math.abs(m - mean(edge)) + Math.sqrt(variance);
    };
    const occ = o.cells.map((c) => cellScore(c.x, c.y));
    const occupancy = occ.length ? occ.reduce((s, v) => s + v, 0) / occ.length : 0;

    const pad = Math.round(g.cellW * 1.5);
    const rx0 = Math.max(0, Math.floor(g.originX + o.b.x0 * g.cellW - pad));
    const ry0 = Math.max(0, Math.floor(g.originY + o.b.y0 * g.cellH - pad));
    const rx1 = Math.min(W, Math.ceil(g.originX + (o.b.x1 + 1) * g.cellW + pad));
    const ry1 = Math.min(H, Math.ceil(g.originY + (o.b.y1 + 1) * g.cellH + pad));
    const rw = Math.max(8, rx1 - rx0);
    const rh = Math.max(8, ry1 - ry0);
    const f = g.cellW / o.cellPx;
    const sw = Math.max(8, Math.floor(rw / f));
    const sh = Math.max(8, Math.floor(rh / f));
    const sGray = new Float32Array(sw * sh);
    const sAlpha = new Uint8Array(sw * sh);
    for (let y = 0; y < sh; y++) {
      const sy0 = Math.floor(y * f);
      const sy1 = Math.min(rh, Math.max(sy0 + 1, Math.floor((y + 1) * f)));
      for (let x = 0; x < sw; x++) {
        const sx0 = Math.floor(x * f);
        const sx1 = Math.min(rw, Math.max(sx0 + 1, Math.floor((x + 1) * f)));
        let gv = 0;
        let av = 0;
        let n = 0;
        for (let sy = sy0; sy < sy1; sy++) {
          const row = (ry0 + sy) * W + rx0;
          for (let sx = sx0; sx < sx1; sx++) {
            gv += gray[row + sx];
            av += alpha[row + sx];
            n++;
          }
        }
        sGray[y * sw + x] = n ? gv / n : 0;
        sAlpha[y * sw + x] = n ? Math.round(av / n) : 0;
      }
    }
    const sobel = (buf, w, h) => {
      const out = new Float32Array(w * h);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          const gx = -buf[i - w - 1] - 2 * buf[i - 1] - buf[i + w - 1] + buf[i - w + 1] + 2 * buf[i + 1] + buf[i + w + 1];
          const gy = -buf[i - w - 1] - 2 * buf[i - w] - buf[i - w + 1] + buf[i + w - 1] + 2 * buf[i + w] + buf[i + w + 1];
          out[i] = Math.hypot(gx, gy);
        }
      }
      return out;
    };
    const hayGray = { w: sw, h: sh, gray: sGray, alpha: sAlpha };
    const hayEdge = { w: sw, h: sh, gray: sobel(sGray, sw, sh), alpha: sAlpha };
    const cxr = (g.originX + ((o.b.x0 + o.b.x1 + 1) / 2) * g.cellW - rx0) / f;
    const cyr = (g.originY + ((o.b.y0 + o.b.y1 + 1) / 2) * g.cellH - ry0) / f;

    const results = [];
    for (const face of o.pool) {
      const img = window.__p4.sprites.get(face.id);
      const cand = o.byId[face.id];
      if (!img || !cand) continue;
      const nativeW = img.naturalWidth || img.width;
      const scale = knownScales(o.cellPx, Number(cand.displayW) || 1, nativeW)[2] || 1;
      const ax = Number(cand.anchorX) || 0;
      const ay = Number(cand.anchorY) || 0;
      const ecx = cxr + ax * o.cellPx;
      const ecy = cyr + ay * o.cellPx;
      const needle = prepareTemplateBrowser(img, face.r * 90, scale);
      if (needle.w < 8 || needle.h < 8 || needle.w >= sw || needle.h >= sh) continue;
      const nEdge = { w: needle.w, h: needle.h, gray: sobel(needle.gray, needle.w, needle.h), alpha: needle.alpha };
      const bx0 = Math.max(0, Math.floor(ecx - needle.w / 2) - o.jitter);
      const by0 = Math.max(0, Math.floor(ecy - needle.h / 2) - o.jitter);
      const bx1 = Math.min(sw - needle.w, Math.floor(ecx - needle.w / 2) + o.jitter);
      const by1 = Math.min(sh - needle.h, Math.floor(ecy - needle.h / 2) + o.jitter);
      const bounds = { x0: bx0, y0: by0, x1: Math.max(bx0, bx1), y1: Math.max(by0, by1) };
      const gHit = bestNcc(hayGray, needle, o.stride, bounds);
      const eHit = bestNcc(hayEdge, nEdge, o.stride, bounds);
      results.push({
        id: face.id,
        name: cand.name,
        r: face.r,
        visual: gHit.score,
        edge: eHit.score,
        score: 0.5 * gHit.score + 0.5 * eHit.score,
      });
    }
    results.sort((a, b) => b.score - a.score);
    return { results, occupancy };
  }, o);
}

function legalOriginCount(rel, cols, rows, bagSet) {
  let n = 0;
  const maxX = Math.max(...rel.map((p) => p.x));
  const maxY = Math.max(...rel.map((p) => p.y));
  for (let y = 0; y <= rows - 1 - maxY; y++) {
    for (let x = 0; x <= cols - 1 - maxX; x++) {
      if (bagSet && !rel.every((p) => bagSet.has(`${x + p.x},${y + p.y}`))) continue;
      n++;
    }
  }
  return n;
}

const server = await serve();
const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[page error]', e.message));
await page.goto(`http://127.0.0.1:${port}/dev/screenshot-import/`);
await page.waitForFunction(() => window.__stbReady === true, null, { timeout: 60000 }).catch(() => {});
const preload = await preloadThumbs(page, port);
console.log('thumbs', preload);

/** @type {any[]} */
const allRows = [];

for (const name of fixtures) {
  const fixtureDir = fs.existsSync(path.join(repo, 'fixtures', `${name}.png`))
    ? path.join(repo, 'fixtures')
    : path.join(repo, 'scripts/screenshot-eval/fixtures');
  const truth = JSON.parse(fs.readFileSync(path.join(fixtureDir, `${name}.truth.json`), 'utf8'));
  const dataUrl = `data:image/png;base64,${fs.readFileSync(path.join(fixtureDir, `${name}.png`)).toString('base64')}`;
  const load = await loadFixture(page, dataUrl);
  if (!load.gridOk) {
    console.log(`${name}: GRID FAIL`);
    continue;
  }
  const grid = load.grid;
  const bagSet = Array.isArray(truth.bagCells) && truth.bagCells.length
    ? new Set(truth.bagCells.map(String))
    : null;
  console.log(`\n== ${name} grid=${grid.cols}x${grid.rows} bagCells=${bagSet ? bagSet.size : 'none'}`);

  const instances = [];
  for (const t of truth.items || []) instances.push({ t, kind: 'item' });
  for (const t of truth.skills || []) instances.push({ t, kind: 'skill' });
  for (const t of truth.jewels || []) instances.push({ t, kind: 'jewel' });

  const rows = [];
  for (const { t, kind } of instances) {
    const cls = byNorm.get(norm(t.name));
    if (!cls) {
      rows.push({ fixture: name, kind, name: t.name, x: t.x, y: t.y, r: t.r, missing: 'no-class' });
      continue;
    }
    const r0 = t.r == null ? 0 : Number(t.r) || 0;
    const rel = bodyCells(cls, r0);
    const key = shapeKey(rel);
    const cells = rel.map((p) => ({ x: t.x + p.x, y: t.y + p.y }));
    const inBounds = cells.every((c) => c.x >= 0 && c.y >= 0 && c.x < grid.cols && c.y < grid.rows);
    const bagSupported = bagSet ? cells.every((c) => bagSet.has(`${c.x},${c.y}`)) : null;
    const origins = legalOriginCount(rel, grid.cols, grid.rows, bagSet);
    const pool = (byShape.get(key) || []).filter((face) => byId[face.id]);
    const b = {
      x0: Math.min(...cells.map((c) => c.x)),
      y0: Math.min(...cells.map((c) => c.y)),
      x1: Math.max(...cells.map((c) => c.x)),
      y1: Math.max(...cells.map((c) => c.y)),
    };
    const row = {
      fixture: name,
      kind,
      name: t.name,
      x: t.x,
      y: t.y,
      r: t.r,
      truthId: cls.id,
      cells: cells.length,
      inBounds,
      bagSupported,
      legalOrigins: origins,
      pool: pool.length,
      bright: BRIGHT.has(name),
    };
    if (!inBounds || bagSupported === false) {
      row.skipped = !inBounds ? 'out-of-bounds' : 'bag-unsupported';
      row.rank = 0;
      rows.push(row);
      console.log(`  [${kind}] ${t.name} skipped ${row.skipped} pool=${pool.length} origins=${origins}`);
      continue;
    }
    const res = await rankPool(page, {
      dataUrl,
      grid,
      b,
      cells,
      pool,
      byId,
      cellPx: CELL_PX,
      jitter: JITTER,
      stride: STRIDE,
    });
    if (res.error) {
      row.error = res.error;
      rows.push(row);
      continue;
    }
    const rank = res.results.findIndex((q) => q.id === cls.id) + 1;
    const top = res.results.slice(0, 5).map((q) => ({
      id: q.id,
      name: q.name,
      r: q.r,
      visual: Math.round(q.visual * 1000) / 1000,
      edge: Math.round(q.edge * 1000) / 1000,
      geometry: 1,
      detector: null,
      source: 'catalog-shape',
      score: Math.round(q.score * 1000) / 1000,
    }));
    row.occupancy = Math.round(res.occupancy * 10) / 10;
    row.ranked = res.results.length;
    row.rank = rank;
    row.top5 = top;
    row.truth = rank
      ? {
          visual: Math.round(res.results[rank - 1].visual * 1000) / 1000,
          edge: Math.round(res.results[rank - 1].edge * 1000) / 1000,
          geometry: 1,
          detector: null,
          source: 'catalog-shape',
          occupancy: row.occupancy,
        }
      : null;
    rows.push(row);
    console.log(`  [${kind}] ${t.name} rank=${rank || '-'} / ${res.results.length} origins=${origins} top=${top[0]?.name ?? '-'}`);
  }
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify({ fixture: name, rows }, null, 2));
  allRows.push(...rows);
}

await browser.close();
server.close();

function metrics(list) {
  const scored = list.filter((r) => !r.missing && !r.error);
  const ranked = scored.filter((r) => r.ranked > 0);
  const nontrivial = ranked.filter((r) => r.ranked > 5);
  const hit = (rows, k) => rows.filter((r) => r.rank > 0 && r.rank <= k).length;
  const pack = (rows) => ({
    n: rows.length,
    top1: hit(rows, 1),
    top5: hit(rows, 5),
    meanPool: rows.length ? Math.round((rows.reduce((s, r) => s + r.ranked, 0) / rows.length) * 10) / 10 : null,
  });
  return {
    regions: scored.length,
    skippedBounds: scored.filter((r) => r.skipped === 'out-of-bounds').length,
    skippedBag: scored.filter((r) => r.skipped === 'bag-unsupported').length,
    ranked: pack(ranked),
    nontrivialPool: pack(nontrivial),
  };
}

const report = {
  date: '2026-10-01',
  experiment: 'P4 candidate-recall prototype',
  method: 'Each labeled region proposes candidates only when its catalog footprint stays inside the detected grid and, when the fixture lists bag cells, on those cells. Ranking uses site thumbs, masked NCC gray (visual) + Sobel edge, 0.5/0.5, one matching rotation, same-shape catalog items only. Occupancy is the mean center-vs-border cell score, retained and not used as a gate (P2 stays advisory). Detector field is retained and not run. No solver.',
  spriteArm: 'thumbs',
  preload,
  fixtures,
  bright: metrics(allRows.filter((r) => r.bright)),
  dimmed: metrics(allRows.filter((r) => !r.bright)),
  all: metrics(allRows),
  byKind: Object.fromEntries(['item', 'skill', 'jewel'].map((k) => [k, metrics(allRows.filter((r) => r.kind === k))])),
  exitCriterion: 'high candidate recall on recognizable benchmark regions; do not start a solver just because candidates exist',
};
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, 'all-rows.json'), JSON.stringify(allRows, null, 2));
console.log('\n===== P4 CANDIDATE RECALL =====');
console.log(JSON.stringify({ bright: report.bright, dimmed: report.dimmed, all: report.all, byKind: report.byKind }, null, 2));
