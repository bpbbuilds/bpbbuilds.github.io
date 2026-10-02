/**
 * P9 forensic alignment. Eval only. Does not touch the importer.
 * Reuses P8 match crops. Truth only picks which crops to inspect.
 */
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { imageDataToGray, knownScales, prepareTemplateGray, bestNcc } from '../../../js/shared/screenshot-ncc.js';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const P8 = path.join(ROOT, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p8');
const OUT = path.join(ROOT, 'scripts/_cache/screenshot-eval/baselines/2026-10-01-p9');
const A = 'pine-protector';
const B = 'real-001';
const CELL = 48;

const CASES = [
  { key: 'falcon-31', name: 'Falcon Blade', x: 3, y: 1, role: 'primary-fail' },
  { key: 'falcon-43', name: 'Falcon Blade', x: 4, y: 3, role: 'same-item-other-cell' },
  { key: 'stoneskin', name: 'Strong Stone Skin Potion', x: 0, y: 0, role: 'success-control' },
  { key: 'djinn', name: 'Djinn Lamp', x: 5, y: 4, role: 'thin' },
  { key: 'shovel', name: 'Shovel-B01 3000', x: 7, y: 3, role: 'large' },
  { key: 'mana', name: 'Mana Orb', x: 4, y: 1, role: '1x1' },
  { key: 'vamp', name: 'Vampiric Armor', x: 0, y: 4, role: 'known-mismatch' },
];

function drawImage(img, ctx, x, y, w, h) {
  ctx.drawImage(img, x, y, w, h);
}

function hayOf(img) {
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);
  return imageDataToGray({ width: img.width, height: img.height, data });
}

function sobel(gray, w, h) {
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] + gray[i - w + 1]
        - 2 * gray[i - 1] + 2 * gray[i + 1]
        - gray[i + w - 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1]
        + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      mag[i] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

function scorePose(hay, needle, x, y) {
  const hit = bestNcc(hay, needle, 1, { x0: x, x1: x, y0: y, y1: y });
  return hit.score;
}

function searchPose(hay, img, rotDeg, baseScale, ecx, ecy) {
  let best = { score: -1, scale: 1, dang: 0, dx: 0, dy: 0, x: 0, y: 0, tw: 0, th: 0 };
  const scales = [0.9, 1, 1.1];
  const dangs = [-8, -4, 0, 4, 8];
  for (const sm of scales) {
    for (const dang of dangs) {
      const needle = prepareTemplateGray(img, rotDeg + dang, baseScale * sm, (w, h) => createCanvas(w, h), drawImage);
      const ox = Math.floor(ecx - needle.w / 2);
      const oy = Math.floor(ecy - needle.h / 2);
      const stride = sm === 1 && dang === 0 ? 1 : 2;
      const hit = bestNcc(hay, needle, stride, {
        x0: ox - 24, x1: ox + 24, y0: oy - 24, y1: oy + 24,
      });
      if (hit.score > best.score) {
        best = { score: hit.score, scale: sm, dang, dx: hit.x - ox, dy: hit.y - oy, x: hit.x, y: hit.y, tw: needle.w, th: needle.h };
      }
    }
  }
  const prodNeedle = prepareTemplateGray(img, rotDeg, baseScale, (w, h) => createCanvas(w, h), drawImage);
  const pox = Math.floor(ecx - prodNeedle.w / 2);
  const poy = Math.floor(ecy - prodNeedle.h / 2);
  const prod = scorePose(hay, prodNeedle, pox, poy);
  const windowed = bestNcc(hay, prodNeedle, 2, {
    x0: pox - 4, x1: pox + 4, y0: poy - 4, y1: poy + 4,
  });
  let aniso = null;
  if (best.score < 0.55) {
    let top = best.score;
    for (const sx of [0.85, 1, 1.15]) {
      for (const sy of [0.85, 1, 1.15]) {
        if (sx === 1 && sy === 1) continue;
        const n2 = prepareAniso(img, rotDeg + best.dang, baseScale * best.scale, sx, sy);
        const ax = Math.floor(ecx - n2.w / 2);
        const ay = Math.floor(ecy - n2.h / 2);
        const hit = bestNcc(hay, n2, 2, { x0: ax - 16, x1: ax + 16, y0: ay - 16, y1: ay + 16 });
        if (hit.score > top) {
          top = hit.score;
          aniso = { sx, sy, score: hit.score, dx: hit.x - ax, dy: hit.y - ay };
        }
      }
    }
  }
  return { best, productionNcc: prod, windowNcc: windowed.score, windowDx: windowed.x - pox, windowDy: windowed.y - poy, aniso, needleW: prodNeedle.w, needleH: prodNeedle.h };
}

