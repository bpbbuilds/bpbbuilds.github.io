/**
 * Eval-only occupancy measurement. It never calls the importer or placer.
 * Usage: node scripts/screenshot-eval/occupancy.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const fixtures = ['real-001', 'real-003', 'real-007', 'real-008', 'real-010', 'real-013', 'leather-quad', 'pine-protector'];
const outDir = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-09-30-p2-occupancy');
fs.mkdirSync(outDir, { recursive: true });
const shapes = JSON.parse(fs.readFileSync(path.join(repo, 'assets/data/item-shapes.json'), 'utf8')).byId || {};
const classes = JSON.parse(fs.readFileSync(path.join(repo, 'assets/data/detector-classes.json'), 'utf8')).classes || [];
const byName = new Map(classes.map((c) => [String(c.name).toLowerCase(), c]));

function serve() {
  const s = http.createServer((req, res) => {
    const u = new URL(req.url || '/', 'http://x');
    let file = path.join(repo, decodeURIComponent(u.pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!file.startsWith(repo) || !fs.existsSync(file)) return res.writeHead(404).end();
    const ext = path.extname(file).toLowerCase();
    const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'text/javascript' : ext === '.json' ? 'application/json' : ext === '.png' ? 'image/png' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => s.listen(0, '127.0.0.1', () => resolve(s)));
}

function rotateBody(matrix, r) {
  let pts = [];
  for (let y = 0; y < matrix.length; y++) for (let x = 0; x < (matrix[y] || []).length; x++) if (Number(matrix[y][x]) === 1) pts.push({ x, y });
  if (!pts.length) pts = [{ x: 0, y: 0 }];
  for (let i = 0; i < ((Number(r) || 0) + 4) % 4; i++) pts = pts.map((p) => ({ x: -p.y, y: p.x }));
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  return pts.map((p) => ({ x: p.x - minX, y: p.y - minY }));
}

function truthCells(truth) {
  const cells = new Map();
  for (const t of truth.items || []) {
    const meta = byName.get(String(t.name).toLowerCase());
    const matrix = meta ? shapes[String(meta.id)] : null;
    for (const c of rotateBody(matrix || [[1]], t.r)) {
      const x = Number(t.x) + c.x;
      const y = Number(t.y) + c.y;
      if (x < 0 || y < 0 || x >= 9 || y >= 7) continue;
      const kind = String(meta?.type || '').toLowerCase().includes('skill') ? 'skills' : String(meta?.type || '').toLowerCase().includes('gem') ? 'jewels' : 'items';
      cells.set(`${x},${y}`, kind);
    }
  }
  return cells;
}

async function features(page, file) {
  const dataUrl = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
  return page.evaluate(async (src) => {
    const { preprocessScreenshotForVision } = await import('/js/pages/create/screenshot-preprocess.js?v=occupancy');
    const pre = await preprocessScreenshotForVision(src);
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = pre.dataUrl; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const g = pre.grid; const cw = Number(g?.cellW) || c.width / 9; const ch = Number(g?.cellH) || c.height / 7;
    const out = [];
    for (let y = 0; y < (g?.rows || 7); y++) for (let x = 0; x < (g?.cols || 9); x++) {
      const x0 = Math.max(0, Math.floor(x * cw)); const y0 = Math.max(0, Math.floor(y * ch)); const x1 = Math.min(c.width, Math.ceil((x + 1) * cw)); const y1 = Math.min(c.height, Math.ceil((y + 1) * ch));
      const vals = []; const edge = []; const mx = Math.max(1, Math.floor((x1 - x0) * 0.2)); const my = Math.max(1, Math.floor((y1 - y0) * 0.2));
      for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) { const i = (py * c.width + px) * 4; const v = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]; (px < x0+mx || px >= x1-mx || py < y0+my || py >= y1-my ? edge : vals).push(v); }
      const mean = (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
      const m = mean(vals), b = mean(edge); const variance = mean(vals.map((v) => (v - m) ** 2));
      out.push({ x, y, score: Math.abs(m - b) + Math.sqrt(variance) });
    }
    return { grid: { cols: g?.cols || 9, rows: g?.rows || 7, cellW: cw, cellH: ch }, features: out };
  }, dataUrl);
}

const server = await serve();
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/dev/screenshot-import/`);
const rows = [];
for (const name of fixtures) {
  const fixtureDir = fs.existsSync(path.join(repo, 'fixtures', `${name}.png`)) ? path.join(repo, 'fixtures') : path.join(repo, 'scripts/screenshot-eval/fixtures');
  const truth = JSON.parse(fs.readFileSync(path.join(fixtureDir, `${name}.truth.json`), 'utf8'));
  const f = await features(page, path.join(fixtureDir, `${name}.png`));
  const occupied = truthCells(truth);
  rows.push({ name, ...f, truth: [...occupied.entries()].map(([cell, kind]) => ({ cell, kind })) });
  console.log(`${name}: grid=${f.grid.cols}x${f.grid.rows} truthOccupied=${occupied.size}`);
}
await browser.close(); server.close();
fs.writeFileSync(path.join(outDir, 'features.json'), JSON.stringify(rows, null, 2));

const thresholds = [...new Set(rows.flatMap((r) => r.features.map((f) => f.score)))].sort((a, b) => a - b);
let best = null;
for (const t of thresholds) {
  let tp = 0, fp = 0, fn = 0;
  for (const r of rows) { const truth = new Set(r.truth.map((x) => x.cell)); for (const f of r.features) { const pred = f.score >= t; const hit = truth.has(`${f.x},${f.y}`); if (pred && hit) tp++; else if (pred) fp++; else if (hit) fn++; } }
  const p = tp / Math.max(1, tp + fp); const rec = tp / Math.max(1, tp + fn); const f1 = 2 * p * rec / Math.max(1e-9, p + rec);
  if (!best || f1 > best.f1) best = { threshold: t, tp, fp, fn, precision: p, recall: rec, f1 };
}
const breakdown = rows.map((r) => {
  const truth = new Map(r.truth.map((x) => [x.cell, x.kind]));
  let tp = 0, fp = 0, fn = 0;
  const kinds = {};
  for (const f of r.features) {
    const hit = truth.has(`${f.x},${f.y}`); const pred = f.score >= best.threshold;
    if (pred && hit) tp++; else if (pred) fp++; else if (hit) fn++;
    if (hit) { const k = truth.get(`${f.x},${f.y}`); kinds[k] ||= { tp: 0, fn: 0 }; if (pred) kinds[k].tp++; else kinds[k].fn++; }
  }
  return { fixture: r.name, grid: `${r.grid.cols}x${r.grid.rows}`, tp, fp, fn, precision: tp / Math.max(1, tp + fp), recall: tp / Math.max(1, tp + fn), byKind: kinds };
});
const report = { fixtures, method: 'center-vs-border luminance contrast plus within-cell luminance deviation; no item identity or placement', best, breakdown, note: 'Threshold selected on this fixed held-out set for feasibility measurement, not a shipping gate.' };
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
