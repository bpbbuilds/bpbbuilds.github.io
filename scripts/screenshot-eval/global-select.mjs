/**
 * P5 — Global selection prototype (eval-only).
 *
 * Builds placements from shape-compatible sprite matches on the bag cells the
 * live v1 placer already detected. Keeps a non-overlapping set only when the
 * combined visual+edge score clears the P3 bright/dim gap. Uncovered bag cells
 * stay unresolved. Does not call the importer, placer, or a solver library.
 *
 *   node scripts/screenshot-eval/global-select.mjs
 *
 * Writes scripts/_cache/screenshot-eval/baselines/2026-10-01-p5-select/
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const v1Dir = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-09-30-v1');
const outDir = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p5-select');
fs.mkdirSync(outDir, { recursive: true });

const fixtures = ['real-001', 'real-003', 'real-007', 'real-008', 'real-010', 'real-013', 'leather-quad', 'pine-protector'];
/** Above P3 dimmed correct scores (0.10–0.40), below the bright correct band (0.72+). Not swept. */
const SCORE_FLOOR = 0.55;
const CELL_PX = 48;
const JITTER = 4;
const STRIDE = 2;

const classes = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/_cache/synth-detector-v5/classes.json'), 'utf8')).classes || [];
const shapes = JSON.parse(fs.readFileSync(path.join(repo, 'assets/data/item-shapes.json'), 'utf8')).byImage || {};
const display = JSON.parse(fs.readFileSync(path.join(repo, 'assets/data/sprite-display.json'), 'utf8')).byImage || {};

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

