/**
 * P12 cross-screenshot item transfer. Eval only. Does not touch the importer.
 * Truth picks crops and the known rotation. The reference is screenshot pixels
 * under a catalog-aligned mask, not the catalog thumb.
 */
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { bestNcc, imageDataToGray, knownScales, prepareTemplateGray } from '../../../js/shared/screenshot-ncc.js';
import { CELL_PX, repo } from '../p8/shared.mjs';

const P8 = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p8');
const OUT = path.join(repo, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p12');
const NAMES = ['Banana', 'Blueberries', 'Prismatic Orb', 'Piggybank', 'Whetstone', 'Star of Courage', 'Amulet of Steel'];
const WORKING = new Set(['pine-protector', 'real-001', 'real-010']);
const RADIUS = 12;
const SCALES = [0.9, 0.95, 1, 1.05, 1.1];
const TRUST = 0.7;

const draw = (img, ctx, x, y, w, h) => ctx.drawImage(img, x, y, w, h);
const round3 = (n) => Math.round(n * 1000) / 1000;

function sobel(gray, w, h) {
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -gray[i - w - 1] + gray[i - w + 1] - 2 * gray[i - 1] + 2 * gray[i + 1] - gray[i + w - 1] + gray[i + w + 1];
      const gy = -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      mag[i] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

function rgbaOf(img) {
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  const gray = imageDataToGray({ width: img.width, height: img.height, data });
  return { w: img.width, h: img.height, data, gray: gray.gray, edge: sobel(gray.gray, img.width, img.height), img };
}

function expectedCenter(inst, disp) {
  return {
    x: inst.cxr + (Number(disp.anchorX) || 0) * CELL_PX,
    y: inst.cyr + (Number(disp.anchorY) || 0) * CELL_PX,
  };
}

function catalogHit(hay, sprite, inst, disp) {
  const scale = knownScales(CELL_PX, Number(disp.w) || 1, sprite.width)[2] || 1;
  const needle = prepareTemplateGray(sprite, (inst.r || 0) * 90, scale, (w, h) => createCanvas(w, h), draw);
  const c = expectedCenter(inst, disp);
  const ox = Math.floor(c.x - needle.w / 2);
  const oy = Math.floor(c.y - needle.h / 2);
  const hit = bestNcc(hay, needle, 2, { x0: ox - RADIUS, x1: ox + RADIUS, y0: oy - RADIUS, y1: oy + RADIUS });
  return { ...hit, dx: hit.x - ox, dy: hit.y - oy, needle, scale };
}

function extractRGBA(src, mask, x, y) {
  const data = new Uint8ClampedArray(mask.w * mask.h * 4);
  let opaque = 0;
  let inside = 0;
  for (let i = 0; i < mask.alpha.length; i++) {
    if (mask.alpha[i] < 24) continue;
    opaque++;
    const tx = i % mask.w;
    const ty = (i / mask.w) | 0;
    const hx = x + tx;
    const hy = y + ty;
    if (hx < 0 || hy < 0 || hx >= src.w || hy >= src.h) continue;
    const si = (hy * src.w + hx) * 4;
    const di = i * 4;
    data[di] = src.data[si];
    data[di + 1] = src.data[si + 1];
    data[di + 2] = src.data[si + 2];
    data[di + 3] = 255;
    inside++;
  }
  return { w: mask.w, h: mask.h, data, opaque, inside };
}

function rot90(src, turns) {
  let w = src.w;
  let h = src.h;
  let data = src.data;
  const n = ((turns % 4) + 4) % 4;
  for (let t = 0; t < n; t++) {
    const nw = h;
    const nh = w;
    const nd = new Uint8ClampedArray(nw * nh * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = h - 1 - y;
        const ny = x;
        const si = (y * w + x) * 4;
        const di = (ny * nw + nx) * 4;
        nd[di] = data[si];
        nd[di + 1] = data[si + 1];
        nd[di + 2] = data[si + 2];
        nd[di + 3] = data[si + 3];
      }
    }
    w = nw;
    h = nh;
    data = nd;
  }
  return { w, h, data, opaque: src.opaque, inside: src.inside };
}

function scaleRGBA(src, mult) {
  if (Math.abs(mult - 1) < 1e-6) return src;
  const canvas = createCanvas(src.w, src.h);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(src.w, src.h);
  image.data.set(src.data);
  ctx.putImageData(image, 0, 0);
  const sw = Math.max(1, Math.round(src.w * mult));
  const sh = Math.max(1, Math.round(src.h * mult));
  const out = createCanvas(sw, sh);
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.drawImage(canvas, 0, 0, sw, sh);
  const data = octx.getImageData(0, 0, sw, sh).data;
  return { w: sw, h: sh, data, opaque: src.opaque, inside: src.inside };
}

function toNeedle(src) {
  const gray = imageDataToGray({ width: src.w, height: src.h, data: src.data });
  return { ...gray, rgba: src.data };
}

function nccAt(hayGray, hayW, needle, x, y) {
  return bestNcc({ w: hayW, h: Math.floor(hayGray.length / hayW), gray: hayGray }, needle, 1, { x0: x, x1: x, y0: y, y1: y }).score;
}

function searchNeedle(hayGray, hayW, hayH, needle, ecx, ecy, stride) {
  const ox = Math.floor(ecx - needle.w / 2);
  const oy = Math.floor(ecy - needle.h / 2);
  const hit = bestNcc({ w: hayW, h: hayH, gray: hayGray }, needle, stride, {
    x0: ox - RADIUS, x1: ox + RADIUS, y0: oy - RADIUS, y1: oy + RADIUS,
  });
  return { ...hit, dx: hit.x - ox, dy: hit.y - oy, ox, oy };
}

function rgbNccAt(hay, needle, x, y) {
  const scores = [];
  for (let ch = 0; ch < 3; ch++) {
    let tSum = 0;
    let tCount = 0;
    const vals = [];
    for (let i = 0; i < needle.alpha.length; i++) {
      if (needle.alpha[i] < 24) continue;
      const tx = i % needle.w;
      const ty = (i / needle.w) | 0;
      const hx = x + tx;
      const hy = y + ty;
      if (hx < 0 || hy < 0 || hx >= hay.w || hy >= hay.h) continue;
      tSum += needle.rgba[i * 4 + ch];
      tCount++;
      vals.push(hay.data[(hy * hay.w + hx) * 4 + ch]);
    }
    if (tCount < 16) return -1;
    const tMean = tSum / tCount;
    let tVar = 0;
    let k = 0;
    const tv = new Float32Array(tCount);
    for (let i = 0; i < needle.alpha.length; i++) {
      if (needle.alpha[i] < 24) continue;
      const tx = i % needle.w;
      const ty = (i / needle.w) | 0;
      const hx = x + tx;
      const hy = y + ty;
      if (hx < 0 || hy < 0 || hx >= hay.w || hy >= hay.h) continue;
      tv[k] = needle.rgba[i * 4 + ch] - tMean;
      tVar += tv[k] * tv[k];
      k++;
    }
    if (tVar < 1e-3) return -1;
    const sMean = vals.reduce((s, v) => s + v, 0) / tCount;
    let num = 0;
    let sVar = 0;
    for (let i = 0; i < tCount; i++) {
      const sv = vals[i] - sMean;
      num += sv * tv[i];
      sVar += sv * sv;
    }
    if (sVar < 1e-3) return -1;
    scores.push(num / (Math.sqrt(sVar) * Math.sqrt(tVar)));
  }
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

function searchRgb(hay, needle, ecx, ecy) {
  const ox = Math.floor(ecx - needle.w / 2);
  const oy = Math.floor(ecy - needle.h / 2);
  let best = -1;
  let bestX = ox;
  let bestY = oy;
  const maxX = hay.w - needle.w;
  const maxY = hay.h - needle.h;
  const x0 = Math.max(0, Math.min(maxX, ox - RADIUS));
  const y0 = Math.max(0, Math.min(maxY, oy - RADIUS));
  const x1 = Math.max(x0, Math.min(maxX, ox + RADIUS));
  const y1 = Math.max(y0, Math.min(maxY, oy + RADIUS));
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      const score = rgbNccAt(hay, needle, x, y);
      if (score > best) {
        best = score;
        bestX = x;
        bestY = y;
      }
    }
  }
  return { score: best, x: bestX, y: bestY, dx: bestX - ox, dy: bestY - oy };
}

