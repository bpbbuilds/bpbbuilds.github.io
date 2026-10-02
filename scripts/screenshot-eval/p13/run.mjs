/**
 * P13 truth-to-image registration audit. Eval only.
 * Draws the detected seam grid and a canonical 9×7 on the original screenshot.
 * Does not change the importer, truth, or any recognizer.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { bestNcc, imageDataToGray, knownScales, prepareTemplateGray } from '../../../js/shared/screenshot-ncc.js';
import {
  CELL_PX, fixturePng, fixtureTruth, footprint, loadCatalog, repo,
} from '../p8/shared.mjs';

const P8 = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p8');
const OUT = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p13');
const FAILING = ['real-003', 'real-007', 'real-008', 'real-013', 'leather-quad'];
const CONTROL = ['pine-protector', 'real-010'];
const AUDIT = {
  'real-007': [[6, 0, 'Banana'], [2, 2, 'Banana'], [4, 2, 'Doom Cap'], [0, 1, 'Darksaber'], [5, 4, 'Blueberries'], [0, 5, 'Holy Armor'], [7, 1, 'Jynx torquilla']],
  'real-008': [[2, 1, 'Prismatic Orb'], [1, 1, 'Prismatic Orb'], [1, 2, 'Impractically Large Bloodthorne'], [7, 2, 'Star of Courage'], [6, 4, 'Banana'], [0, 0, 'Nature Chronicles: Trees'], [6, 6, 'Lucky Piggy']],
  'real-013': [[1, 2, 'Star of Courage'], [0, 3, 'Piggybank'], [1, 0, 'Whetstone'], [2, 0, 'Wooden Buckler'], [0, 0, 'Amulet of Feasting'], [1, 1, 'Battery']],
  'leather-quad': [[2, 0, 'Piggybank'], [0, 3, 'Broom'], [0, 0, 'Wooden Buckler'], [2, 1, 'Wooden Sword'], [2, 2, 'Shortbow']],
  'real-003': [[0, 1, 'Fancy Fencing Rapier'], [0, 4, 'Panzer Dragon'], [0, 0, 'Spiked Collar'], [8, 5, 'Healing Herbs'], [6, 5, 'Amulet of Steel'], [7, 0, 'Forging Hammer']],
  'pine-protector': [[3, 1, 'Falcon Blade'], [0, 0, 'Strong Stone Skin Potion']],
  'real-010': [[4, 3, 'Banana'], [1, 5, 'Piggybank'], [0, 5, 'Star of Courage']],
};

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
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => s.listen(0, '127.0.0.1', () => resolve(s)));
}

function slug(name) {
  return name.replace(/[^a-z0-9]+/gi, '-');
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

const { shapes, display, byNorm } = loadCatalog();

function placement(fixture, itemName, x, y) {
  const truth = JSON.parse(fs.readFileSync(fixtureTruth(fixture), 'utf8'));
  const t = (truth.items || []).find((it) => it.name === itemName && it.x === x && it.y === y);
  if (!t) return null;
  const cls = byNorm.get(String(t.name).replace(/[^A-Za-z0-9]/g, '').toLowerCase());
  if (!cls) return { ...t, missing: true };
  return { ...t, b: footprint(shapes, cls, t), cls };
}

function mapRect(rect, sx, sy, fullW, fullH) {
  let x = Math.round(rect.x * sx);
  let y = Math.round(rect.y * sy);
  let w = Math.round(rect.w * sx);
  let h = Math.round(rect.h * sy);
  x = Math.max(0, Math.min(fullW - 8, x));
  y = Math.max(0, Math.min(fullH - 8, y));
  w = Math.max(16, Math.min(fullW - x, w));
  h = Math.max(16, Math.min(fullH - y, h));
  return { x, y, w, h };
}

const server = await serve();
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/dev/screenshot-import/`);
await page.waitForFunction(() => true);

const geometry = {};
for (const name of [...FAILING, ...CONTROL]) {
  const dataUrl = `data:image/png;base64,${fs.readFileSync(fixturePng(name)).toString('base64')}`;
  geometry[name] = await page.evaluate(async (src) => {
    const { imageDataUrlToGray } = await import('/js/pages/create/screenshot-preprocess.js?v=p13');
    const { detectBagGrid, cropBagRect } = await import('/js/shared/screenshot-grid.js?v=p13');
    const gray = await imageDataUrlToGray(src);
    const grid = detectBagGrid(gray);
    const rect = cropBagRect(grid);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = src;
    });
    return {
      fullW: img.naturalWidth || img.width,
      fullH: img.naturalHeight || img.height,
      detW: gray.w,
      detH: gray.h,
      ok: !!grid.ok,
      cellW: grid.cellW,
      cellH: grid.cellH,
      originX: grid.originX,
      originY: grid.originY,
      cols: grid.cols,
      rows: grid.rows,
      bagDetect: grid.bagRect,
      rect,
    };
  }, dataUrl);
  const g = geometry[name];
  g.bagFull = mapRect(g.rect, g.fullW / g.detW, g.fullH / g.detH, g.fullW, g.fullH);
  g.nativeCellW = g.bagFull.w * g.cellW / g.bagDetect.w;
  g.nativeCellH = g.bagFull.h * g.cellH / g.bagDetect.h;
  g.canonCellW = g.bagFull.w / 9;
  g.canonCellH = g.bagFull.h / 7;
  console.log(`${name} detect ${g.cols}x${g.rows} cell ${g.nativeCellW.toFixed(1)} bag ${g.bagFull.x},${g.bagFull.y} ${g.bagFull.w}x${g.bagFull.h} canon ${g.canonCellW.toFixed(1)}x${g.canonCellH.toFixed(1)}`);
}
await browser.close();
server.close();

function cellBox(bag, cellW, cellH, b, pad) {
  return {
    x0: bag.x + b.x0 * cellW - pad * cellW,
    y0: bag.y + b.y0 * cellH - pad * cellH,
    x1: bag.x + (b.x1 + 1) * cellW + pad * cellW,
    y1: bag.y + (b.y1 + 1) * cellH + pad * cellH,
  };
}

function clampBag(r, bag) {
  return {
    x0: Math.max(bag.x, r.x0),
    y0: Math.max(bag.y, r.y0),
    x1: Math.min(bag.x + bag.w, r.x1),
    y1: Math.min(bag.y + bag.h, r.y1),
  };
}

function centerOf(r) {
  return { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 };
}

fs.mkdirSync(path.join(OUT, 'overlays'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'zooms'), { recursive: true });

function drawGrid(ctx, bag, cols, rows, cellW, cellH, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let c = 0; c <= cols; c++) {
    const x = bag.x + c * cellW;
    ctx.beginPath();
    ctx.moveTo(x, bag.y);
    ctx.lineTo(x, bag.y + rows * cellH);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    const y = bag.y + r * cellH;
    ctx.beginPath();
    ctx.moveTo(bag.x, y);
    ctx.lineTo(bag.x + cols * cellW, y);
    ctx.stroke();
  }
}

const audits = [];
for (const shot of Object.keys(AUDIT)) {
  const g = geometry[shot];
  const img = await loadImage(fixturePng(shot));
  const scale = Math.min(1, 1500 / img.width);
  const board = createCanvas(Math.round(img.width * scale), Math.round(img.height * scale));
  const ctx = board.getContext('2d');
  ctx.drawImage(img, 0, 0, board.width, board.height);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#eac914';
  ctx.lineWidth = 4;
  ctx.strokeRect(g.bagFull.x, g.bagFull.y, g.bagFull.w, g.bagFull.h);
  drawGrid(ctx, g.bagFull, g.cols, g.rows, g.nativeCellW, g.nativeCellH, 'rgba(126,200,255,0.9)');
  drawGrid(ctx, g.bagFull, 9, 7, g.canonCellW, g.canonCellH, 'rgba(255,138,61,0.95)');
  for (const [x, y, itemName] of AUDIT[shot]) {
    const found = placement(shot, itemName, x, y);
    if (!found?.b) {
      audits.push({ shot, item: itemName, x, y, missing: true });
      continue;
    }
    const detected = clampBag(cellBox(g.bagFull, g.nativeCellW, g.nativeCellH, found.b, 0), g.bagFull);
    const ncc = clampBag(cellBox(g.bagFull, g.nativeCellW, g.nativeCellH, found.b, 1.5), g.bagFull);
    const canon = clampBag(cellBox(g.bagFull, g.canonCellW, g.canonCellH, found.b, 0), g.bagFull);
    const dc = centerOf(detected);
    const cc = centerOf(canon);
    ctx.strokeStyle = '#ff4d4d';
    ctx.lineWidth = 3;
    ctx.strokeRect(ncc.x0, ncc.y0, ncc.x1 - ncc.x0, ncc.y1 - ncc.y0);
    ctx.fillStyle = 'rgba(61,255,122,0.22)';
    ctx.fillRect(detected.x0, detected.y0, detected.x1 - detected.x0, detected.y1 - detected.y0);
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 4;
    ctx.strokeRect(detected.x0, detected.y0, detected.x1 - detected.x0, detected.y1 - detected.y0);
    ctx.strokeStyle = '#ff8a3d';
    ctx.lineWidth = 3;
    ctx.strokeRect(canon.x0, canon.y0, canon.x1 - canon.x0, canon.y1 - canon.y0);
    ctx.fillStyle = '#fffaf0';
    ctx.font = `${Math.round(28 / scale)}px sans-serif`;
    ctx.fillText(`${itemName} ${x},${y}`, detected.x0 + 4, detected.y0 + Math.round(32 / scale));
    const dx = cc.x - dc.x;
    const dy = cc.y - dc.y;
    const row = {
      shot, item: itemName, x, y,
      detectedCenter: { x: round1(dc.x), y: round1(dc.y) },
      canonCenter: { x: round1(cc.x), y: round1(cc.y) },
      deltaNative: { x: round1(dx), y: round1(dy) },
      deltaDetectedCells: { x: round1(dx / g.nativeCellW), y: round1(dy / g.nativeCellH) },
      deltaCanonCells: { x: round1(dx / g.canonCellW), y: round1(dy / g.canonCellH) },
      ncc: { x0: Math.round(ncc.x0), y0: Math.round(ncc.y0), x1: Math.round(ncc.x1), y1: Math.round(ncc.y1) },
    };
    audits.push(row);
    const pad = Math.round(g.nativeCellW * 2);
    const wx0 = Math.max(0, Math.floor(detected.x0 - pad));
    const wy0 = Math.max(0, Math.floor(detected.y0 - pad));
    const wx1 = Math.min(img.width, Math.ceil(detected.x1 + pad));
    const wy1 = Math.min(img.height, Math.ceil(detected.y1 + pad));
    const zoom = createCanvas(wx1 - wx0, wy1 - wy0);
    const z = zoom.getContext('2d');
    z.drawImage(img, wx0, wy0, zoom.width, zoom.height, 0, 0, zoom.width, zoom.height);
    const local = (r, color, width) => {
      z.strokeStyle = color;
      z.lineWidth = width;
      z.strokeRect(r.x0 - wx0, r.y0 - wy0, r.x1 - r.x0, r.y1 - r.y0);
    };
    local(ncc, '#ff4d4d', 3);
    local(detected, '#39ff14', 4);
    local(canon, '#ff8a3d', 3);
    z.fillStyle = '#fffaf0';
    z.font = '28px sans-serif';
    z.fillText(`${itemName} ${x},${y}`, 8, 32);
    z.fillText('green detected  orange 9x7  red NCC', 8, 64);
    const zScale = Math.min(1, 1100 / zoom.width);
    const outZ = createCanvas(Math.round(zoom.width * zScale), Math.round(zoom.height * zScale));
    outZ.getContext('2d').drawImage(zoom, 0, 0, outZ.width, outZ.height);
    fs.writeFileSync(path.join(OUT, 'zooms', `${shot}-${slug(itemName)}-${x}-${y}.png`), outZ.toBuffer('image/png'));
  }
  ctx.restore();
  fs.writeFileSync(path.join(OUT, 'overlays', `${shot}-board.png`), board.toBuffer('image/png'));
  console.log('drew', shot);
}

function pitchTable(g) {
  const rows = [];
  for (const c of [0, 2, 4, 6, 8]) {
    const det = c * g.nativeCellW;
    const can = c * g.canonCellW;
    rows.push({ col: c, detected: round1(det), canon: round1(can), offset: round1(det - can) });
  }
  return {
    detected: `${g.cols}x${g.rows}`,
    nativeCell: `${round1(g.nativeCellW)}x${round1(g.nativeCellH)}`,
    canonCell: `${round1(g.canonCellW)}x${round1(g.canonCellH)}`,
    bag: g.bagFull,
    seamOrigin: { x: g.bagFull.x, y: g.bagFull.y },
    canonOrigin: { x: g.bagFull.x, y: g.bagFull.y },
    pitchX: round1(g.nativeCellW - g.canonCellW),
    pitchY: round1(g.nativeCellH - g.canonCellH),
    columns: rows,
  };
}

const manifest = JSON.parse(fs.readFileSync(path.join(P8, 'manifest.json'), 'utf8'));
const draw = (img, ctx, x, y, w, h) => ctx.drawImage(img, x, y, w, h);

function rgbaOf(img) {
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  return { w: img.width, h: img.height, data, gray: imageDataToGray({ width: img.width, height: img.height, data }) };
}

async function referencePatch(fixture, itemName, x, y) {
  const fix = manifest.fixtures.find((f) => f.fixture === fixture);
  const inst = fix.instances.find((it) => it.name === itemName && it.x === x && it.y === y);
  const disp = display[`${inst.image}.png`];
  const sprite = await loadImage(path.join(repo, 'assets/item-thumbs/2x', `${inst.image}.webp`));
  const hayImg = await loadImage(path.join(P8, inst.match));
  const hay = rgbaOf(hayImg);
  const scale = knownScales(CELL_PX, Number(disp.w) || 1, sprite.width)[2] || 1;
  const needle = prepareTemplateGray(sprite, (inst.r || 0) * 90, scale, (w, h) => createCanvas(w, h), draw);
  const ecx = inst.cxr + (Number(disp.anchorX) || 0) * CELL_PX;
  const ecy = inst.cyr + (Number(disp.anchorY) || 0) * CELL_PX;
  const ox = Math.floor(ecx - needle.w / 2);
  const oy = Math.floor(ecy - needle.h / 2);
  const hit = bestNcc(hay.gray, needle, 2, { x0: ox - 12, x1: ox + 12, y0: oy - 12, y1: oy + 12 });
  const data = new Uint8ClampedArray(needle.w * needle.h * 4);
  for (let i = 0; i < needle.alpha.length; i++) {
    if (needle.alpha[i] < 24) continue;
    const tx = i % needle.w;
    const ty = (i / needle.w) | 0;
    const hx = hit.x + tx;
    const hy = hit.y + ty;
    if (hx < 0 || hy < 0 || hx >= hay.w || hy >= hay.h) continue;
    const si = (hy * hay.w + hx) * 4;
    const di = i * 4;
    data[di] = hay.data[si];
    data[di + 1] = hay.data[si + 1];
    data[di + 2] = hay.data[si + 2];
    data[di + 3] = 255;
  }
  return { w: needle.w, h: needle.h, data, catalog: Number(hit.score.toFixed(3)), rot: inst.r || 0 };
}

function boardView(img, bag, cols, rows) {
  const dw = cols * CELL_PX;
  const dh = rows * CELL_PX;
  const canvas = createCanvas(dw, dh);
  canvas.getContext('2d').drawImage(img, bag.x, bag.y, bag.w, bag.h, 0, 0, dw, dh);
  return rgbaOf(canvas);
}

function peaksOf(buf, needle, stride) {
  const hits = [];
  let best = null;
  const maxX = buf.w - needle.w;
  const maxY = buf.h - needle.h;
  if (maxX < 0 || maxY < 0) return { best: null, peaks: [] };
  for (let y = 0; y <= maxY; y += stride) {
    for (let x = 0; x <= maxX; x += stride) {
      const score = bestNcc(buf, needle, 1, { x0: x, x1: x, y0: y, y1: y }).score;
      if (!best || score > best.score) best = { x, y, score };
      if (score > 0.35) hits.push({ x, y, score });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const hit of hits) {
    if (kept.some((k) => Math.abs(k.x - hit.x) < 36 && Math.abs(k.y - hit.y) < 36)) continue;
    kept.push(hit);
    if (kept.length === 4) break;
  }
  return { best, peaks: kept };
}

const searches = [];
const REFS = [
  ['Banana', 'real-010', 4, 3, [['real-007', 6, 0], ['real-008', 6, 4], ['leather-quad', null, null]]],
  ['Prismatic Orb', 'real-001', 5, 1, [['real-008', 2, 1]]],
  ['Piggybank', 'real-010', 1, 5, [['real-013', 0, 3], ['leather-quad', 2, 0], ['real-007', null, null]]],
  ['Star of Courage', 'real-010', 0, 5, [['real-013', 1, 2], ['real-008', 7, 2]]],
];
fs.mkdirSync(path.join(OUT, 'search'), { recursive: true });
for (const [itemName, srcShot, sx, sy, targets] of REFS) {
  const patch = await referencePatch(srcShot, itemName, sx, sy);
  const needle = imageDataToGray({ width: patch.w, height: patch.h, data: patch.data });
  for (const [shot, tx, ty] of targets) {
    const g = geometry[shot];
    const img = await loadImage(fixturePng(shot));
    for (const mode of ['detected', 'canon9x7']) {
      const cols = mode === 'detected' ? g.cols : 9;
      const rows = mode === 'detected' ? g.rows : 7;
      const hay = boardView(img, g.bagFull, cols, rows);
      const found = peaksOf(hay.gray, needle, 6);
      let atTruth = null;
      if (tx != null) {
        const inst = manifest.fixtures.find((f) => f.fixture === shot).instances.find((it) => it.name === itemName && it.x === tx && it.y === ty);
        const b = inst?.b;
        const cx = b ? ((b.x0 + b.x1 + 1) / 2) * CELL_PX : (tx + 0.5) * CELL_PX;
        const cy = b ? ((b.y0 + b.y1 + 1) / 2) * CELL_PX : (ty + 0.5) * CELL_PX;
        const ox = Math.floor(cx - needle.w / 2);
        const oy = Math.floor(cy - needle.h / 2);
        atTruth = Number(bestNcc(hay.gray, needle, 2, {
          x0: ox - 16, x1: ox + 16, y0: oy - 16, y1: oy + 16,
        }).score.toFixed(3));
      }
      const top = found.best;
      searches.push({
        item: itemName,
        shot,
        mode,
        catalogOnWorking: patch.catalog,
        atTruth,
        top: top ? { x: top.x, y: top.y, score: Number(top.score.toFixed(3)), cellX: Number((top.x / CELL_PX).toFixed(2)), cellY: Number((top.y / CELL_PX).toFixed(2)) } : null,
        peaks: found.peaks.map((p) => ({ score: Number(p.score.toFixed(3)), cellX: Number((p.x / CELL_PX).toFixed(2)), cellY: Number((p.y / CELL_PX).toFixed(2)) })),
      });
      if (top) {
        const canvas = createCanvas(needle.w, needle.h);
        const ctx = canvas.getContext('2d');
        const image = ctx.createImageData(needle.w, needle.h);
        for (let i = 0; i < needle.alpha.length; i++) {
          if (needle.alpha[i] < 24) continue;
          const px = top.x + (i % needle.w);
          const py = top.y + ((i / needle.w) | 0);
          if (px < 0 || py < 0 || px >= hay.w || py >= hay.h) continue;
          const si = (py * hay.w + px) * 4;
          const di = i * 4;
          image.data[di] = hay.data[si];
          image.data[di + 1] = hay.data[si + 1];
          image.data[di + 2] = hay.data[si + 2];
          image.data[di + 3] = 255;
        }
        ctx.putImageData(image, 0, 0);
        fs.writeFileSync(path.join(OUT, 'search', `${shot}-${slug(itemName)}-${mode}.png`), canvas.toBuffer('image/png'));
      }
      console.log(`${itemName} on ${shot} ${mode} truth ${atTruth} top ${top ? top.score.toFixed(3) : 'none'}`);
    }
  }
}

const report = {
  kind: 'bpb-p13-registration',
  geometry: Object.fromEntries(Object.entries(geometry).map(([name, g]) => [name, {
    full: `${g.fullW}x${g.fullH}`,
    detect: `${g.detW}x${g.detH}`,
    ...pitchTable(g),
  }])),
  audits,
  searches,
};
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log('wrote', OUT);