const faces = [];
for (const c of classes) {
  const disp = display[`${c.image}.png`] || {};
  const seen = new Set();
  for (let r = 0; r < 4; r++) {
    const cells = bodyCells(c, r);
    const key = shapeKey(cells);
    if (seen.has(key)) continue;
    seen.add(key);
    faces.push({
      id: c.id,
      name: c.name,
      r,
      cells,
      displayW: Number(disp.w) || 1,
      anchorX: Number(disp.anchorX) || 0,
      anchorY: Number(disp.anchorY) || 0,
    });
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

const rotOk = (p, t) => t.r == null || (p.r || 0) === t.r;
function matchRows(left, truthRows) {
  const norm = (s) => String(s).toLowerCase();
  const rows = [];
  const pending = [];
  for (const t of truthRows || []) {
    const k = left.findIndex((p) => norm(p.name) === norm(t.name) && p.x === t.x && p.y === t.y);
    if (k >= 0) rows.push({ t, p: left.splice(k, 1)[0], cell: true });
    else pending.push(t);
  }
  for (const t of pending) {
    let best = -1;
    let bd = Infinity;
    left.forEach((p, k) => {
      if (norm(p.name) !== norm(t.name)) return;
      const d = Math.abs(p.x - t.x) + Math.abs(p.y - t.y);
      if (d < bd) { bd = d; best = k; }
    });
    if (best >= 0) rows.push({ t, p: left.splice(best, 1)[0], cell: false });
    else rows.push({ t, p: null, cell: false });
  }
  return rows;
}

function samePlace(a, b) {
  return a && b && String(a.name).toLowerCase() === String(b.name).toLowerCase() && a.x === b.x && a.y === b.y;
}

function scoreItems(pred, truth) {
  const items = pred.filter((p) => !p.bag);
  const itemRows = matchRows(items.map((p) => ({ ...p })), truth.items || []);
  const used = itemRows.filter((r) => r.cell).map((r) => r.p);
  const skillRows = matchRows(items.filter((p) => !used.some((u) => samePlace(u, p))).map((p) => ({ ...p })), truth.skills || []);
  const skillHits = skillRows.filter((r) => r.cell).map((r) => r.p);
  const cellHits = used.length;
  const rotHits = itemRows.filter((r) => r.cell && rotOk(r.p, r.t)).length;
  const unsupported = items.filter((p) => !used.some((u) => samePlace(u, p)) && !skillHits.some((u) => samePlace(u, p))).length;
  return {
    cellHits,
    rotHits,
    truthN: (truth.items || []).length,
    predN: items.length,
    unsupported,
    skills: skillHits.length,
    skillN: (truth.skills || []).length,
  };
}

function select(candidates, bagSet) {
  const strong = candidates.filter((c) => c.score >= SCORE_FLOOR).sort((a, b) => b.score - a.score);
  const used = new Set();
  const chosen = [];
  for (const c of strong) {
    if (c.cells.some((cell) => used.has(cell) || !bagSet.has(cell))) continue;
    for (const cell of c.cells) used.add(cell);
    chosen.push(c);
  }
  const unresolved = [...bagSet].filter((cell) => !used.has(cell));
  return { chosen, unresolved, considered: candidates.length, strong: strong.length };
}

async function preloadThumbs(page, port) {
  const list = classes.map((c) => ({
    id: c.id,
    url: `http://127.0.0.1:${port}/assets/item-thumbs/2x/${encodeURIComponent(c.image)}.webp`,
  }));
  return page.evaluate(async (list) => {
    window.__p5 = { sprites: new Map(), hay: new Map(), needles: new Map() };
    await Promise.all(list.map(({ id, url }) => new Promise((resolve) => {
      const i = new Image();
      i.onload = () => { window.__p5.sprites.set(id, i); resolve(); };
      i.onerror = () => resolve();
      i.src = url;
    })));
    return window.__p5.sprites.size;
  }, list);
}

async function loadFixture(page, dataUrl) {
  return page.evaluate(async (src) => {
    const { preprocessScreenshotForVision } = await import('/js/pages/create/screenshot-preprocess.js?v=p5');
    const pre = await preprocessScreenshotForVision(src);
    if (!pre.grid?.ok) return { gridOk: false };
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
    window.__p5.hay.set(src, { W, H, gray, alpha });
    const rectW = Number(pre.grid.bagRect?.w) || pre.grid.cellW * pre.grid.cols;
    const rectH = Number(pre.grid.bagRect?.h) || pre.grid.cellH * pre.grid.rows;
    const cellW = rectW > 0 ? (W * pre.grid.cellW) / rectW : pre.grid.cellW;
    const cellH = rectH > 0 ? (H * pre.grid.cellH) / rectH : pre.grid.cellH;
    return { gridOk: true, grid: { ...pre.grid, originX: 0, originY: 0, cellW, cellH } };
  }, dataUrl);
}

async function propose(page, o) {
  return page.evaluate(async (o) => {
    const { bestNcc, prepareTemplateBrowser, knownScales } = await import('/js/shared/screenshot-ncc.js?v=p5');
    const hay0 = window.__p5.hay.get(o.dataUrl);
    if (!hay0) return { error: 'no hay' };
    const { W, H, gray, alpha } = hay0;
    const g = o.grid;
    const bag = new Set(o.bagCells);
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
    const regionCache = new Map();
    const regionFor = (b) => {
      const key = `${b.x0},${b.y0},${b.x1},${b.y1}`;
      if (regionCache.has(key)) return regionCache.get(key);
      const pad = Math.round(g.cellW * 1.5);
      const rx0 = Math.max(0, Math.floor(g.originX + b.x0 * g.cellW - pad));
      const ry0 = Math.max(0, Math.floor(g.originY + b.y0 * g.cellH - pad));
      const rx1 = Math.min(W, Math.ceil(g.originX + (b.x1 + 1) * g.cellW + pad));
      const ry1 = Math.min(H, Math.ceil(g.originY + (b.y1 + 1) * g.cellH + pad));
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
            for (let sx = sx0; sx < sx1; sx++) { gv += gray[row + sx]; av += alpha[row + sx]; n++; }
          }
          sGray[y * sw + x] = n ? gv / n : 0;
          sAlpha[y * sw + x] = n ? Math.round(av / n) : 0;
        }
      }
      const hayGray = { w: sw, h: sh, gray: sGray, alpha: sAlpha };
      const hayEdge = { w: sw, h: sh, gray: sobel(sGray, sw, sh), alpha: sAlpha };
      const cxr = (g.originX + ((b.x0 + b.x1 + 1) / 2) * g.cellW - rx0) / f;
      const cyr = (g.originY + ((b.y0 + b.y1 + 1) / 2) * g.cellH - ry0) / f;
      const region = { hayGray, hayEdge, cxr, cyr, sw, sh };
      regionCache.set(key, region);
      return region;
    };
    const needleFor = (face) => {
      const key = `${face.id}:${face.r}`;
      if (window.__p5.needles.has(key)) return window.__p5.needles.get(key);
      const img = window.__p5.sprites.get(face.id);
      if (!img) { window.__p5.needles.set(key, null); return null; }
      const nativeW = img.naturalWidth || img.width;
      const scale = knownScales(o.cellPx, Number(face.displayW) || 1, nativeW)[2] || 1;
      const needle = prepareTemplateBrowser(img, face.r * 90, scale);
      const packed = needle.w >= 8 && needle.h >= 8
        ? { needle, edge: { w: needle.w, h: needle.h, gray: sobel(needle.gray, needle.w, needle.h), alpha: needle.alpha } }
        : null;
      window.__p5.needles.set(key, packed);
      return packed;
    };

    const origins = [];
    for (const cell of bag) {
      const [x, y] = cell.split(',').map(Number);
      if (Number.isFinite(x) && Number.isFinite(y)) origins.push({ x, y });
    }
    const out = [];
    let tested = 0;
    for (const origin of origins) {
      for (const face of o.faces) {
        const world = face.cells.map((p) => ({ x: origin.x + p.x, y: origin.y + p.y }));
        if (!world.every((c) => bag.has(`${c.x},${c.y}`))) continue;
        const packed = needleFor(face);
        if (!packed) continue;
        const b = {
          x0: Math.min(...world.map((c) => c.x)),
          y0: Math.min(...world.map((c) => c.y)),
          x1: Math.max(...world.map((c) => c.x)),
          y1: Math.max(...world.map((c) => c.y)),
        };
        const region = regionFor(b);
        if (packed.needle.w >= region.sw || packed.needle.h >= region.sh) continue;
        const ecx = region.cxr + (Number(face.anchorX) || 0) * o.cellPx;
        const ecy = region.cyr + (Number(face.anchorY) || 0) * o.cellPx;
        const bx0 = Math.max(0, Math.floor(ecx - packed.needle.w / 2) - o.jitter);
        const by0 = Math.max(0, Math.floor(ecy - packed.needle.h / 2) - o.jitter);
        const bx1 = Math.min(region.sw - packed.needle.w, Math.floor(ecx - packed.needle.w / 2) + o.jitter);
        const by1 = Math.min(region.sh - packed.needle.h, Math.floor(ecy - packed.needle.h / 2) + o.jitter);
        const bounds = { x0: bx0, y0: by0, x1: Math.max(bx0, bx1), y1: Math.max(by0, by1) };
        const gHit = bestNcc(region.hayGray, packed.needle, o.stride, bounds);
        const eHit = bestNcc(region.hayEdge, packed.edge, o.stride, bounds);
        const score = 0.5 * gHit.score + 0.5 * eHit.score;
        tested++;
        if (score < o.floor) continue;
        out.push({
          id: face.id,
          name: face.name,
          x: origin.x,
          y: origin.y,
          r: face.r,
          cells: world.map((c) => `${c.x},${c.y}`),
          visual: gHit.score,
          edge: eHit.score,
          score,
        });
      }
    }
    return { tested, kept: out.length, candidates: out };
  }, o);
}