function edgeNeedle(src, edge, mask, x, y) {
  const gray = new Float32Array(mask.w * mask.h);
  const alpha = new Uint8Array(mask.w * mask.h);
  for (let i = 0; i < mask.alpha.length; i++) {
    if (mask.alpha[i] < 24) continue;
    const tx = i % mask.w;
    const ty = (i / mask.w) | 0;
    const hx = x + tx;
    const hy = y + ty;
    if (hx < 0 || hy < 0 || hx >= src.w || hy >= src.h) continue;
    alpha[i] = 255;
    gray[i] = edge[hy * src.w + hx];
  }
  return { w: mask.w, h: mask.h, gray, alpha };
}

function rotBuf(src, turns) {
  let w = src.w;
  let h = src.h;
  let gray = src.gray;
  let alpha = src.alpha;
  const n = ((turns % 4) + 4) % 4;
  for (let t = 0; t < n; t++) {
    const nw = h;
    const nh = w;
    const ng = new Float32Array(nw * nh);
    const na = new Uint8Array(nw * nh);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = h - 1 - y;
        const ny = x;
        const si = y * w + x;
        const di = ny * nw + nx;
        ng[di] = gray[si];
        na[di] = alpha[si];
      }
    }
    w = nw;
    h = nh;
    gray = ng;
    alpha = na;
  }
  return { w, h, gray, alpha };
}

