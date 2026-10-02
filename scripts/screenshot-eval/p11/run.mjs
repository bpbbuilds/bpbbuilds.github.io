/**
 * P11 geometry + scale diagnostic. Eval only. Does not touch the importer.
 * Truth items on the five failing screenshots. Known rotation, ±12px,
 * uniform scale 0.6–1.5. Then one rerank per screenshot at its median scale.
 *
 *   node scripts/screenshot-eval/p11/run.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { knownScales, prepareTemplateGray } from '../../../js/shared/screenshot-ncc.js';
import { CELL_PX, FIXTURES, STRIDE, fixturePng, isOblong, loadCatalog, repo } from '../p8/shared.mjs';

const P8 = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p8');
const OUT = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p11');
const FAILING = ['real-003', 'real-007', 'real-008', 'real-013', 'leather-quad'];
const KNOWN = new Set(['Vampiric Armor', 'Shovel-B01 3000', 'Con-Trap-Tron']);
const GAME_CELL = 80;
const SCALES = [];
for (let s = 0.6; s <= 1.501; s += 0.05) SCALES.push(Math.round(s * 100) / 100);

function pngSize(file) {
  const buf = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  fs.readSync(fd, buf, 0, 24, 0);
  fs.closeSync(fd);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function sobel(buf, w, h) {
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
}

function packNeedle(grayBuf) {
  const { w, h, gray, alpha } = grayBuf;
  const idx = [];
  for (let i = 0; i < gray.length; i++) if (alpha[i] >= 24) idx.push(i);
  const index = new Int32Array(idx);
  let sum = 0;
  for (const i of index) sum += gray[i];
  const mean = index.length ? sum / index.length : 0;
  const tC = new Float32Array(index.length);
  let varSum = 0;
  for (let k = 0; k < index.length; k++) {
    const d = gray[index[k]] - mean;
    tC[k] = d;
    varSum += d * d;
  }
  return { w, h, idx: index, tC, tNorm: Math.sqrt(varSum), tCount: index.length };
}

function bestNcc(hay, hayW, hayH, needle, originX, originY, radius, stride) {
  const { w: tw, h: th, idx, tC, tNorm, tCount } = needle;
  if (tw < 8 || th < 8 || tw >= hayW || th >= hayH || tCount < 16 || tNorm < 1e-3) {
    return { score: -1, x: originX, y: originY, dx: 0, dy: 0 };
  }
  const rel = new Int32Array(idx.length);
  for (let k = 0; k < idx.length; k++) {
    const p = idx[k];
    rel[k] = ((p / tw) | 0) * hayW + (p % tw);
  }
  const maxX = hayW - tw;
  const maxY = hayH - th;
  const x0 = Math.max(0, Math.min(maxX, originX - radius));
  const y0 = Math.max(0, Math.min(maxY, originY - radius));
  const x1 = Math.max(x0, Math.min(maxX, originX + radius));
  const y1 = Math.max(y0, Math.min(maxY, originY + radius));
  const minCount = tCount * 0.7;
  let best = -1;
  let bestX = originX;
  let bestY = originY;
  for (let y = y0; y <= y1; y += stride) {
    for (let x = x0; x <= x1; x += stride) {
      const base = y * hayW + x;
      let sSum = 0;
      for (let k = 0; k < rel.length; k++) sSum += hay[base + rel[k]];
      if (rel.length < minCount) continue;
      const sMean = sSum / rel.length;
      let num = 0;
      let sVar = 0;
      for (let k = 0; k < rel.length; k++) {
        const sv = hay[base + rel[k]] - sMean;
        num += sv * tC[k];
        sVar += sv * sv;
      }
      if (sVar < 1e-3) continue;
      const score = num / (Math.sqrt(sVar) * tNorm);
      if (score > best) {
        best = score;
        bestX = x;
        bestY = y;
      }
    }
  }
  return { score: best, x: bestX, y: bestY, dx: bestX - originX, dy: bestY - originY };
}

function median(vals) {
  if (!vals.length) return null;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function round3(n) {
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
}

const { classes, shapes, display } = loadCatalog();
const makeCanvas = (w, h) => createCanvas(w, h);
const draw = (source, ctx, x, y, w, h) => ctx.drawImage(source, x, y, w, h);
const manifest = JSON.parse(fs.readFileSync(path.join(P8, 'manifest.json'), 'utf8'));

const thumbs = new Map();
for (const c of classes) {
  const file = path.join(repo, 'assets/item-thumbs/2x', `${c.image}.webp`);
  if (!fs.existsSync(file)) continue;
  thumbs.set(c.id, await loadImage(file));
}

function baseScaleOf(cls) {
  const img = thumbs.get(cls.id);
  const disp = display[`${cls.image}.png`] || {};
  return {
    scale: knownScales(CELL_PX, Number(disp.w) || 1, img.width)[2] || 1,
    displayW: Number(disp.w) || 1,
    displayH: Number(disp.h) || 1,
    anchorX: Number(disp.anchorX) || 0,
    anchorY: Number(disp.anchorY) || 0,
    thumbW: img.width,
    thumbH: img.height,
    oblong: isOblong(shapes, cls),
  };
}

const byId = new Map(classes.map((c) => [c.id, c]));

function geometry() {
  const rows = [];
  for (const name of FIXTURES) {
    const fix = manifest.fixtures.find((f) => f.fixture === name);
    const src = pngSize(fixturePng(name));
    const g = fix.grid;
    const detectScale = Math.min(1, 900 / Math.max(src.w, src.h));
    const sample = fix.instances.find((it) => it.kind === 'item' && it.displayW);
    const meta = sample ? baseScaleOf(byId.get(sample.truthId)) : null;
    rows.push({
      fixture: name,
      sourcePx: `${src.w}×${src.h}`,
      bagCropPx: g ? `${g.W}×${g.H}` : null,
      detectedBoard: g ? `${g.cols}×${g.rows}` : null,
      nativeCellPx: g ? round3(g.cellW) : null,
      nativeCellH: g ? round3(g.cellH) : null,
      expected9x7Cell: g ? `${round3(g.W / 9)}×${round3(g.H / 7)}` : null,
      matchPxPerCell: CELL_PX,
      downsample: g ? round3(g.cellW / CELL_PX) : null,
      detectorLongSideScale: round3(detectScale),
      gameCellsPerNativeCell: g ? round3(g.cellW / GAME_CELL) : null,
      exampleSprite: sample?.name || null,
      catalogCells: meta ? `${meta.displayW}×${meta.displayH}` : null,
      matchSpritePx: meta ? `${round3(meta.displayW * CELL_PX)}×${round3(meta.displayH * CELL_PX)}` : null,
      thumbScale: meta ? round3(meta.scale) : null,
    });
  }
  return {
    rows,
    spaces: [
      'Original PNG pixels.',
      'Detector space: longest side bilinear-resized to ≤900, then grayscale. detectBagGrid and bagRect live here.',
      'Bag crop: bagRect is mapped back by fullSize/detectSize and cut from the original PNG. No second resample when the mapped rect is 1:1.',
      'Match crop: truth footprint ±1.5 cells, then box-average (not bilinear) by nativeCell/48. One cell is 48 match pixels by construction.',
      'Reference: 2x thumb × knownScales center, so the sprite is displayW cells wide in that 48px grid. Translation is in match pixels. P10 searched ±8 of that pose at scale 1.',
    ],
  };
}

async function hayOf(file) {
  const img = await loadImage(file);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  const gray = new Float32Array(img.width * img.height);
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return { gray, edge: sobel(gray, img.width, img.height), w: img.width, h: img.height, img };
}

function pose(img, rot, scale, hay, inst, meta) {
  const needle = packNeedle(prepareTemplateGray(img, rot, scale, makeCanvas, draw));
  const ecx = inst.cxr + meta.anchorX * CELL_PX;
  const ecy = inst.cyr + meta.anchorY * CELL_PX;
  const ox = Math.floor(ecx - needle.w / 2);
  const oy = Math.floor(ecy - needle.h / 2);
  const hit = bestNcc(hay.gray, hay.w, hay.h, needle, ox, oy, 12, STRIDE);
  return { ...hit, needleW: needle.w, needleH: needle.h, scale };
}

const geo = geometry();
const items = [];
console.log('scale sweep…');
for (const name of FAILING) {
  const fix = manifest.fixtures.find((f) => f.fixture === name);
  for (const inst of fix.instances) {
    if (inst.kind !== 'item') continue;
    if (!inst.match || !thumbs.has(inst.truthId)) {
      items.push({ fixture: name, name: inst.name, x: inst.x, y: inst.y, known: KNOWN.has(inst.name), miss: true });
      continue;
    }
    const cls = byId.get(inst.truthId);
    const meta = baseScaleOf(cls);
    const img = thumbs.get(inst.truthId);
    const hay = await hayOf(path.join(P8, inst.match));
    const rot = (inst.r || 0) * 90;
    const at1 = pose(img, rot, meta.scale, hay, inst, meta);
    let best = at1;
    for (const mult of SCALES) {
      const hit = pose(img, rot, meta.scale * mult, hay, inst, meta);
      if (hit.score > best.score) best = { ...hit, mult };
    }
    const fine = [];
    const center = best.mult || 1;
    for (let mult = center - 0.05; mult <= center + 0.0501; mult += 0.025) {
      fine.push(Math.round(mult * 1000) / 1000);
    }
    for (const mult of fine) {
      if (mult < 0.55 || mult > 1.55) continue;
      const hit = pose(img, rot, meta.scale * mult, hay, inst, meta);
      if (hit.score > best.score) best = { ...hit, mult };
    }
    let aniso = null;
    if (best.score < 0.45) {
      const sm = best.mult || 1;
      for (const sx of [0.85, 1, 1.15]) {
        for (const sy of [0.85, 1, 1.15]) {
          if (sx === 1 && sy === 1) continue;
          const sw = Math.max(1, Math.round(img.width * meta.scale * sm * sx));
          const sh = Math.max(1, Math.round(img.height * meta.scale * sm * sy));
          const rad = (rot * Math.PI) / 180;
          const bw = Math.max(1, Math.round(sw * Math.abs(Math.cos(rad)) + sh * Math.abs(Math.sin(rad))));
          const bh = Math.max(1, Math.round(sw * Math.abs(Math.sin(rad)) + sh * Math.abs(Math.cos(rad))));
          const canvas = createCanvas(bw, bh);
          const ctx = canvas.getContext('2d');
          ctx.translate(bw / 2, bh / 2);
          ctx.rotate(rad);
          ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
          const packed = packNeedle({ w: bw, h: bh, ...(() => {
            const d = ctx.getImageData(0, 0, bw, bh);
            const g = new Float32Array(bw * bh);
            const a = new Uint8Array(bw * bh);
            for (let p = 0, i = 0; p < g.length; p++, i += 4) {
              a[p] = d.data[i + 3];
              g[p] = a[p] < 24 ? 0 : 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
            }
            return { gray: g, alpha: a };
          })() });
          const ecx = inst.cxr + meta.anchorX * CELL_PX;
          const ecy = inst.cyr + meta.anchorY * CELL_PX;
          const hit = bestNcc(hay.gray, hay.w, hay.h, packed, Math.floor(ecx - bw / 2), Math.floor(ecy - bh / 2), 12, 2);
          if (!aniso || hit.score > aniso.score) aniso = { sx, sy, score: round3(hit.score) };
        }
      }
    }
    const row = {
      fixture: name,
      name: inst.name,
      x: inst.x,
      y: inst.y,
      area: inst.area,
      known: KNOWN.has(inst.name),
      translationOnly: round3(at1.score),
      best: round3(best.score),
      scale: round3(best.mult || 1),
      dx: best.dx,
      dy: best.dy,
      edgeOfWindow: Math.abs(best.dx) >= 12 || Math.abs(best.dy) >= 12,
      aniso,
    };
    items.push(row);
    console.log(`${name} ${inst.name} @${inst.x},${inst.y} t=${row.translationOnly} best=${row.best} ×${row.scale}`);
  }
}

function counts(rows) {
  const usable = rows.filter((row) => !row.miss && !row.known);
  const bucket = (k) => usable.filter((row) => row.best >= k).length;
  return {
    n: rows.filter((row) => !row.miss).length,
    judged: usable.length,
    knownHeldOut: rows.filter((row) => row.known).length,
    translationOnlyAtLeast070: usable.filter((row) => row.translationOnly >= 0.7).length,
    at045: bucket(0.45),
    at060: bucket(0.6),
    at070: bucket(0.7),
    at080: bucket(0.8),
    medianScale: round3(median(usable.map((row) => row.scale))),
    medianDx: median(usable.map((row) => row.dx)),
    medianDy: median(usable.map((row) => row.dy)),
    onWindowEdge: usable.filter((row) => row.edgeOfWindow).length,
  };
}

const perShot = Object.fromEntries(FAILING.map((name) => [name, counts(items.filter((row) => row.fixture === name))]));

console.log('rerank at median scale…');
const rerank = {};
for (const name of FAILING) {
  const shot = items.filter((row) => row.fixture === name && !row.miss && !row.known && row.scale);
  const mult = median(shot.map((row) => row.scale)) || 1;
  const fix = manifest.fixtures.find((f) => f.fixture === name);
  const needles = new Map();
  for (const c of classes) {
    const img = thumbs.get(c.id);
    if (!img) continue;
    const meta = baseScaleOf(c);
    const faces = [];
    for (const face of [0, 1, 2, 3]) {
      const gray = prepareTemplateGray(img, face * 90, meta.scale * mult, makeCanvas, draw);
      faces[face] = { gray: packNeedle(gray), edge: packNeedle({ w: gray.w, h: gray.h, gray: sobel(gray.gray, gray.w, gray.h), alpha: gray.alpha }), anchorX: meta.anchorX, anchorY: meta.anchorY, oblong: meta.oblong };
    }
    needles.set(c.id, faces);
  }
  let top5 = 0;
  let top1 = 0;
  let n = 0;
  for (const inst of fix.instances) {
    if (inst.kind !== 'item' || !inst.match) continue;
    n++;
    const hay = await hayOf(path.join(P8, inst.match));
    const ranked = [];
    for (const c of classes) {
      const faces = needles.get(c.id);
      if (!faces) continue;
      const use = faces[0].oblong ? [0, 1, 2, 3] : [0];
      let best = null;
      for (const face of use) {
        const gN = faces[face].gray;
        if (gN.w < 8 || gN.h < 8 || gN.w >= hay.w || gN.h >= hay.h) continue;
        const ecx = inst.cxr + faces[face].anchorX * CELL_PX;
        const ecy = inst.cyr + faces[face].anchorY * CELL_PX;
        const ox = Math.floor(ecx - gN.w / 2);
        const oy = Math.floor(ecy - gN.h / 2);
        const gHit = bestNcc(hay.gray, hay.w, hay.h, gN, ox, oy, 8, STRIDE);
        const eHit = bestNcc(hay.edge, hay.w, hay.h, faces[face].edge, ox, oy, 8, STRIDE);
        const score = 0.5 * gHit.score + 0.5 * eHit.score;
        if (!best || score > best.score) best = { id: c.id, name: c.name, score };
      }
      if (best) ranked.push(best);
    }
    ranked.sort((a, b) => b.score - a.score);
    const at = ranked.findIndex((row) => row.id === inst.truthId);
    if (at === 0) top1++;
    if (at >= 0 && at < 5) top5++;
  }
  rerank[name] = { scale: round3(mult), n, top1, top5 };
  console.log(`${name} median ×${round3(mult)} top5 ${top5}/${n}`);
}

const SHEETS = [
  ['pine-protector', 'Falcon Blade', 3, 1],
  ['real-003', 'Fancy Fencing Rapier', 0, 1],
  ['real-003', 'Panzer Dragon', 0, 4],
  ['real-007', 'Doom Cap', 4, 2],
  ['real-007', 'Darksaber', 0, 1],
  ['real-008', 'Impractically Large Bloodthorne', 1, 2],
  ['real-013', 'Wooden Buckler', 2, 0],
  ['leather-quad', 'Broom', 0, 3],
];

function overlay(crop, sprite, rot, scale, x, y) {
  const canvas = createCanvas(crop.width, crop.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(crop, 0, 0);
  const sw = Math.max(1, Math.round(sprite.width * scale));
  const sh = Math.max(1, Math.round(sprite.height * scale));
  const rad = (rot * Math.PI) / 180;
  const bw = Math.max(1, Math.round(sw * Math.abs(Math.cos(rad)) + sh * Math.abs(Math.sin(rad))));
  const bh = Math.max(1, Math.round(sw * Math.abs(Math.sin(rad)) + sh * Math.abs(Math.cos(rad))));
  ctx.save();
  ctx.translate(x + bw / 2, y + bh / 2);
  ctx.rotate(rad);
  ctx.globalAlpha = 0.85;
  ctx.drawImage(sprite, -sw / 2, -sh / 2, sw, sh);
  ctx.restore();
  return canvas;
}

fs.mkdirSync(path.join(OUT, 'sheets'), { recursive: true });
for (const [fixture, itemName, x, y] of SHEETS) {
  const fix = manifest.fixtures.find((f) => f.fixture === fixture);
  const inst = fix.instances.find((it) => it.name === itemName && it.x === x && it.y === y);
  if (!inst) continue;
  const img = thumbs.get(inst.truthId);
  const meta = baseScaleOf(byId.get(inst.truthId));
  const hay = await hayOf(path.join(P8, inst.match));
  const rot = (inst.r || 0) * 90;
  const at1 = pose(img, rot, meta.scale, hay, inst, meta);
  let mult = 1;
  const found = items.find((row) => row.fixture === fixture && row.name === itemName && row.x === x && row.y === y);
  if (found?.scale) mult = found.scale;
  else {
    let best = at1;
    for (const m of SCALES) {
      const hit = pose(img, rot, meta.scale * m, hay, inst, meta);
      if (hit.score > best.score) {
        best = hit;
        mult = m;
      }
    }
  }
  const best = pose(img, rot, meta.scale * mult, hay, inst, meta);
  const panels = [
    { label: 'catalog', img: img },
    { label: 'scale 1', img: overlay(hay.img, img, rot, meta.scale, at1.x, at1.y) },
    { label: `×${round3(mult)}`, img: overlay(hay.img, img, rot, meta.scale * mult, best.x, best.y) },
    { label: 'screenshot', img: hay.img },
  ];
  const ph = Math.max(...panels.map((p) => p.img.height));
  const sheet = createCanvas(panels.reduce((s, p) => s + p.img.width, 0), ph + 28);
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = '#2a1c16';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.fillStyle = '#ffecdc';
  ctx.font = '16px sans-serif';
  let left = 0;
  for (const panel of panels) {
    ctx.drawImage(panel.img, left, 28);
    ctx.fillText(panel.label, left + 6, 18);
    left += panel.img.width;
  }
  const file = `${fixture}-${itemName.replace(/[^a-z0-9]+/gi, '-')}.png`;
  fs.writeFileSync(path.join(OUT, 'sheets', file), sheet.toBuffer('image/png'));
}

const judged = items.filter((row) => !row.miss && !row.known);
const report = {
  kind: 'bpb-p11-geometry',
  geometry: geo,
  perScreenshot: perShot,
  judged: {
    n: judged.length,
    at045: judged.filter((row) => row.best >= 0.45).length,
    at060: judged.filter((row) => row.best >= 0.6).length,
    at070: judged.filter((row) => row.best >= 0.7).length,
    at080: judged.filter((row) => row.best >= 0.8).length,
    translationOnlyAtLeast045: judged.filter((row) => row.translationOnly >= 0.45).length,
  },
  rerankMedianScale: rerank,
  items,
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report));
const brief = { ...report, items: undefined, geometry: { rows: geo.rows } };
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(brief, null, 2));
console.log(JSON.stringify(brief, null, 2));
