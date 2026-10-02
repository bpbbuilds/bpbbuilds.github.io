/**
 * Detector-first placement:
 * bags from fabric mask → top-k lookalike NCC → place items → gap-fill.
 */

import { shapeForItem, bodyBounds } from '../../shared/backpack-grid/index.js';
import {
  NCC_RANK_FLOOR,
  downsampleGray,
  imageDataToGray,
  knownScales,
} from '../../shared/screenshot-ncc.js?v=fa3633b';
import {
  BOARD_COLS,
  BOARD_ROWS,
  canPlace,
  isBagItem,
  placementBodyCells,
} from './collision.js';
import { EDIT_MODE } from './editor-state.js';
import { coverBagsFromFabric, cropGridMetrics } from './screenshot-bags.js?v=grid97';
import { tileStandInBags } from './screenshot-bag-tile.js?v=bags2u';
import { gapFillUnexplained } from './screenshot-gapfill.js?v=bags2u';
import { placeholdersFromUnexplained } from './screenshot-unrecognized.js?v=fa3633b';
import {
  candidateFaces,
  isOblong,
  poseSearch,
  poseWithMargin,
  rerankDetectionsTopk,
} from './screenshot-topk.js?v=bags2u';
import { MIN_CONF_BAG } from '../../shared/screenshot-detector.js?v=fa3633b';

/** Align with detector default floor; top-k / NCC still reject lookalikes. */
const MIN_CONF_ITEM = 0.25;
const DUP_IOU = 0.5;
const CROSS_CLASS_IOU = 0.45;
const NCC_CELL_PX = 18;
/** Other faces within this NCC gap may take the exact cell before nudging. */
const ALT_FACE_SLACK = 0.2;

const NUDGES = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

/**
 * @typedef {{
 *   id: string,
 *   name?: string,
 *   confidence?: number,
 *   box?: { cx: number, cy: number, w: number, h: number },
 *   _topkR?: number,
 * }} Detection
 */

/**
 * @param {{ cx: number, cy: number, w: number, h: number }} a
 * @param {{ cx: number, cy: number, w: number, h: number }} b
 */
function iou(a, b) {
  const ix = Math.max(
    0,
    Math.min(a.cx + a.w / 2, b.cx + b.w / 2) - Math.max(a.cx - a.w / 2, b.cx - b.w / 2),
  );
  const iy = Math.max(
    0,
    Math.min(a.cy + a.h / 2, b.cy + b.h / 2) - Math.max(a.cy - a.h / 2, b.cy - b.h / 2),
  );
  const inter = ix * iy;
  const uni = a.w * a.h + b.w * b.h - inter;
  return uni > 0 ? inter / uni : 0;
}

/**
 * @param {Detection[]} dets
 * @param {number} [crossIou]
 */
function dedupe(dets, crossIou = Infinity) {
  /** @type {Detection[]} */
  const out = [];
  for (const d of dets) {
    const clash = out.some((o) => {
      const v = iou(o.box, d.box);
      return o.id === d.id ? v > DUP_IOU : v > crossIou;
    });
    if (!clash) out.push(d);
  }
  return out;
}

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement | null>}
 */
function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * @param {string} dataUrl
 */
async function dataUrlToGray(dataUrl) {
  const img = await loadImage(dataUrl);
  if (!img) throw new Error('Could not decode crop');
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, 0, 0);
  return imageDataToGray(ctx.getImageData(0, 0, w, h));
}

/**
 * @param {object} item
 */