const server = await serve();
const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(0);
page.on('pageerror', (e) => console.error('[page error]', e.message));
await page.goto(`http://127.0.0.1:${port}/dev/screenshot-import/`);
await page.waitForFunction(() => window.__stbReady === true, null, { timeout: 60000 }).catch(() => {});
console.log('thumbs', await preloadThumbs(page, port), 'faces', faces.length);

const perFixture = [];
for (const name of fixtures) {
  const fixtureDir = fs.existsSync(path.join(repo, 'fixtures', `${name}.png`))
    ? path.join(repo, 'fixtures')
    : path.join(repo, 'scripts/screenshot-eval/fixtures');
  const truth = JSON.parse(fs.readFileSync(path.join(fixtureDir, `${name}.truth.json`), 'utf8'));
  const v1 = JSON.parse(fs.readFileSync(path.join(v1Dir, name, 'result.json'), 'utf8'));
  const bagCells = [...new Set((v1.placements || []).filter((p) => p.bag).flatMap((p) => p.cells || []))];
  const dataUrl = `data:image/png;base64,${fs.readFileSync(path.join(fixtureDir, `${name}.png`)).toString('base64')}`;
  const load = await loadFixture(page, dataUrl);
  if (!load.gridOk || !bagCells.length) {
    console.log(`${name}: skip grid=${load.gridOk} bags=${bagCells.length}`);
    continue;
  }
  const t0 = Date.now();
  const proposed = await propose(page, {
    dataUrl,
    grid: load.grid,
    bagCells,
    faces,
    cellPx: CELL_PX,
    jitter: JITTER,
    stride: STRIDE,
    floor: SCORE_FLOOR,
  });
  const bagSet = new Set(bagCells);
  const picked = select(proposed.candidates || [], bagSet);
  const placements = picked.chosen.map((c) => ({
    name: c.name,
    x: c.x,
    y: c.y,
    r: c.r,
    cells: c.cells,
    visual: Math.round(c.visual * 1000) / 1000,
    edge: Math.round(c.edge * 1000) / 1000,
    geometry: 1,
    detector: null,
    source: 'thumbs-ncc',
    score: Math.round(c.score * 1000) / 1000,
  }));
  const mine = scoreItems(placements, truth);
  const control = scoreItems(v1.placements || [], truth);
  const row = {
    fixture: name,
    bagCells: bagCells.length,
    tested: proposed.tested,
    aboveFloor: proposed.kept,
    placed: placements.length,
    unresolved: picked.unresolved.length,
    ms: Date.now() - t0,
    select: mine,
    v1: control,
  };
  perFixture.push(row);
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify({ ...row, placements, unresolved: picked.unresolved }, null, 2));
  console.log(`${name}: select ${mine.cellHits}/${mine.truthN} pred=${mine.predN} unsupported=${mine.unsupported} unresolved=${picked.unresolved.length} | v1 ${control.cellHits}/${control.truthN} pred=${control.predN} unsupported=${control.unsupported} (${row.ms}ms)`);
}