function trustOf(score) {
  if (score >= TRUST) return 'trusted';
  if (score >= 0.45) return 'partial';
  return 'untrusted';
}

function paintSheet(file, panels) {
  const ph = Math.max(...panels.map((p) => p.img.height));
  const sheet = createCanvas(panels.reduce((s, p) => s + p.img.width + 8, 8), ph + 28);
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = '#2a1c16';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.fillStyle = '#ffecdc';
  ctx.font = '16px sans-serif';
  let left = 8;
  for (const panel of panels) {
    ctx.drawImage(panel.img, left, 28);
    ctx.fillText(panel.label, left, 18);
    left += panel.img.width + 8;
  }
  fs.writeFileSync(path.join(OUT, 'sheets', file), sheet.toBuffer('image/png'));
}

function canvasFromRGBA(src) {
  const canvas = createCanvas(src.w, src.h);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(src.w, src.h);
  image.data.set(src.data);
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function diffCanvas(a, b, x, y) {
  const canvas = createCanvas(a.w, a.h);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(a.w, a.h);
  for (let i = 0; i < a.alpha.length; i++) {
    if (a.alpha[i] < 24) continue;
    const tx = i % a.w;
    const ty = (i / a.w) | 0;
    const hx = x + tx;
    const hy = y + ty;
    const di = i * 4;
    if (hx < 0 || hy < 0 || hx >= b.w || hy >= b.h) {
      image.data[di + 3] = 255;
      image.data[di] = 80;
      continue;
    }
    const si = (hy * b.w + hx) * 4;
    const d = (Math.abs(a.rgba[di] - b.data[si]) + Math.abs(a.rgba[di + 1] - b.data[si + 1]) + Math.abs(a.rgba[di + 2] - b.data[si + 2])) / 3;
    image.data[di] = Math.min(255, d * 2);
    image.data[di + 1] = Math.min(255, d * 2);
    image.data[di + 2] = Math.min(255, d * 2);
    image.data[di + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function sliceFail(hay, needle, x, y) {
  const data = new Uint8ClampedArray(needle.w * needle.h * 4);
  for (let i = 0; i < needle.alpha.length; i++) {
    if (needle.alpha[i] < 24) continue;
    const tx = i % needle.w;
    const ty = (i / needle.w) | 0;
    const hx = x + tx;
    const hy = y + ty;
    if (hx < 0 || hy < 0 || hx >= hay.w || hy >= hay.h) continue;
    const si = (hy * hay.w + hx) * 4;
    const di = i * 4;
    data[di] = hay.data[si];
    data[di + 1] = hay.data[si + 1];
    data[di + 2] = hay.data[si + 2];
    data[di + 3] = 255;
  }
  return canvasFromRGBA({ w: needle.w, h: needle.h, data });
}

const manifest = JSON.parse(fs.readFileSync(path.join(P8, 'manifest.json'), 'utf8'));
const classes = JSON.parse(fs.readFileSync(path.join(P8, 'pool.json'), 'utf8'));
const display = JSON.parse(fs.readFileSync(path.join(repo, 'assets/data/sprite-display.json'), 'utf8')).byImage;
const byName = new Map(classes.map((c) => [c.name, c]));
const thumbs = new Map();
for (const name of NAMES) {
  const cls = byName.get(name);
  thumbs.set(name, await loadImage(path.join(repo, 'assets/item-thumbs/2x', `${cls.image}.webp`)));
}

function instances(fixture) {
  return manifest.fixtures.find((f) => f.fixture === fixture).instances.filter((it) => it.kind === 'item' && NAMES.includes(it.name) && it.match);
}

const crops = new Map();
async function cropOf(fixture, inst) {
  const key = `${fixture}/${inst.i}`;
  if (!crops.has(key)) crops.set(key, rgbaOf(await loadImage(path.join(P8, inst.match))));
  return crops.get(key);
}

console.log('catalog locks on working shots…');
const locks = [];
for (const fixture of WORKING) {
  for (const inst of instances(fixture)) {
    const cls = byName.get(inst.name);
    const disp = display[`${cls.image}.png`];
    const hay = await cropOf(fixture, inst);
    const hit = catalogHit({ w: hay.w, h: hay.h, gray: hay.gray }, thumbs.get(inst.name), inst, disp);
    locks.push({ fixture, inst, disp, hit, score: round3(hit.score) });
    console.log(`${fixture} ${inst.name} @${inst.x},${inst.y} catalog ${round3(hit.score)}`);
  }
}

const refs = new Map();
for (const name of NAMES) {
  const rows = locks.filter((row) => row.inst.name === name);
  rows.sort((a, b) => b.score - a.score);
  if (rows[0]) refs.set(name, rows[0]);
}

const pairs = [];
fs.mkdirSync(path.join(OUT, 'sheets'), { recursive: true });
console.log('transfer…');
for (const fixture of manifest.fixtures.map((f) => f.fixture)) {
  if (WORKING.has(fixture)) continue;
  for (const inst of instances(fixture)) {
    const ref = refs.get(inst.name);
    const cls = byName.get(inst.name);
    const disp = display[`${cls.image}.png`];
    const failHay = await cropOf(fixture, inst);
    const failCatalog = catalogHit({ w: failHay.w, h: failHay.h, gray: failHay.gray }, thumbs.get(inst.name), inst, disp);
    const workHay = await cropOf(ref.fixture, ref.inst);
    const patch0 = extractRGBA(workHay, ref.hit.needle, ref.hit.x, ref.hit.y);
    const turns = (((inst.r || 0) - (ref.inst.r || 0)) % 4 + 4) % 4;
    const turned = rot90(patch0, turns);
    const edge0 = rotBuf(edgeNeedle(workHay, workHay.edge, ref.hit.needle, ref.hit.x, ref.hit.y), turns);
    const center = expectedCenter(inst, disp);
    let best = null;
    let at1 = null;
    for (const mult of SCALES) {
      const scaled = scaleRGBA(turned, mult);
      const needle = toNeedle(scaled);
      const hit = searchNeedle(failHay.gray, failHay.w, failHay.h, needle, center.x, center.y, 2);
      const row = { mult, hit, needle, scaled };
      if (mult === 1) at1 = row;
      if (!best || hit.score > best.hit.score) best = row;
    }
    const scale1Stride2 = at1.hit.score;
    const fine = searchNeedle(failHay.gray, failHay.w, failHay.h, at1.needle, center.x, center.y, 1);
    at1 = { ...at1, hit: fine, stride2: scale1Stride2 };
    if (best.mult !== 1) {
      const refined = searchNeedle(failHay.gray, failHay.w, failHay.h, best.needle, center.x, center.y, 1);
      best = { ...best, hit: refined };
    }
    if (fine.score >= best.hit.score) best = at1;
    const edgeHit = searchNeedle(failHay.edge, failHay.w, failHay.h, edge0, center.x, center.y, 2);
    const rgbHit = searchRgb(failHay, at1.needle, center.x, center.y);
    const rgbAtGray = rgbNccAt(failHay, best.needle, best.hit.x, best.hit.y);
    const edgeAtGray = nccAt(failHay.edge, failHay.w, edge0, best.mult === 1 ? best.hit.x : at1.hit.x, best.mult === 1 ? best.hit.y : at1.hit.y);
    const self = nccAt(workHay.gray, workHay.w, toNeedle(patch0), ref.hit.x, ref.hit.y);
    const row = {
      item: inst.name,
      working: ref.fixture,
      workingAt: `${ref.inst.x},${ref.inst.y}`,
      failing: fixture,
      failingAt: `${inst.x},${inst.y}`,
      workRot: ref.inst.r || 0,
      failRot: inst.r || 0,
      catalogWorking: ref.score,
      trust: trustOf(ref.score),
      catalogFailing: round3(failCatalog.score),
      screenshotFailingScale1: round3(at1.hit.score),
      screenshotFailing: round3(best.hit.score),
      dx: best.hit.dx,
      dy: best.hit.dy,
      scale: best.mult,
      edge: round3(edgeHit.score),
      edgeDx: edgeHit.dx,
      edgeDy: edgeHit.dy,
      rgb: round3(rgbHit.score),
      rgbDx: rgbHit.dx,
      rgbDy: rgbHit.dy,
      rgbAtGrayPose: round3(rgbAtGray),
      edgeAtGrayPose: round3(edgeAtGray),
      maskInside: patch0.inside,
      maskOpaque: patch0.opaque,
      selfNcc: round3(self),
    };
    pairs.push(row);
    const failSlice = sliceFail(failHay, best.needle, best.hit.x, best.hit.y);
    paintSheet(
      `${fixture}-${inst.name.replace(/[^a-z0-9]+/gi, '-')}-${inst.x}-${inst.y}.png`,
      [
        { label: 'catalog', img: thumbs.get(inst.name) },
        { label: 'working item', img: canvasFromRGBA(turned) },
        { label: 'failing item', img: failSlice },
        { label: 'difference', img: diffCanvas(best.needle, failHay, best.hit.x, best.hit.y) },
      ],
    );
    console.log(`${row.trust} ${row.working}→${row.failing} ${row.item} @${row.failingAt} cat ${row.catalogWorking}/${row.catalogFailing} xfer ${row.screenshotFailing} ×${row.scale} edge ${row.edge} rgb ${row.rgb}`);
  }
}

console.log('reference bank…');
const bank = [...refs.values()].filter((row) => row.score >= 0.6);
const bankRank = [];
for (const row of pairs) {
  const member = bank.find((ref) => ref.inst.name === row.item);
  if (!member) continue;
  const inst = instances(row.failing).find((it) => `${it.x},${it.y}` === row.failingAt && it.name === row.item);
  const failHay = await cropOf(row.failing, inst);
  const disp = display[`${byName.get(row.item).image}.png`];
  const center = expectedCenter(inst, disp);
  const ranked = [];
  for (const ref of bank) {
    if (ref.inst.name === row.item) {
      ranked.push({ name: ref.inst.name, score: row.screenshotFailingScale1 });
      continue;
    }
    const workHay = await cropOf(ref.fixture, ref.inst);
    const patch = rot90(extractRGBA(workHay, ref.hit.needle, ref.hit.x, ref.hit.y), (((inst.r || 0) - (ref.inst.r || 0)) % 4 + 4) % 4);
    const hit = searchNeedle(failHay.gray, failHay.w, failHay.h, toNeedle(patch), center.x, center.y, 1);
    ranked.push({ name: ref.inst.name, score: round3(hit.score) });
  }
  ranked.sort((a, b) => b.score - a.score);
  const at = ranked.findIndex((r) => r.name === row.item);
  bankRank.push({
    failing: row.failing,
    item: row.item,
    at: row.failingAt,
    rank: at + 1,
    top1: at === 0,
    top5: at >= 0 && at < 5,
    winner: ranked[0].name,
    scores: ranked,
  });
}

const trusted = pairs.filter((row) => row.trust === 'trusted');
const bucket = (rows, key, k) => rows.filter((row) => row[key] >= k).length;
const report = {
  kind: 'bpb-p12-transfer',
  note: 'Match crops are already 48px per detected cell, so the expected transfer scale is 1. The 0.90–1.10 sweep covers the small cell-aspect gaps (leather 84.4×89, real-013 31.3×32.5).',
  references: [...refs.entries()].map(([name, row]) => ({
    item: name,
    working: row.fixture,
    at: `${row.inst.x},${row.inst.y}`,
    catalog: row.score,
    trust: trustOf(row.score),
    inBank: row.score >= 0.6,
  })),
  pairs,
  trustedSummary: {
    n: trusted.length,
    grayAt070: bucket(trusted, 'screenshotFailing', 0.7),
    grayAt045: bucket(trusted, 'screenshotFailing', 0.45),
    edgeAt070: bucket(trusted, 'edge', 0.7),
    rgbAt070: bucket(trusted, 'rgb', 0.7),
  },
  bank: {
    classes: bank.map((row) => row.inst.name),
    n: bankRank.length,
    top1: bankRank.filter((row) => row.top1).length,
    top5: bankRank.filter((row) => row.top5).length,
    rows: bankRank,
  },
};
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
const brief = { ...report, pairs: pairs.map(({ item, working, failing, failingAt, trust, catalogWorking, catalogFailing, screenshotFailing, screenshotFailingScale1, dx, dy, scale, edge, rgb }) => ({ item, working, failing, failingAt, trust, catalogWorking, catalogFailing, screenshotFailing, screenshotFailingScale1, dx, dy, scale, edge, rgb })) };
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(brief, null, 2));
console.log(JSON.stringify(brief.trustedSummary));
console.log('bank', brief.bank.top1, '/', brief.bank.n, 'classes', brief.bank.classes.join(', '));