function prepareAniso(img, rotDeg, scale, sx, sy) {
  const sw = Math.max(1, Math.round(img.width * scale * sx));
  const sh = Math.max(1, Math.round(img.height * scale * sy));
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const bw = Math.max(1, Math.round(sw * cos + sh * sin));
  const bh = Math.max(1, Math.round(sw * sin + sh * cos));
  const canvas = createCanvas(bw, bh);
  const ctx = canvas.getContext('2d');
  ctx.translate(bw / 2, bh / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
  const { data } = ctx.getImageData(0, 0, bw, bh);
  return imageDataToGray({ width: bw, height: bh, data });
}

function silhouette(hay, needle, x, y) {
  const mag = sobel(hay.gray, hay.w, hay.h);
  const edge = [];
  let peak = 0;
  for (let i = 0; i < mag.length; i++) if (mag[i] > peak) peak = mag[i];
  const cut = peak * 0.35;
  for (let i = 0; i < mag.length; i++) if (mag[i] >= cut) edge.push(i);
  let contour = 0;
  let near = 0;
  let distSum = 0;
  const tw = needle.w;
  const th = needle.h;
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      const ni = ty * tw + tx;
      if (needle.alpha[ni] < 24) continue;
      const edgePx = [tx - 1, tx + 1, tx, tx].some((nx, k) => {
        const ny = k < 2 ? ty : (k === 2 ? ty - 1 : ty + 1);
        if (nx < 0 || ny < 0 || nx >= tw || ny >= th) return true;
        return needle.alpha[ny * tw + nx] < 24;
      });
      if (!edgePx) continue;
      contour++;
      const hx = x + tx;
      const hy = y + ty;
      let md = 12;
      for (const ei of edge) {
        const ex = ei % hay.w;
        const ey = (ei / hay.w) | 0;
        const d = Math.hypot(ex - hx, ey - hy);
        if (d < md) md = d;
        if (md <= 1.5) break;
      }
      distSum += md;
      if (md <= 2) near++;
    }
  }
  let inter = 0;
  let uni = 0;
  const seen = new Uint8Array(hay.w * hay.h);
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      if (needle.alpha[ty * tw + tx] < 24) continue;
      const hx = x + tx;
      const hy = y + ty;
      if (hx < 1 || hy < 1 || hx >= hay.w - 1 || hy >= hay.h - 1) continue;
      const hi = hy * hay.w + hx;
      seen[hi] = 1;
      uni++;
      if (mag[hi] >= cut) inter++;
    }
  }
  return {
    contour,
    edgeHit: contour ? near / contour : 0,
    meanEdgeDist: contour ? distSum / contour : null,
    edgePixels: edge.length,
  };
}

