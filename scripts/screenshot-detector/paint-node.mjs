/**
 * Node board paint for synth: bags + fabric + sprites + static glows.
 */
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { ROOT } from '../screenshot-to-build/catalog.mjs';
import { loadShapeIndex } from '../screenshot-to-build/shapes.mjs';

const BOARD_COLS = 9;
const BOARD_ROWS = 7;

/**
 * @param {string} stem
 * @param {Record<string, any>} byImage
 */
function displaySize(stem, byImage) {
  const e = byImage[`${stem}.png`] || byImage[stem];
  return {
    w: Number(e?.w) > 0 ? Number(e.w) : 1,
    h: Number(e?.h) > 0 ? Number(e.h) : 1,
  };
}

/**
 * Body AABB in cells for a placement.
 * @param {ReturnType<typeof loadShapeIndex>} shapeIndex
 * @param {string} itemId
 * @param {{ x: number, y: number, r: number }} p
 */
export function placementAabb(shapeIndex, itemId, p) {
  const faces = shapeIndex.byId.get(itemId) || [{ w: 1, h: 1, rot: 0 }];
  const want = ((Number(p.r) || 0) % 4) * 90;
  const face = faces.find((f) => f.rot === want) || faces[0];
  const w = face?.w || 1;
  const h = face?.h || 1;
  return {
    x: Number(p.x) || 0,
    y: Number(p.y) || 0,
    w,
    h,
  };
}

/**
 * @param {{
 *   placements: { id: string, x: number, y: number, r?: number }[],
 *   catalogById: Map<string, { id: string, name: string, image: string, type: string, spritePath: string | null }>,
 *   cellPx?: number,
 *   liveArtById?: Record<string, any>,
 *   byImage?: Record<string, any>,
 *   leatherRgb?: [number, number, number],
 *   transparentBg?: boolean,
 * }} opts
 */
export async function paintSynthBoard(opts) {
  const cellPx = Math.max(16, Number(opts.cellPx) || 48);
  const catalogById = opts.catalogById;
  const liveArt = opts.liveArtById || {};
  const byImage = opts.byImage || {};
  const shapeIndex = loadShapeIndex([...catalogById.values()]);
  const leather = opts.leatherRgb || [92, 58, 38];

  const W = BOARD_COLS * cellPx;
  const H = BOARD_ROWS * cellPx;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  if (!opts.transparentBg) {
    // Leather backdrop
    ctx.fillStyle = `rgb(${leather[0]},${leather[1]},${leather[2]})`;
    ctx.fillRect(0, 0, W, H);
    // Subtle noise mottling
    const noise = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < noise.data.length; i += 4) {
      const j = ((Math.random() - 0.5) * 18) | 0;
      noise.data[i] = Math.max(0, Math.min(255, noise.data[i] + j));
      noise.data[i + 1] = Math.max(0, Math.min(255, noise.data[i + 1] + j));
      noise.data[i + 2] = Math.max(0, Math.min(255, noise.data[i + 2] + j));
    }
    ctx.putImageData(noise, 0, 0);
  }

  const bags = opts.placements.filter((p) => {
    const it = catalogById.get(p.id);
    return it && String(it.type) === 'Bag';
  });
  const items = opts.placements.filter((p) => {
    const it = catalogById.get(p.id);
    return it && String(it.type) !== 'Bag';
  });

  // Bag sprites
  for (const p of bags) {
    await drawItem(ctx, p, catalogById, byImage, liveArt, cellPx, false);
  }

  // Fabric slots
  const slotPath = path.join(ROOT, 'assets/icons/FilledSlot.png');
  if (fs.existsSync(slotPath)) {
    const slot = await loadImage(slotPath);
    /** @type {Set<string>} */
    const fabric = new Set();
    for (const p of bags) {
      const box = placementAabb(shapeIndex, p.id, {
        x: p.x,
        y: p.y,
        r: p.r || 0,
      });
      for (let dy = 0; dy < box.h; dy++) {
        for (let dx = 0; dx < box.w; dx++) {
          const x = box.x + dx;
          const y = box.y + dy;
          if (x >= 0 && y >= 0 && x < BOARD_COLS && y < BOARD_ROWS) {
            fabric.add(`${x},${y}`);
          }
        }
      }
    }
    for (const key of fabric) {
      const [sx, sy] = key.split(',').map(Number);
      ctx.drawImage(slot, sx * cellPx, sy * cellPx, cellPx, cellPx);
    }
  }

  /** @type {{ classId: string, cx: number, cy: number, bw: number, bh: number }[]} */
  const boxes = [];

  for (const p of items) {
    const box = await drawItem(ctx, p, catalogById, byImage, liveArt, cellPx, true);
    if (box) boxes.push(box);
  }
  // Also label bags
  for (const p of bags) {
    const aabb = placementAabb(shapeIndex, p.id, { x: p.x, y: p.y, r: p.r || 0 });
    const item = catalogById.get(p.id);
    if (!item) continue;
    const disp = displaySize(item.image, byImage);
    const pw = Math.max(aabb.w, disp.w) * cellPx;
    const ph = Math.max(aabb.h, disp.h) * cellPx;
    const cx = (aabb.x + aabb.w / 2) * cellPx;
    const cy = (aabb.y + aabb.h / 2) * cellPx;
    boxes.push({
      classId: p.id,
      cx,
      cy,
      bw: Math.min(W, pw * 1.05),
      bh: Math.min(H, ph * 1.05),
    });
  }

  return { canvas, width: W, height: H, cellPx, boxes, shapeIndex };
}