function imageStem(item) {
  return String(item.image || item.id || '')
    .replace(/^.*\//, '')
    .replace(/\.(png|webp)$/i, '');
}

/**
 * Fallback: place bags from detector boxes (when fabric mask fails).
 * @param {Detection[]} bagDets
 * @param {Map<string, object>} itemsById
 * @param {number} cellW
 * @param {number} cellH
 * @param {number} originX
 * @param {number} originY
 */
function placeBagsFromDetector(bagDets, itemsById, cellW, cellH, originX, originY) {
  /** @type {object[]} */
  const placed = [];
  /** @type {{ id: string, name: string, x: number, y: number, r: number, score: number }[]} */
  const bagsOut = [];
  for (const det of bagDets) {
    const item = itemsById.get(String(det.id));
    if (!item || !det.box) continue;
    const faces = candidateFaces(item, det.box);
    const r = faces[0] || 0;
    const body = bodyBounds(shapeForItem(item, r));
    const bx = Math.round((det.box.cx - originX) / cellW - body.w / 2);
    const by = Math.round((det.box.cy - originY) / cellH - body.h / 2);
    for (const [dx, dy] of NUDGES) {
      const cand = {
        x: Math.max(0, Math.min(BOARD_COLS - body.w, bx + dx)),
        y: Math.max(0, Math.min(BOARD_ROWS - body.h, by + dy)),
        r,
      };
      if (!canPlace(item, cand, placed, itemsById, null, EDIT_MODE.BAG_LAYER)) continue;
      placed.push({ id: String(item.id), ...cand, key: `db-${bagsOut.length}` });
      bagsOut.push({
        id: String(item.id),
        name: String(item.name || item.id),
        ...cand,
        score: Number(det.confidence) || 0,
      });
      break;
    }
  }
  return bagsOut;
}

/**
 * @param {{
 *   cropDataUrl: string,
 *   grid: import('../../shared/screenshot-grid.js').BagGrid | null,
 *   detections: Detection[],
 *   itemsById: Map<string, object>,
 *   root: string,
 *   getSpriteUrl: (item: object) => string,
 * }} opts
 */
export async function placeFromDetections(opts) {
  const t0 = performance.now();
  const { cropDataUrl, grid, detections, itemsById, root, getSpriteUrl } = opts;
  const base = root.endsWith('/') ? root : `${root}/`;

  const hay = await dataUrlToGray(cropDataUrl);
  let metrics = cropGridMetrics(grid, hay.w, hay.h);

  /** @type {Record<string, { w?: number, texW?: number }>} */
  let byImage = {};
  try {
    const res = await fetch(`${base}assets/data/sprite-display.json`);
    const j = res.ok ? await res.json() : null;
    byImage = (j?.byImage ? j.byImage : j) || {};
  } catch {
    byImage = {};
  }

  const usable = (detections || [])
    .filter((d) => d?.id && d.box && itemsById.has(String(d.id)))
    .sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0));

  const bagDets = dedupe(
    usable.filter((d) => {
      const it = itemsById.get(String(d.id));
      return isBagItem(it) && (Number(d.confidence) || 0) >= MIN_CONF_BAG;
    }),
  );

  // 1) Bags from fabric mask (detector bags = hints)
  const bagCover = await coverBagsFromFabric({
    cropDataUrl,
    grid,
    detections: bagDets,
    itemsById,
    root,
  });
  if (bagCover.metrics?.cellW) metrics = bagCover.metrics;
  const { cellW, cellH, originX, originY } = metrics;
  const ds = Math.max(1, cellW / NCC_CELL_PX);
  const small = downsampleGray(hay, ds);

  /** @type {{ id: string, name: string, x: number, y: number, r: number, score: number }[]} */
  let bagsOut = bagCover.ok
    ? bagCover.bags
    : placeBagsFromDetector(bagDets, itemsById, cellW, cellH, originX, originY);
  // Other-site exports have items and no bag art. Lay a legal 9×7 cover so items can be corrected.
  let standInBags = false;
  if (!bagsOut.length) {
    const tiled = tileStandInBags(itemsById);
    if (tiled.length) {
      bagsOut = tiled;
      standInBags = true;
      console.info('[screenshot] bags stand-in tile', `n=${tiled.length}`, '9x7');
    }
  }

  // 2) Top-k lookalike rewrite of item detections
  let itemDets = dedupe(
    usable.filter((d) => {
      const it = itemsById.get(String(d.id));
      return !isBagItem(it) && (Number(d.confidence) || 0) >= MIN_CONF_ITEM;
    }),
    CROSS_CLASS_IOU,
  );
  const ranked = await rerankDetectionsTopk({
    detections: itemDets,
    itemsById,
    hay,
    cellW,
    root,
    getSpriteUrl,
    byImage,
  });
  itemDets = ranked.detections;

  /**
   * @param {object} item
   * @param {Detection} det
   * @param {number[]} faces
   */
  async function bestFace(item, det, faces) {
    const here = { r: faces[0], cx: det.box.cx, cy: det.box.cy };
    if (typeof det._topkR === 'number') {
      if (faces.includes(det._topkR) || isOblong(item)) return { ...here, r: det._topkR };
    }
    const oblong = isOblong(item);
    if (faces.length === 1 && !oblong) return here;
    const sprite =
      (await loadImage(`${base}assets/item-sprites/${imageStem(item)}.png`)) ||
      (await loadImage(getSpriteUrl(item)));
    if (!sprite) return here;
    const disp = byImage[`${imageStem(item)}.png`];
    const nativeW = Number(disp?.texW) || sprite.naturalWidth || sprite.width || 64;
    const scale = knownScales(cellW, Number(disp?.w) || 1, nativeW)[2] ?? 1;
    if (!oblong) {
      const hit = poseSearch({ small, ds, sprite, scale, box: det.box, faces, radiusPx: 3 * ds });
      return { ...here, r: hit.r, alts: hit.ranked };
    }
    const hit = poseWithMargin({ small, ds, sprite, scale, box: det.box, localFaces: faces, cellW });
    if (hit.score < NCC_RANK_FLOOR) return { ...here, r: hit.r };
    return { r: hit.r, cx: hit.cx, cy: hit.cy };
  }

  /** @type {object[]} */
  const placedAll = bagsOut.map((b, i) => ({
    id: b.id,
    x: b.x,
    y: b.y,
    r: b.r,
    key: `bag-${i}`,
  }));
  /** @type {{ id: string, name: string, x: number, y: number, r: number, score: number }[]} */
  const itemsOut = [];
  let rejected = 0;

  /**
   * @param {Detection} det
   */
  async function planItem(det) {
    const item = itemsById.get(String(det.id));
    if (!item || !det.box) return null;
    const faces = candidateFaces(item, det.box);
    const pose = await bestFace(item, det, faces);
    const r = pose.r;
    const body = bodyBounds(shapeForItem(item, r));
    const cx = (pose.cx - originX) / cellW;
    const cy = (pose.cy - originY) / cellH;
    const top = pose.alts?.[0]?.score ?? 0;
    return {
      det,
      item,
      r,
      body,
      cx,
      cy,
      bx: Math.round(cx - body.w / 2),
      by: Math.round(cy - body.h / 2),
      altFaces: (pose.alts || [])
        .filter((a) => a.r !== r && a.score >= top - ALT_FACE_SLACK)
        .map((a) => a.r),
    };
  }

  /**
   * Exact-cell retry with the next-best faces before nudging (neighbors disambiguate rotation).
   * @param {NonNullable<Awaited<ReturnType<typeof planItem>>>} p
   * @param {string} mode
   */
  function tryAltFaces(p, mode) {
    for (const r of p.altFaces) {
      const body = bodyBounds(shapeForItem(p.item, r));
      const alt = {
        ...p,
        r,
        body,
        bx: Math.round(p.cx - body.w / 2),
        by: Math.round(p.cy - body.h / 2),
      };
      if (tryPlace(alt, NUDGES.slice(0, 1), mode)) return true;
    }
    return false;
  }

  /**
   * @param {NonNullable<Awaited<ReturnType<typeof planItem>>>} p
   * @param {number[][]} offsets
   * @param {string} mode
   */
  function tryPlace(p, offsets, mode) {
    for (const [dx, dy] of offsets) {
      const cand = {
        x: Math.max(0, Math.min(BOARD_COLS - p.body.w, p.bx + dx)),
        y: Math.max(0, Math.min(BOARD_ROWS - p.body.h, p.by + dy)),
        r: p.r,
      };
      if (!canPlace(p.item, cand, placedAll, itemsById, null, mode)) continue;
      placedAll.push({
        id: String(p.item.id),
        ...cand,
        key: `det-${itemsOut.length}`,
      });
      itemsOut.push({
        id: String(p.item.id),
        name: String(p.item.name || p.item.id),
        ...cand,
        score: Number(p.det.confidence) || 0,
      });
      return true;
    }
    return false;
  }

  /** @type {NonNullable<Awaited<ReturnType<typeof planItem>>>[]} */
  const itemPlans = [];
  for (let i = 0; i < itemDets.length; i++) {
    if (i % 4 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    const p = await planItem(itemDets[i]);
    if (p) itemPlans.push(p);
  }

  let pending = itemPlans;
  for (const mode of [EDIT_MODE.DEFAULT, EDIT_MODE.ITEM_LAYER]) {
    pending = pending.filter((p) => !tryPlace(p, NUDGES.slice(0, 1), mode));
  }
  for (const mode of [EDIT_MODE.DEFAULT, EDIT_MODE.ITEM_LAYER]) {
    pending = pending.filter((p) => !tryAltFaces(p, mode));
  }
  for (const mode of [EDIT_MODE.DEFAULT, EDIT_MODE.ITEM_LAYER]) {
    pending = pending.filter((p) => !tryPlace(p, NUDGES.slice(1), mode));
  }
  rejected += pending.length;

  // Stand-in bags cover every cell. Gap-fill would invent an item in each empty one.
  const gap = standInBags
    ? { items: [], added: 0, unexplained: new Set() }
    : await gapFillUnexplained({
    cropDataUrl,
    grid,
    bags: bagsOut,
    items: itemsOut,
    itemsById,
    detections: usable,
    root,
    getSpriteUrl,
    cellW,
    cellH,
    originX,
    originY,
    byImage,
  });
  for (const it of gap.items) itemsOut.push(it);

  const unexplainedLeft = gap.unexplained || new Set();
  const placeholders = placeholdersFromUnexplained(
    unexplainedLeft,
    [...bagsOut, ...itemsOut],
    itemsById,
  );
  for (const ph of placeholders) itemsOut.push(ph);

  console.info(
    '[screenshot] direct',
    `bags=${bagsOut.length}`,
    `items=${itemsOut.length}/${itemDets.length}`,
    `gap+${gap.added}`,
    `unrec=${placeholders.length}`,
    `ms=${(performance.now() - t0).toFixed(0)}`,
  );

  return {
    bags: bagsOut,
    items: itemsOut,
    rejected,
    visionCount: bagDets.length + itemDets.length,
    unrecognized: placeholders.length,
  };
}
