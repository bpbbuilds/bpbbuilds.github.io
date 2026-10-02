/**
 * Paint a backpack board to canvas (catalog stills + create-page PNG export).
 */

import {
  shapeForItem,
  bodyBounds,
  spriteSizeCells,
} from '../backpack-grid/index.js';
import { placedStackZ } from '../backpack-grid/item-pieces.js';
import { LIGHT_GLOW } from '../item-live-art/layout-plates.js';

export const BOARD_COLS = 9;
export const BOARD_ROWS = 7;
/** Catalog stills: one bitmap, CSS-scaled to each thumb / tip size. */
export const STILL_CELL_PX = 64;
/** Extra cells so overflowing sprites aren't clipped. */
export const STILL_OVERHANG = 1;

/**
 * @param {object | null | undefined} item
 */
function isBagItem(item) {
  return String(item?.type || '') === 'Bag';
}

/**
 * @param {object} item
 * @param {{ x?: number, y?: number, r?: number }} p
 */
function placementBodyCells(item, p) {
  if (!item) return [];
  const face = ((Number(p.r) || 0) % 4 + 4) % 4;
  const shape = shapeForItem(item, face);
  const bounds = bodyBounds(shape);
  const ox = Number(p.x) || 0;
  const oy = Number(p.y) || 0;
  return shape.body.map((c) => ({
    x: ox + c.x - bounds.minX,
    y: oy + c.y - bounds.minY,
  }));
}

/**
 * @param {HTMLImageElement} img
 * @param {{ w: number, h: number, autoH?: boolean, autoW?: boolean }} size
 * @param {number} cellPx
 */
function spritePx(img, size, cellPx) {
  const natW = Math.max(1, img.naturalWidth || 1);
  const natH = Math.max(1, img.naturalHeight || 1);
  if (size.autoH) {
    const pw = size.w * cellPx;
    return { w: pw, h: (pw * natH) / natW };
  }
  if (size.autoW) {
    const ph = size.h * cellPx;
    return { w: (ph * natW) / natH, h: ph };
  }
  return { w: size.w * cellPx, h: size.h * cellPx };
}

/**
 * @param {object} item
 * @param {ReturnType<typeof shapeForItem>} shape
 * @param {{ minX: number, minY: number, w: number, h: number }} bounds
 * @param {number} slotCount
 */
