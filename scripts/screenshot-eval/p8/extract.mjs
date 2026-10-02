/**
 * Extract P3-matched regions and a board-aligned canon crop for each truth instance.
 * Eval-only. The live importer is not called.
 *
 *   node scripts/screenshot-eval/p8/extract.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  CELL_PX, FIXTURES, areaOf, fixturePng, fixtureTruth, footprint, isOblong, loadCatalog, outDir, repo,
} from './shared.mjs';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

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

function writePng(dataUrl, file) {
  const b64 = String(dataUrl).slice(String(dataUrl).indexOf(',') + 1);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
}

const server = await serve();
const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('[page]', e.message));
await page.goto(`http://127.0.0.1:${port}/dev/screenshot-import/`);
await page.waitForFunction(() => window.__stbReady === true, null, { timeout: 60000 }).catch(() => {});

const { shapes, display, byNorm } = loadCatalog();
const manifest = { cellPx: CELL_PX, fixtures: [] };

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const names = only.length ? only : FIXTURES;
for (const name of names) {
  const truth = JSON.parse(fs.readFileSync(fixtureTruth(name), 'utf8'));
  const dataUrl = `data:image/png;base64,${fs.readFileSync(fixturePng(name)).toString('base64')}`;
  const jobs = [];
  for (const kind of ['item', 'skill', 'jewel']) {
    const key = kind === 'item' ? 'items' : kind === 'skill' ? 'skills' : 'jewels';
    for (const t of truth[key] || []) {
      const cls = byNorm.get(String(t.name).replace(/[^A-Za-z0-9]/g, '').toLowerCase());
      if (!cls) {
        jobs.push({ kind, name: t.name, x: t.x, y: t.y, r: t.r ?? null, missing: 'no-class' });
        continue;
      }
      const b = footprint(shapes, cls, t);
      const disp = display[`${cls.image}.png`] || {};
      jobs.push({
        kind, name: t.name, x: t.x, y: t.y, r: t.r ?? null, missing: null,
        truthId: cls.id, image: cls.image, type: cls.type || '',
        oblong: isOblong(shapes, cls), b,
        area: areaOf(b),
        anchorX: Number(disp.anchorX) || 0,
        anchorY: Number(disp.anchorY) || 0,
        displayW: Number(disp.w) || 1,
      });
    }
  }

  const extracted = await page.evaluate(async ({ src, jobs, cellPx }) => {
    const { preprocessScreenshotForVision } = await import('/js/pages/create/screenshot-preprocess.js?v=p8');
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
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, W, H).data;
    const rectW = Number(pre.grid.bagRect?.w) || pre.grid.cellW * pre.grid.cols;
    const rectH = Number(pre.grid.bagRect?.h) || pre.grid.cellH * pre.grid.rows;
    const cellW = rectW > 0 ? (W * pre.grid.cellW) / rectW : pre.grid.cellW;
    const cellH = rectH > 0 ? (H * pre.grid.cellH) / rectH : pre.grid.cellH;
    const grid = { cols: pre.grid.cols, rows: pre.grid.rows, cellW, cellH, W, H };

    const toPng = (rgb, w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const cctx = c.getContext('2d');
      const im = cctx.createImageData(w, h);
      for (let p = 0, i = 0; p < w * h; p++, i += 3) {
        const o = p * 4;
        im.data[o] = rgb[i];
        im.data[o + 1] = rgb[i + 1];
        im.data[o + 2] = rgb[i + 2];
        im.data[o + 3] = 255;
      }
      cctx.putImageData(im, 0, 0);
      return c.toDataURL('image/png');
    };

    const crops = [];
    for (const job of jobs) {
      if (job.missing || !job.b) {
        crops.push(null);
        continue;
      }
      const b = job.b;
      const pad = Math.round(cellW * 1.5);
      const rx0 = Math.max(0, Math.floor(b.x0 * cellW - pad));
      const ry0 = Math.max(0, Math.floor(b.y0 * cellH - pad));
      const rx1 = Math.min(W, Math.ceil((b.x1 + 1) * cellW + pad));
      const ry1 = Math.min(H, Math.ceil((b.y1 + 1) * cellH + pad));
      const rw = Math.max(8, rx1 - rx0);
      const rh = Math.max(8, ry1 - ry0);
      const f = cellW / cellPx;
      const sw = Math.max(8, Math.floor(rw / f));
      const sh = Math.max(8, Math.floor(rh / f));
      const rgb = new Uint8ClampedArray(sw * sh * 3);
      for (let y = 0; y < sh; y++) {
        const sy0 = Math.floor(y * f);
        const sy1 = Math.min(rh, Math.max(sy0 + 1, Math.floor((y + 1) * f)));
        for (let x = 0; x < sw; x++) {
          const sx0 = Math.floor(x * f);
          const sx1 = Math.min(rw, Math.max(sx0 + 1, Math.floor((x + 1) * f)));
          let r = 0; let g = 0; let bv = 0; let n = 0;
          for (let sy = sy0; sy < sy1; sy++) {
            const row = ((ry0 + sy) * W + rx0) * 4;
            for (let sx = sx0; sx < sx1; sx++) {
              const o = row + sx * 4;
              r += d[o]; g += d[o + 1]; bv += d[o + 2]; n++;
            }
          }
          const i = (y * sw + x) * 3;
          rgb[i] = n ? r / n : 0;
          rgb[i + 1] = n ? g / n : 0;
          rgb[i + 2] = n ? bv / n : 0;
        }
      }
      const cxr = ((b.x0 + b.x1 + 1) / 2 * cellW - rx0) / f;
      const cyr = ((b.y0 + b.y1 + 1) / 2 * cellH - ry0) / f;

      const S = 48;
      const PAD = 1.5;
      const cellsW = b.x1 - b.x0 + 1;
      const cellsH = b.y1 - b.y0 + 1;
      const cw = Math.round((cellsW + PAD * 2) * S);
      const ch = Math.round((cellsH + PAD * 2) * S);
      const canon = new Uint8ClampedArray(cw * ch * 3);
      const x0c = b.x0 - PAD;
      const y0c = b.y0 - PAD;
      for (let y = 0; y < ch; y++) {
        const py0 = Math.max(0, Math.floor((y0c + y / S) * cellH));
        const py1 = Math.min(H, Math.max(py0 + 1, Math.ceil((y0c + (y + 1) / S) * cellH)));
        for (let x = 0; x < cw; x++) {
          const px0 = Math.max(0, Math.floor((x0c + x / S) * cellW));
          const px1 = Math.min(W, Math.max(px0 + 1, Math.ceil((x0c + (x + 1) / S) * cellW)));
          let r = 0; let g = 0; let bv = 0; let n = 0;
          for (let py = py0; py < py1; py++) {
            const row = py * W * 4;
            for (let px = px0; px < px1; px++) {
              const o = row + px * 4;
              r += d[o]; g += d[o + 1]; bv += d[o + 2]; n++;
            }
          }
          const i = (y * cw + x) * 3;
          canon[i] = n ? r / n : 0;
          canon[i + 1] = n ? g / n : 0;
          canon[i + 2] = n ? bv / n : 0;
        }
      }
      crops.push({ w: sw, h: sh, png: toPng(rgb, sw, sh), cxr, cyr, canonW: cw, canonH: ch, canonPng: toPng(canon, cw, ch) });
    }
    return { gridOk: true, grid, crops };
  }, { src: dataUrl, jobs, cellPx: CELL_PX });

  if (!extracted.gridOk) {
    console.log(`${name}: GRID FAIL`);
    manifest.fixtures.push({ fixture: name, gridOk: false, instances: [] });
    continue;
  }
  const instances = [];
  jobs.forEach((job, i) => {
    const crop = extracted.crops[i];
    const rec = { ...job, i };
    if (crop) {
      const matchFile = `crops/${name}/${i}.png`;
      const canonFile = `canon/${name}/${i}.png`;
      writePng(crop.png, path.join(outDir, matchFile));
      writePng(crop.canonPng, path.join(outDir, canonFile));
      rec.match = matchFile;
      rec.canon = canonFile;
      rec.w = crop.w;
      rec.h = crop.h;
      rec.cxr = crop.cxr;
      rec.cyr = crop.cyr;
      rec.canonW = crop.canonW;
      rec.canonH = crop.canonH;
    }
    instances.push(rec);
  });
  console.log(`${name}: grid ${extracted.grid.cols}x${extracted.grid.rows} cell ${extracted.grid.cellW.toFixed(1)} crops ${instances.filter((r) => r.match).length}`);
  manifest.fixtures.push({
    fixture: name,
    gridOk: true,
    grid: extracted.grid,
    largeShot: extracted.grid.cellW >= 180,
    instances,
  });
}

await browser.close();
server.close();
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest));
console.log('wrote', path.join(outDir, 'manifest.json'));