/**
 * @param {any} ctx
 * @param {{ id: string, x: number, y: number, r?: number }} p
 * @param {Map<string, any>} catalogById
 * @param {Record<string, any>} byImage
 * @param {Record<string, any>} liveArt
 * @param {number} cellPx
 * @param {boolean} withGlow
 */
async function drawItem(ctx, p, catalogById, byImage, liveArt, cellPx, withGlow) {
  const item = catalogById.get(p.id);
  if (!item?.spritePath || !fs.existsSync(item.spritePath)) return null;
  const img = await loadImage(item.spritePath);
  const face = ((Number(p.r) || 0) % 4 + 4) % 4;
  const disp = displaySize(item.image, byImage);
  const dw = disp.w * cellPx;
  const dh = (dw * img.height) / Math.max(1, img.width);
  // Odd faces: sprite is drawn transposed, so center on the rotated footprint and swap the label box.
  const odd = face % 2 === 1;
  const spanW = disp.w;
  const spanH = Math.max(disp.h, dh / cellPx);
  const cx = (Number(p.x) + (odd ? spanH : spanW) / 2) * cellPx;
  const cy = (Number(p.y) + (odd ? spanW : spanH) / 2) * cellPx;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((face * Math.PI) / 2);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);

  if (withGlow) {
    const spec = liveArt[item.id];
    const glowFile = spec?.glow ? String(spec.glow) : '';
    if (glowFile) {
      const glowPath = path.join(ROOT, 'assets/item-layers', glowFile);
      if (fs.existsSync(glowPath)) {
        try {
          const glow = await loadImage(glowPath);
          const s = Math.min(dw / img.width, dh / img.height);
          const sc = Array.isArray(spec.scale) ? spec.scale : [1, 1];
          const pos = Array.isArray(spec.pos) ? spec.pos : [0, 0];
          const gw = glow.width * (Number(sc[0]) || 1) * s;
          const gh = glow.height * (Number(sc[1]) || 1) * s;
          const op = Array.isArray(spec.opacity) ? spec.opacity : [0.7, 1];
          const mid = ((Number(op[0]) || 0.7) + (Number(op[1]) || 1)) / 2;
          ctx.globalAlpha = mid;
          if (spec.additive) ctx.globalCompositeOperation = 'lighter';
          ctx.drawImage(
            glow,
            -gw / 2 + (Number(pos[0]) || 0) * s,
            -gh / 2 + (Number(pos[1]) || 0) * s,
            gw,
            gh,
          );
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
        } catch {
          /* ignore */
        }
      }
    }
  }
  ctx.restore();

  return {
    classId: item.id,
    cx,
    cy,
    bw: (odd ? dh : dw) * 1.08,
    bh: (odd ? dw : dh) * 1.08,
  };
}

export { BOARD_COLS, BOARD_ROWS };