function maskedCorr(hayA, hayB, needle, x, y) {
  const valsA = [];
  const valsB = [];
  for (let ty = 0; ty < needle.h; ty++) {
    for (let tx = 0; tx < needle.w; tx++) {
      if (needle.alpha[ty * needle.w + tx] < 24) continue;
      const hx = x + tx;
      const hy = y + ty;
      if (hx < 0 || hy < 0 || hx >= hayA.w || hy >= hayA.h || hx >= hayB.w || hy >= hayB.h) continue;
      valsA.push(hayA.gray[hy * hayA.w + hx]);
      valsB.push(hayB.gray[hy * hayB.w + hx]);
    }
  }
  if (valsA.length < 16) return null;
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const ma = mean(valsA);
  const mb = mean(valsB);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < valsA.length; i++) {
    const xa = valsA[i] - ma;
    const xb = valsB[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  return da < 1e-3 || db < 1e-3 ? null : num / Math.sqrt(da * db);
}

function paintSheet(caseKey, panels) {
  const pw = panels[0].img.width;
  const ph = panels[0].img.height;
  const cols = panels.length;
  const canvas = createCanvas(pw * cols, ph + 28);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2a1c16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffecdc';
  ctx.font = '16px sans-serif';
  panels.forEach((p, i) => {
    ctx.drawImage(p.img, i * pw, 28);
    ctx.fillText(p.label, i * pw + 6, 18);
  });
  fs.writeFileSync(path.join(OUT, 'sheets', `${caseKey}.png`), canvas.toBuffer('image/png'));
}

function overlay(crop, spriteImg, rotDeg, scale, x, y, mode) {
  const canvas = createCanvas(crop.width, crop.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(crop, 0, 0);
  const sw = Math.max(1, Math.round(spriteImg.width * scale));
  const sh = Math.max(1, Math.round(spriteImg.height * scale));
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const bw = Math.max(1, Math.round(sw * cos + sh * sin));
  const bh = Math.max(1, Math.round(sw * sin + sh * cos));
  const spr = createCanvas(bw, bh);
  const sctx = spr.getContext('2d');
  sctx.translate(bw / 2, bh / 2);
  sctx.rotate(rad);
  sctx.drawImage(spriteImg, -sw / 2, -sh / 2, sw, sh);
  if (mode === 'diff') {
    const base = ctx.getImageData(0, 0, crop.width, crop.height);
    const sd = sctx.getImageData(0, 0, bw, bh).data;
    const out = ctx.createImageData(crop.width, crop.height);
    out.data.set(base.data);
    for (let ty = 0; ty < bh; ty++) {
      for (let tx = 0; tx < bw; tx++) {
        const si = (ty * bw + tx) * 4;
        if (sd[si + 3] < 24) continue;
        const hx = x + tx;
        const hy = y + ty;
        if (hx < 0 || hy < 0 || hx >= crop.width || hy >= crop.height) continue;
        const hi = (hy * crop.width + hx) * 4;
        const d = (Math.abs(base.data[hi] - sd[si]) + Math.abs(base.data[hi + 1] - sd[si + 1]) + Math.abs(base.data[hi + 2] - sd[si + 2])) / 3;
        out.data[hi] = Math.min(255, d * 3);
        out.data[hi + 1] = 0;
        out.data[hi + 2] = 0;
        out.data[hi + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  } else if (mode === 'mask') {
    ctx.clearRect(0, 0, crop.width, crop.height);
    ctx.fillStyle = '#3c261d';
    ctx.fillRect(0, 0, crop.width, crop.height);
    ctx.drawImage(spr, x, y);
  } else {
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.drawImage(spr, x, y);
    ctx.restore();
    ctx.strokeStyle = '#eac914';
    ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
  }
  return canvas;
}

async function main() {
  fs.mkdirSync(path.join(OUT, 'sheets'), { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(P8, 'manifest.json'), 'utf8'));
  const display = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/data/sprite-display.json'), 'utf8'));
  const pool = JSON.parse(fs.readFileSync(path.join(P8, 'pool.json'), 'utf8'));
  const byName = new Map(pool.map((p) => [p.name, p]));

  function inst(fixture, name, x, y) {
    const row = manifest.fixtures.find((f) => f.fixture === fixture);
    const hit = row.instances.find((it) => it.name === name && it.x === x && it.y === y);
    if (!hit) throw new Error(`missing ${fixture} ${name} ${x},${y}`);
    return { row, hit };
  }

  const results = [];
  for (const cse of CASES) {
    const meta = byName.get(cse.name);
    const disp = display.byImage[`${meta.image}.png`];
    const sprite = await loadImage(path.join(ROOT, 'assets/item-thumbs/2x', `${meta.image}.webp`));
    const nativeW = sprite.width;
    const baseScale = knownScales(CELL, disp.w, nativeW)[2];
    const sides = {};
    const panels = [];
    for (const fixture of [A, B]) {
      const { hit } = inst(fixture, cse.name, cse.x, cse.y);
      const crop = await loadImage(path.join(P8, 'crops', fixture, `${hit.i}.png`));
      const hay = hayOf(crop);
      const rot = (hit.r || 0) * 90;
      const ecx = hit.cxr + (disp.anchorX || 0) * CELL;
      const ecy = hit.cyr + (disp.anchorY || 0) * CELL;
      const found = searchPose(hay, sprite, rot, baseScale, ecx, ecy);
      const prodNeedle = prepareTemplateGray(sprite, rot, baseScale, (w, h) => createCanvas(w, h), drawImage);
      const px = Math.floor(ecx - prodNeedle.w / 2);
      const py = Math.floor(ecy - prodNeedle.h / 2);
      const bestNeedle = prepareTemplateGray(sprite, rot + found.best.dang, baseScale * found.best.scale, (w, h) => createCanvas(w, h), drawImage);
      const sil = silhouette(hay, bestNeedle, found.best.x, found.best.y);
      const silProd = silhouette(hay, prodNeedle, px, py);
      sides[fixture] = {
        productionNcc: Number(found.productionNcc.toFixed(3)),
        window4Ncc: Number((found.windowNcc ?? -1).toFixed(3)),
        window4Dx: found.windowDx,
        window4Dy: found.windowDy,
        bestNcc: Number(found.best.score.toFixed(3)),
        dx: found.best.dx,
        dy: found.best.dy,
        scale: found.best.scale,
        rotationResidual: found.best.dang,
        aniso: found.aniso,
        silhouetteBest: {
          edgeHit: Number(sil.edgeHit.toFixed(3)),
          meanEdgeDist: sil.meanEdgeDist == null ? null : Number(sil.meanEdgeDist.toFixed(2)),
        },
        silhouetteProduction: {
          edgeHit: Number(silProd.edgeHit.toFixed(3)),
          meanEdgeDist: silProd.meanEdgeDist == null ? null : Number(silProd.meanEdgeDist.toFixed(2)),
        },
        crop: `${crop.width}x${crop.height}`,
        pose: { x: found.best.x, y: found.best.y, scale: found.best.scale, dang: found.best.dang },
      };
      const tag = fixture === A ? 'pine' : 'real';
      panels.push({ label: `${tag} crop`, img: crop });
      panels.push({ label: `${tag} pose`, img: overlay(crop, sprite, rot, baseScale, px, py, 'over') });
      panels.push({ label: `${tag} |diff|`, img: overlay(crop, sprite, rot, baseScale, px, py, 'diff') });
      panels.push({ label: `${tag} best`, img: overlay(crop, sprite, rot + found.best.dang, baseScale * found.best.scale, found.best.x, found.best.y, 'over') });
      console.log(cse.key, fixture, JSON.stringify(sides[fixture]));
    }
    const pine = inst(A, cse.name, cse.x, cse.y);
    const real = inst(B, cse.name, cse.x, cse.y);
    const cropA = await loadImage(path.join(P8, 'crops', A, `${pine.hit.i}.png`));
    const cropB = await loadImage(path.join(P8, 'crops', B, `${real.hit.i}.png`));
    const hayA = hayOf(cropA);
    const hayB = hayOf(cropB);
    const rot = (pine.hit.r || 0) * 90;
    const pose = sides[A].pose;
    const mask = prepareTemplateGray(sprite, rot + pose.dang, baseScale * pose.scale, (w, h) => createCanvas(w, h), drawImage);
    const live = liveNeedle(hayA, mask, pose.x, pose.y);
    const liveHit = bestNcc(hayB, live, 1, {
      x0: pose.x - 16, x1: pose.x + 16, y0: pose.y - 16, y1: pose.y + 16,
    });
    const poseB = sides[B].pose;
    const maskB = prepareTemplateGray(sprite, (real.hit.r || 0) * 90 + poseB.dang, baseScale * poseB.scale, (w, h) => createCanvas(w, h), drawImage);
    const aligned = mask.w === maskB.w && mask.h === maskB.h
      ? maskedCorr(hayA, hayB, mask, pose.x, pose.y)
      : null;
    delete sides[A].pose;
    delete sides[B].pose;
    sides.screenshotToScreenshot = {
      pineItemToReal: Number(liveHit.score.toFixed(3)),
      dx: liveHit.x - pose.x,
      dy: liveHit.y - pose.y,
      sameCropCorr: aligned == null ? null : Number(aligned.toFixed(3)),
    };
    paintSheet(cse.key, panels);
    results.push({ ...cse, ...sides });
  }

  const shared = await screenshotSweep(manifest, display, byName);
  const report = {
    kind: 'bpb-p9-forensic',
    cases: results,
    sharedScreenshotMatch: shared.summary,
    sharedRows: shared.rows,
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log('wrote', OUT);
}

function liveNeedle(hay, mask, x, y) {
  const gray = new Float32Array(mask.gray.length);
  const alpha = new Uint8Array(mask.alpha.length);
  for (let i = 0; i < mask.alpha.length; i++) {
    if (mask.alpha[i] < 24) continue;
    const tx = i % mask.w;
    const ty = (i / mask.w) | 0;
    const hx = x + tx;
    const hy = y + ty;
    if (hx < 0 || hy < 0 || hx >= hay.w || hy >= hay.h) continue;
    gray[i] = hay.gray[hy * hay.w + hx];
    alpha[i] = 255;
  }
  return { w: mask.w, h: mask.h, gray, alpha };
}

async function screenshotSweep(manifest, display, byName) {
  const a = manifest.fixtures.find((f) => f.fixture === A).instances.filter((it) => it.kind === 'item');
  const bInst = manifest.fixtures.find((f) => f.fixture === B).instances;
  const rows = [];
  for (const hit of a) {
    const other = bInst.find((it) => it.kind === 'item' && it.name === hit.name && it.x === hit.x && it.y === hit.y);
    if (!other) continue;
    const meta = byName.get(hit.name);
    const disp = display.byImage[`${meta.image}.png`];
    const sprite = await loadImage(path.join(ROOT, 'assets/item-thumbs/2x', `${meta.image}.webp`));
    const baseScale = knownScales(CELL, disp.w, sprite.width)[2];
    const cropA = await loadImage(path.join(P8, 'crops', A, `${hit.i}.png`));
    const cropB = await loadImage(path.join(P8, 'crops', B, `${other.i}.png`));
    const hayA = hayOf(cropA);
    const hayB = hayOf(cropB);
    const rot = (hit.r || 0) * 90;
    const ecx = hit.cxr + (disp.anchorX || 0) * CELL;
    const ecy = hit.cyr + (disp.anchorY || 0) * CELL;
    const mask = prepareTemplateGray(sprite, rot, baseScale, (w, h) => createCanvas(w, h), drawImage);
    const mx = Math.floor(ecx - mask.w / 2);
    const my = Math.floor(ecy - mask.h / 2);
    const placed = bestNcc(hayA, mask, 2, { x0: mx - 12, x1: mx + 12, y0: my - 12, y1: my + 12 });
    const live = liveNeedle(hayA, mask, placed.x, placed.y);
    const hitN = bestNcc(hayB, live, 2, {
      x0: placed.x - 16, x1: placed.x + 16, y0: placed.y - 16, y1: placed.y + 16,
    });
    rows.push({
      name: hit.name,
      x: hit.x,
      y: hit.y,
      catalogOnPine: Number(placed.score.toFixed(3)),
      pineItemToReal: Number(hitN.score.toFixed(3)),
      dx: hitN.x - placed.x,
      dy: hitN.y - placed.y,
    });
  }
  const strong = rows.filter((r) => r.pineItemToReal >= 0.7).length;
  const weak = rows.filter((r) => r.pineItemToReal < 0.45).length;
  const catalogStrong = rows.filter((r) => r.catalogOnPine >= 0.7).length;
  const catalogStrongButRealWeak = rows.filter((r) => r.catalogOnPine >= 0.7 && r.pineItemToReal < 0.45).length;
  return {
    summary: { n: rows.length, pineItemToRealAtLeast070: strong, pineItemToRealBelow045: weak, catalogOnPineAtLeast070: catalogStrong, catalogStrongItemWeak: catalogStrongButRealWeak },
    rows,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
