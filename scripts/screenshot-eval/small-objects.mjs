/**
 * P6 — Dedicated small-object passes (eval-only).
 *
 * Skills and loose jewels are ranked only against their catalog type, on the
 * one labeled cell, cropped from the native screenshot. Socketed gems are
 * ranked only against Gem classes, on a local window at the host's known
 * socket offset. Predicted gems are written onto the host placement.
 *
 * Host identity for sockets uses the labeled host pose (oracle). The live v1
 * placements are checked separately; a socket is "host-strong" only when v1
 * already has that host name, cell, and rotation.
 *
 *   node scripts/screenshot-eval/small-objects.mjs
 *
 * Writes scripts/_cache/screenshot-eval/baselines/2026-10-01-p6-small/
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const outDir = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p6-small');
const v1Dir = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-09-30-v1');
fs.mkdirSync(outDir, { recursive: true });

const fixtures = ['real-001', 'real-003', 'real-007', 'real-008', 'real-010', 'real-013', 'leather-quad', 'pine-protector'];
const CELL_CAP = 96;
const JITTER = 4;
const STRIDE = 2;

const classes = JSON.parse(fs.readFileSync(path.join(repo, 'scripts/_cache/synth-detector-v5/classes.json'), 'utf8')).classes || [];
const shapes = JSON.parse(fs.readFileSync(path.join(repo, 'assets/data/item-shapes.json'), 'utf8')).byImage || {};
const display = JSON.parse(fs.readFileSync(path.join(repo, 'assets/data/sprite-display.json'), 'utf8')).byImage || {};
const sockets = JSON.parse(fs.readFileSync(path.join(repo, 'assets/data/socket-offsets.json'), 'utf8')).byImage || {};

const norm = (s) => String(s).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
const byNorm = new Map(classes.map((c) => [norm(c.name), c]));

function meta(c) {
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
}

const skillMeta = classes.filter((c) => c.type === 'Skill').map(meta);
const gemMeta = classes.filter((c) => c.type === 'Gem').map(meta);
const byId = Object.fromEntries([...skillMeta, ...gemMeta].map((c) => [c.id, c]));
const skillPool = skillMeta.map((c) => ({ id: c.id, r: 0 }));
const gemPool = gemMeta.flatMap((c) => [0, 1, 2, 3].map((r) => ({ id: c.id, r })));

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

/** CSS clockwise, y-down. Gems sit inside the host spin, so the offset rotates with the face. */
function rotOffset(x, y, r) {
  const q = ((Number(r) || 0) % 4 + 4) % 4;
  if (q === 1) return { x: -y, y: x };
  if (q === 2) return { x: -x, y: -y };
  if (q === 3) return { x: y, y: -x };
  return { x, y };
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
  const list = [...skillMeta, ...gemMeta].map((c) => ({
    id: c.id,
    url: `http://127.0.0.1:${port}/assets/item-thumbs/2x/${encodeURIComponent(c.image)}.webp`,
  }));
  return page.evaluate(async (list) => {
    window.__p6 = { sprites: new Map(), hay: new Map() };
    const missing = [];
    await Promise.all(list.map(({ id, url }) => new Promise((resolve) => {
      const i = new Image();
      i.onload = () => { window.__p6.sprites.set(id, i); resolve(); };
      i.onerror = () => { missing.push(id); resolve(); };
      i.src = url;
    })));
    return { loaded: window.__p6.sprites.size, missing: missing.length, missingIds: missing.slice(0, 12) };
  }, list);
}

async function loadFixture(page, dataUrl) {
  return page.evaluate(async (src) => {
    const { preprocessScreenshotForVision } = await import('/js/pages/create/screenshot-preprocess.js?v=p6');
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
    window.__p6.hay.set(src, { W, H, gray, alpha });
    const rectW = Number(pre.grid.bagRect?.w) || pre.grid.cellW * pre.grid.cols;
    const rectH = Number(pre.grid.bagRect?.h) || pre.grid.cellH * pre.grid.rows;
    const cellW = rectW > 0 ? (W * pre.grid.cellW) / rectW : pre.grid.cellW;
    const cellH = rectH > 0 ? (H * pre.grid.cellH) / rectH : pre.grid.cellH;
    const grid = { ...pre.grid, originX: 0, originY: 0, cellW, cellH };
    return { gridOk: true, grid, W, H };
  }, dataUrl);
}