await browser.close();
server.close();

const sum = (key, field) => perFixture.reduce((s, r) => s + r[key][field], 0);
const report = {
  date: '2026-10-01',
  experiment: 'P5 global selection prototype',
  method: `Candidates are catalog faces whose footprint lies entirely inside the bag cells saved from the live v1 direct placer. Rank is 0.5 visual NCC + 0.5 edge NCC on site thumbs. A placement is kept only at score >= ${SCORE_FLOOR} and only if its cells are free. Leftover bag cells stay unresolved. Detector field is null. No importer change.`,
  scoreFloor: SCORE_FLOOR,
  control: 'live v1 greedy direct placement, same saved result.json bag cells and the same name-at-cell scorer',
  perFixture,
  select: {
    cellHits: sum('select', 'cellHits'),
    truthN: sum('select', 'truthN'),
    predN: sum('select', 'predN'),
    unsupported: sum('select', 'unsupported'),
    unresolved: perFixture.reduce((s, r) => s + r.unresolved, 0),
    skills: sum('select', 'skills'),
    skillN: sum('select', 'skillN'),
  },
  v1: {
    cellHits: sum('v1', 'cellHits'),
    truthN: sum('v1', 'truthN'),
    predN: sum('v1', 'predN'),
    unsupported: sum('v1', 'unsupported'),
    skills: sum('v1', 'skills'),
    skillN: sum('v1', 'skillN'),
  },
};
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log('\n===== P5 =====');
console.log(JSON.stringify({ select: report.select, v1: report.v1 }, null, 2));