function socketLocalCenters(item, shape, bounds, slotCount) {
  /** @type {{ i: number, lx: number, ly: number }[]} */
  const out = [];
  const offsets = Array.isArray(item.socketOffsets) ? item.socketOffsets : null;
  if (offsets?.length) {
    for (let i = 0; i < offsets.length; i += 1) {
      const x = Number(offsets[i]?.x);
      const y = Number(offsets[i]?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      out.push({ i, lx: bounds.w / 2 + x, ly: bounds.h / 2 + y });
    }
    return out;
  }
  const n = Math.max(0, Math.floor(slotCount) || 0);
  if (!n || !shape.body.length) return out;
  const body = shape.body;
  for (let i = 0; i < n; i += 1) {
    const idx =
      n === 1
        ? Math.floor(body.length / 2)
        : Math.round((i * (body.length - 1)) / Math.max(1, n - 1));
    const c = body[Math.min(body.length - 1, Math.max(0, idx))];
    out.push({
      i,
      lx: c.x - bounds.minX + 0.5,
      ly: c.y - bounds.minY + 0.5,
    });
  }
  return out;
}

/**
 * @param {object} item
 * @param {{ x?: number, y?: number, r?: number }} p
 */
function placementCellAabb(item, p) {
  const face = ((Number(p.r) || 0) % 4 + 4) % 4;
  const up = shapeForItem(item, 0);
  const upBounds = item.__bpbBounds || (item.__bpbBounds = bodyBounds(up));
  const rotBounds = face ? bodyBounds(shapeForItem(item, face)) : upBounds;
  const px = Number(p.x) || 0;
  const py = Number(p.y) || 0;
  return {
    minX: px,
    minY: py,
    maxX: px + Math.max(1, rotBounds.w) - 1,
    maxY: py + Math.max(1, rotBounds.h) - 1,
  };
}

/**
 * @param {{ p: object, item: object }[]} ordered
 * @param {{ cols: number, rows: number, overhang: number, crop: boolean }} geo
 */
function buildCropRect(ordered, geo) {
  if (!geo.crop) {
    return {
      minX: -geo.overhang,
      minY: -geo.overhang,
      cols: geo.cols + geo.overhang * 2,
      rows: geo.rows + geo.overhang * 2,
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { p, item } of ordered) {
    const box = placementCellAabb(item, p);
    if (box.minX < minX) minX = box.minX;
    if (box.minY < minY) minY = box.minY;
    if (box.maxX > maxX) maxX = box.maxX;
    if (box.maxY > maxY) maxY = box.maxY;
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, cols: 1, rows: 1 };
  }
  // Keep overhang outside the board so overflowing sprites aren't clipped at edges.
  minX = Math.floor(minX) - geo.overhang;
  minY = Math.floor(minY) - geo.overhang;
  maxX = Math.ceil(maxX) + geo.overhang;
  maxY = Math.ceil(maxY) + geo.overhang;
  return {
    minX,
    minY,
    cols: Math.max(1, maxX - minX + 1),
    rows: Math.max(1, maxY - minY + 1),
  };
}

/**
 * @param {string} url
 * @param {{ anonymous?: boolean }} [opts]
 * @returns {Promise<HTMLImageElement>}
 */
export function loadBoardImage(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (opts.anonymous !== false) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

/** World-space SE offset — matches live `0.0625em` on `.bpb-bg__spin--shadow`. */
function shadowOffsetPx(cellPx) {
  return 0.0625 * cellPx;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} sprite
 * @param {{
 *   cx: number,
 *   cy: number,
 *   face: number,
 *   dw: number,
 *   dh: number,
 *   ax: number,
 *   ay: number,
 *   cellPx: number,
 *   alpha?: number,
 * }} opts
 */
function drawSpriteShadow(ctx, sprite, opts) {
  const off = shadowOffsetPx(opts.cellPx);
  const alpha = Number.isFinite(opts.alpha) ? opts.alpha : 0.5;
  ctx.save();
  ctx.translate(opts.cx + off, opts.cy + off);
  ctx.rotate((opts.face * Math.PI) / 2);
  ctx.globalAlpha = alpha;
  ctx.filter = 'brightness(0)';
  ctx.drawImage(sprite, -opts.dw / 2 + opts.ax, -opts.dh / 2 + opts.ay, opts.dw, opts.dh);
  ctx.restore();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} sprite
 * @param {{
 *   cx: number,
 *   cy: number,
 *   face: number,
 *   dw: number,
 *   dh: number,
 *   ax: number,
 *   ay: number,
 * }} opts
 */
function drawSpriteFace(ctx, sprite, opts) {
  ctx.save();
  ctx.translate(opts.cx, opts.cy);
  ctx.rotate((opts.face * Math.PI) / 2);
  ctx.drawImage(sprite, -opts.dw / 2 + opts.ax, -opts.dh / 2 + opts.ay, opts.dw, opts.dh);
  ctx.restore();
}

/**
 * Static mid-opacity glow plate (screenshot compare / still fidelity).
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} glow
 * @param {HTMLImageElement} sprite
 * @param {object} spec
 * @param {{
 *   cx: number, cy: number, face: number,
 *   dw: number, dh: number, ax: number, ay: number,
 * }} geom
 */
function drawSpriteGlow(ctx, glow, sprite, spec, geom) {
  const natW = Math.max(1, sprite.naturalWidth || sprite.width || 1);
  const natH = Math.max(1, sprite.naturalHeight || sprite.height || 1);
  const s = Math.min(geom.dw / natW, geom.dh / natH);
  if (!(s > 0)) return;
  const pos = Array.isArray(spec?.pos) ? spec.pos : [0, 0];
  const sc = Array.isArray(spec?.scale) ? spec.scale : [1, 1];
  const light =
    LIGHT_GLOW.test(String(spec?.glow || '')) || Boolean(spec?.kind === 'flicker');
  const sx = Number(sc[0]);
  const sy = Number(sc[1]);
  const scaleX = Number.isFinite(sx) && sx > 0 ? sx : light ? 0.7 : 1;
  const scaleY = Number.isFinite(sy) && sy > 0 ? sy : scaleX;
  const gw = (glow.naturalWidth || glow.width) * scaleX * s;
  const gh = (glow.naturalHeight || glow.height) * scaleY * s;
  const gx = (Number(pos[0]) || 0) * s;
  const gy = (Number(pos[1]) || 0) * s;
  const op = Array.isArray(spec?.opacity) ? spec.opacity : [0.7, 1];
  const a0 = Number(op[0]);
  const a1 = Number(op[1]);
  const mid =
    (Number.isFinite(a0) ? a0 : 0.7) * 0.5 + (Number.isFinite(a1) ? a1 : 1) * 0.5;

  ctx.save();
  ctx.translate(geom.cx, geom.cy);
  ctx.rotate((geom.face * Math.PI) / 2);
  ctx.globalAlpha = Math.max(0.15, Math.min(1, mid));
  if (spec?.additive) ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(
    glow,
    -gw / 2 + geom.ax + gx,
    -gh / 2 + geom.ay + gy,
    gw,
    gh,
  );
  ctx.restore();
}

/**
 * @param {{
 *   placements: object[],
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   loadImage: (url: string, opts?: { anonymous?: boolean }) => Promise<HTMLImageElement>,
 *   root?: string,
 *   cellPx?: number,
 *   cols?: number,
 *   rows?: number,
 *   crop?: boolean,
 *   padPx?: number,
 *   overhangCells?: number,
 *   mode?: 'all' | 'items' | 'bags',
 *   glows?: boolean,
 *   liveArtById?: Record<string, object> | Map<string, object>,
 *   bags?: boolean,
 *   fabric?: boolean,
 *   shadows?: boolean,
 * }} opts
 */
export async function paintBoardCanvas(opts) {
  const allPlacements = Array.isArray(opts.placements) ? opts.placements : [];
  const itemsById = opts.itemsById instanceof Map ? opts.itemsById : new Map();
  const mode = opts.mode === 'items' || opts.mode === 'bags' ? opts.mode : 'all';
  const cellPx = Math.max(8, Number(opts.cellPx) || STILL_CELL_PX);
  const cols = Math.max(1, Number(opts.cols) || BOARD_COLS);
  const rows = Math.max(1, Number(opts.rows) || BOARD_ROWS);
  const crop = opts.crop === true;
  const padPx = Math.max(0, Number(opts.padPx) || 0);
  const overhang = Number.isFinite(Number(opts.overhangCells))
    ? Math.max(0, Number(opts.overhangCells))
    : STILL_OVERHANG;
  const loadImage = opts.loadImage;
  const getSpriteUrl = opts.getSpriteUrl;
  const wantGlows = opts.glows === true;
  const drawBags = opts.bags !== false;
  const drawFabric = opts.fabric !== false;
  const drawShadows = opts.shadows !== false;
  /** @type {(id: string) => object | null} */
  const liveSpec = (id) => {
    const map = opts.liveArtById;
    if (!map) return null;
    if (map instanceof Map) return map.get(String(id)) || null;
    return map[String(id)] || null;
  };
  const rootRaw = opts.root || document.body?.dataset?.root || '../';
  const root = rootRaw.endsWith('/') ? rootRaw : `${rootRaw}/`;
  const slotUrl = `${root}assets/icons/FilledSlot.png`;

  const placements = allPlacements.filter((p) => {
    const item = itemsById.get(p.id);
    if (!item) return false;
    if (mode === 'bags') return isBagItem(item);
    if (mode === 'items') return !isBagItem(item);
    return true;
  });
  if (!placements.length) {
    throw new Error(
      mode === 'bags'
        ? 'No bags to export.'
        : mode === 'items'
          ? 'No items to export.'
          : 'Place items before exporting.',
    );
  }

  const cropSource = allPlacements
    .map((p) => {
      const item = itemsById.get(p.id);
      return item ? { p, item } : null;
    })
    .filter(Boolean);
  const cropRect = buildCropRect(cropSource, { cols, rows, overhang, crop });

  const ordered = placements
    .map((p, i) => {
      const item = itemsById.get(p.id);
      return { p, item, i, z: placedStackZ(item, i) };
    })
    .filter((row) => row.item)
    .sort((a, b) => a.z - b.z || a.i - b.i);

  const slotImg = drawFabric ? await loadImage(slotUrl, { anonymous: false }) : null;
  for (const { p, item } of ordered) {
    const url = getSpriteUrl(item);
    if (url) await loadImage(url);
    if (wantGlows) {
      const spec = liveSpec(String(item.id));
      const glowFile = spec?.glow ? String(spec.glow) : '';
      if (glowFile) {
        await loadImage(`${root}assets/item-layers/${glowFile}`).catch(() => null);
      }
    }
    for (const gid of Array.isArray(p.gems) ? p.gems : []) {
      if (!gid) continue;
      const gem = itemsById.get(gid);
      if (!gem) continue;
      const gUrl = getSpriteUrl(gem);
      if (gUrl) await loadImage(gUrl);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = cropRect.cols * cellPx + padPx * 2;
  canvas.height = cropRect.rows * cellPx + padPx * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(padPx - cropRect.minX * cellPx, padPx - cropRect.minY * cellPx);

  const bags = ordered.filter((row) => isBagItem(row.item));
  const items = ordered.filter((row) => !isBagItem(row.item));

  /**
   * @param {{ p: object, item: object }} row
   * @param {{ shadow?: boolean, alpha?: number, gems?: boolean }} drawOpts
   */
  async function paintPlacement(row, drawOpts = {}) {
    const { p, item } = row;
    const face = ((Number(p.r) || 0) % 4 + 4) % 4;
    const up = shapeForItem(item, 0);
    const upBounds = item.__bpbBounds || (item.__bpbBounds = bodyBounds(up));
    const rotBounds = face ? bodyBounds(shapeForItem(item, face)) : upBounds;
    const px = Number(p.x) || 0;
    const py = Number(p.y) || 0;
    const cx = (px + rotBounds.w / 2) * cellPx;
    const cy = (py + rotBounds.h / 2) * cellPx;
    const url = getSpriteUrl(item);
    if (!url) return;
    const sprite = await loadImage(url);
    const size = spriteSizeCells(item, upBounds);
    const { w: dw, h: dh } = spritePx(sprite, size, cellPx);
    const ax = (Number(item?.spriteAnchorX) || 0) * cellPx;
    const ay = (Number(item?.spriteAnchorY) || 0) * cellPx;
    const geom = { cx, cy, face, dw, dh, ax, ay, cellPx };

    if (drawShadows && drawOpts.shadow !== false) {
      drawSpriteShadow(ctx, sprite, {
        ...geom,
        alpha: Number.isFinite(drawOpts.alpha) ? drawOpts.alpha : 0.5,
      });
    }
    drawSpriteFace(ctx, sprite, geom);

    if (wantGlows && drawOpts.glows !== false) {
      const spec = liveSpec(String(item.id));
      const glowFile = spec?.glow ? String(spec.glow) : '';
      if (glowFile) {
        try {
          const glow = await loadImage(`${root}assets/item-layers/${glowFile}`);
          drawSpriteGlow(ctx, glow, sprite, spec, geom);
        } catch {
          /* missing layer ok */
        }
      }
    }

    if (drawOpts.gems === false) return;
    const gemIds = Array.isArray(p.gems) ? p.gems : [];
    const gemFaces = Array.isArray(p.gemR) ? p.gemR : [];
    if (!gemIds.some(Boolean)) return;
    const n = Math.max(
      Math.floor(Number(item.sockets) || 0),
      gemIds.length,
      Array.isArray(item.socketOffsets) ? item.socketOffsets.length : 0,
    );
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((face * Math.PI) / 2);
    for (const { i, lx, ly } of socketLocalCenters(item, up, upBounds, n)) {
      const gid = gemIds[i];
      if (!gid) continue;
      const gem = itemsById.get(gid);
      if (!gem) continue;
      const gUrl = getSpriteUrl(gem);
      if (!gUrl) continue;
      const gImg = await loadImage(gUrl);
      const gw = (Number(gem.spriteW) > 0 ? Number(gem.spriteW) : 0.72) * cellPx;
      const gh = (Number(gem.spriteH) > 0 ? Number(gem.spriteH) : 0.72) * cellPx;
      const gx = (lx - upBounds.w / 2) * cellPx;
      const gy = (ly - upBounds.h / 2) * cellPx;
      const gf = Math.round(Number(gemFaces[i]));
      const gemRot = Number.isFinite(gf) ? ((gf % 4) + 4) % 4 : 0;
      ctx.save();
      ctx.translate(gx, gy);
      if (gemRot) ctx.rotate((gemRot * Math.PI) / 2);
      ctx.drawImage(gImg, -gw / 2, -gh / 2, gw, gh);
      ctx.restore();
    }
    ctx.restore();
  }

  // Live order: bag Icons → FilledSlot fabric above bags → gear (z ≥ 10000).
  if (drawBags) {
    for (const row of bags) {
      await paintPlacement(row, { alpha: 0.45, gems: false, glows: false });
    }
  }

  if (drawFabric && slotImg) {
    /** @type {Set<string>} */
    const fabric = new Set();
    for (const { p, item } of bags) {
      for (const c of placementBodyCells(item, p)) {
        if (c.x < 0 || c.y < 0 || c.x >= cols || c.y >= rows) continue;
        fabric.add(`${c.x},${c.y}`);
      }
    }
    for (const key of fabric) {
      const [sx, sy] = key.split(',').map(Number);
      ctx.drawImage(slotImg, sx * cellPx, sy * cellPx, cellPx, cellPx);
    }
  }

  for (const row of items) {
    await paintPlacement(row, { alpha: 0.5, gems: true });
  }

  return {
    canvas,
    crop: cropRect,
    cellPx,
    overhang: crop ? 0 : overhang,
  };
}