async function rankBox(page, o) {
  return page.evaluate(async (o) => {
    const { bestNcc, prepareTemplateBrowser, knownScales } = await import('/js/shared/screenshot-ncc.js?v=p6');
    const hay0 = window.__p6.hay.get(o.dataUrl);
    if (!hay0) return { error: 'no hay' };
    const { W, H, gray, alpha } = hay0;
    const box = o.box;
    const pad = o.pad;
    const rx0 = Math.max(0, Math.floor(box.x0 - pad));
    const ry0 = Math.max(0, Math.floor(box.y0 - pad));
    const rx1 = Math.min(W, Math.ceil(box.x1 + pad));
    const ry1 = Math.min(H, Math.ceil(box.y1 + pad));
    const rw = Math.max(8, rx1 - rx0);
    const rh = Math.max(8, ry1 - ry0);
    const native = Math.max(box.x1 - box.x0, box.y1 - box.y0);
    const f = native / o.cellPx;
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
    const cxr = ((box.x0 + box.x1) / 2 - rx0) / f;
    const cyr = ((box.y0 + box.y1) / 2 - ry0) / f;
    const results = [];
    for (const face of o.pool) {
      const img = window.__p6.sprites.get(face.id);
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
    const bestByName = [];
    const seen = new Set();
    for (const row of results) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      bestByName.push(row);
    }
    return { top: bestByName.slice(0, 5), ranked: bestByName.length };
  }, o);
}

function cellBox(grid, x, y) {
  return {
    x0: grid.originX + x * grid.cellW,
    y0: grid.originY + y * grid.cellH,
    x1: grid.originX + (x + 1) * grid.cellW,
    y1: grid.originY + (y + 1) * grid.cellH,
  };
}

function socketBox(grid, host, cls, slot) {
  const offs = sockets[`${cls.image}.png`];
  if (!offs || !offs[slot]) return null;
  const ox = Number(offs[slot].x);
  const oy = Number(offs[slot].y);
  if (!Number.isFinite(ox) || !Number.isFinite(oy)) return null;
  const rel = bodyCells(cls, host.r);
  const w = Math.max(...rel.map((p) => p.x)) + 1;
  const h = Math.max(...rel.map((p) => p.y)) + 1;
  const world = rotOffset(ox, oy, host.r);
  const sx = host.x + w / 2 + world.x;
  const sy = host.y + h / 2 + world.y;
  const half = 0.55;
  return {
    offset: { x: ox, y: oy },
    world: { x: sx, y: sy },
    box: {
      x0: grid.originX + (sx - half) * grid.cellW,
      y0: grid.originY + (sy - half) * grid.cellH,
      x1: grid.originX + (sx + half) * grid.cellW,
      y1: grid.originY + (sy + half) * grid.cellH,
    },
  };
}

function v1HostStrong(name, host) {
  const file = path.join(v1Dir, name, 'result.json');
  if (!fs.existsSync(file)) return false;
  const result = JSON.parse(fs.readFileSync(file, 'utf8'));
  return (result.placements || []).some((p) => !p.bag
    && norm(p.name) === norm(host.name)
    && p.x === host.x
    && p.y === host.y
    && (host.r == null || (p.r || 0) === host.r));
}

function rankOf(top, truthName) {
  const i = top.findIndex((row) => norm(row.name) === norm(truthName));
  return i < 0 ? null : i + 1;
}

const server = await serve();
const port = /** @type {import('node:net').AddressInfo} */ (server.address()).port;
const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(0);
page.on('pageerror', (e) => console.error('[page error]', e.message));
await page.goto(`http://127.0.0.1:${port}/dev/screenshot-import/`);
await page.waitForFunction(() => window.__stbReady === true, null, { timeout: 60000 }).catch(() => {});
const preload = await preloadThumbs(page, port);
console.log('thumbs', preload);

/** @type {any[]} */
const skills = [];
/** @type {any[]} */
const jewels = [];
/** @type {any[]} */
const socketsOut = [];

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
  const cellPx = Math.max(32, Math.min(CELL_CAP, Math.round(grid.cellW)));
  console.log(`\n== ${name} grid=${grid.cols}x${grid.rows} cell=${Math.round(grid.cellW)} match=${cellPx}`);

  const base = { dataUrl, cellPx, jitter: JITTER, stride: STRIDE, byId };

  for (const t of truth.skills || []) {
    const cls = byNorm.get(norm(t.name));
    const inCatalog = Boolean(cls && cls.type === 'Skill');
    const inGrid = t.x >= 0 && t.y >= 0 && t.x < grid.cols && t.y < grid.rows;
    const onBag = bagSet ? bagSet.has(`${t.x},${t.y}`) : null;
    const legal = inCatalog && inGrid && onBag !== false;
    /** @type {any} */
    const row = {
      fixture: name, name: t.name, x: t.x, y: t.y, r: t.r,
      inCatalog, inGrid, onBag, legal, pool: skillPool.length,
    };
    if (legal) {
      const ranked = await rankBox(page, {
        ...base,
        pool: skillPool,
        box: cellBox(grid, t.x, t.y),
        pad: grid.cellW * 0.75,
      });
      row.top = ranked.top;
      row.rank = rankOf(ranked.top || [], t.name);
      row.top1 = ranked.top?.[0]?.name || null;
      row.score = ranked.top?.[0]?.score ?? null;
    }
    skills.push(row);
    console.log(`  skill ${t.name} legal=${legal} rank=${row.rank ?? '-'} top1=${row.top1 || '-'}`);
  }

  for (const t of truth.jewels || []) {
    const cls = byNorm.get(norm(t.name));
    const inCatalog = Boolean(cls && cls.type === 'Gem');
    const inGrid = t.x >= 0 && t.y >= 0 && t.x < grid.cols && t.y < grid.rows;
    const onBag = bagSet ? bagSet.has(`${t.x},${t.y}`) : null;
    const legal = inCatalog && inGrid && onBag !== false;
    /** @type {any} */
    const row = {
      fixture: name, name: t.name, x: t.x, y: t.y, r: t.r,
      inCatalog, inGrid, onBag, legal, pool: gemMeta.length,
    };
    if (legal) {
      const ranked = await rankBox(page, {
        ...base,
        pool: gemPool,
        box: cellBox(grid, t.x, t.y),
        pad: grid.cellW * 0.35,
      });
      row.top = ranked.top;
      row.rank = rankOf(ranked.top || [], t.name);
      row.top1 = ranked.top?.[0]?.name || null;
      row.score = ranked.top?.[0]?.score ?? null;
    }
    jewels.push(row);
    console.log(`  jewel ${t.name} legal=${legal} rank=${row.rank ?? '-'} top1=${row.top1 || '-'}`);
  }

  for (const host of truth.items || []) {
    const filled = (host.gems || []).map((g, i) => (g && g.name ? { i, g } : null)).filter(Boolean);
    if (!filled.length) continue;
    const cls = byNorm.get(norm(host.name));
    const strong = v1HostStrong(name, host);
    const gems = [];
    for (const { i, g } of filled) {
      const located = cls ? socketBox(grid, host, cls, i) : null;
      /** @type {any} */
      const slot = {
        slot: i,
        truth: g.name,
        truthR: g.r,
        inCatalog: Boolean(byNorm.get(norm(g.name))?.type === 'Gem'),
        offset: located?.offset || null,
        hostStrong: strong,
      };
      if (!located) {
        slot.missing = 'no-offset';
      } else {
        const ranked = await rankBox(page, {
          ...base,
          pool: gemPool,
          box: located.box,
          pad: grid.cellW * 0.25,
        });
        slot.top = ranked.top;
        slot.rank = rankOf(ranked.top || [], g.name);
        slot.top1 = ranked.top?.[0]?.name || null;
        slot.score = ranked.top?.[0]?.score ?? null;
        slot.source = 'socket-offset';
      }
      gems.push(slot);
      console.log(`  socket ${host.name}#${i} ${g.name} strong=${strong} rank=${slot.rank ?? '-'} top1=${slot.top1 || slot.missing || '-'}`);
    }
    const placement = {
      fixture: name,
      name: host.name,
      x: host.x,
      y: host.y,
      r: host.r,
      hostStrong: strong,
      gems: gems.map((slot) => (slot.top1
        ? { slot: slot.slot, name: slot.top1, score: slot.score, source: 'socket-offset' }
        : null)),
    };
    socketsOut.push({ host: placement, slots: gems });
  }
}

await browser.close();
server.close();

function tally(rows) {
  const n = rows.length;
  const legal = rows.filter((r) => r.legal).length;
  const top1 = rows.filter((r) => r.rank === 1).length;
  const top5 = rows.filter((r) => r.rank != null && r.rank <= 5).length;
  return { n, legal, top1, top5 };
}

const socketSlots = socketsOut.flatMap((h) => h.slots);
const socketTop1 = socketSlots.filter((s) => s.rank === 1).length;
const socketTop5 = socketSlots.filter((s) => s.rank != null && s.rank <= 5).length;
const socketStrong = socketSlots.filter((s) => s.hostStrong).length;

const report = {
  experiment: 'p6-small-objects',
  date: '2026-10-01',
  catalog: { skills: skillMeta.length, gems: gemMeta.length },
  cellCap: CELL_CAP,
  control: { skills: '0/7', looseJewels: '0/1', socketGemsWritten: 0, v1HostStrong: '0/11' },
  skills: tally(skills),
  looseJewels: tally(jewels),
  sockets: {
    hosts: socketsOut.length,
    gems: socketSlots.length,
    top1: socketTop1,
    top5: socketTop5,
    hostStrong: socketStrong,
    pose: 'oracle truth host name and rotation; gems written on that host, not as board items',
  },
  thumbs: preload,
};

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, 'skills.json'), JSON.stringify(skills, null, 2));
fs.writeFileSync(path.join(outDir, 'jewels.json'), JSON.stringify(jewels, null, 2));
fs.writeFileSync(path.join(outDir, 'sockets.json'), JSON.stringify(socketsOut, null, 2));
console.log('\n' + JSON.stringify(report, null, 2));
