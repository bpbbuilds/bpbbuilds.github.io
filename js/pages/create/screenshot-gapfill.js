/**
 * Gap-fill: place items into non-leather cells the board paint doesn't explain.
 */

import { paintBoardForCompare } from '../../shared/board-still/paint-compare.js';
import { loadCachedImage } from '../../shared/board-still/cache.js';
import { shapeForItem, bodyBounds } from '../../shared/backpack-grid/index.js';
import {
  NON_LEATHER_THRESH,
  PAINT_EMPTY_A,
  bagMedianRgb,
} from '../../shared/screenshot-paint-score.js?v=bags2p';
import {
  NCC_RANK_FLOOR,
  downsampleGray,
  imageDataToGray,
  knownScales,
  matchTemplateAtScales,
  prepareTemplateBrowser,
} from '../../shared/screenshot-ncc.js?v=bags2p';
import {
  BOARD_COLS,
  BOARD_ROWS,
  canPlace,
  isBagItem,
  isGemItem,
  placementBodyCells,
} from './collision.js';
import { EDIT_MODE } from './editor-state.js';
import { candidateFaces } from './screenshot-topk.js?v=bags2p';

const MAX_TRIES = 12;
const MIN_CLUSTER = 2;
const NCC_CELL_PX = 18;
/** Candidate body must cover at least this share of the cluster. */
const MIN_FOOTPRINT_SHARE = 0.5;
/** Clusters above this many cells are scanned per position. */
const LARGE_CLUSTER = 6;
const SCAN_NCC_FLOOR = 0.5;
/** Per-body-cell tie-break so big items beat 1x1s at similar NCC. */
const FOOTPRINT_BONUS = 0.02;
/** No detector box backs a gap-fill guess, so demand a clearer sprite match. */
const GAP_NCC_FLOOR = Math.max(NCC_RANK_FLOOR, 0.45);

/** Common detector misses to always consider for gap-fill. */
const GAP_POOL_NAMES = [
  'Laboratory',
  'Shovel-B01 3000',
  'Strong Stone Skin Potion',
  'Strong Stoneskin Potion',
  'Whetstone',
  'Falcon Blade',
  'Djinn Lamp',
  'Mana Orb',
  'Prismatic Orb',
  // Starter / leather-bag fixtures the item model often misses entirely
  'Wooden Buckler',
  'Piggybank',
  'Wooden Sword',
  'Shortbow',
  'Broom',
  'Garlic',
  'Carrot',
  'Walnuts',
  'Stone',
  'Torch',
  'Hero Sword',
  'Pan',
  'Gloves of Haste',
  'Leather Armor',
  'Cap of Resilience',
  'Goobert',
  'Blood Goobert',
  'Banana',
  'Peanut',
];

/**
 * @param {string} dataUrl
 * @returns {Promise<ImageData>}
 */
async function dataUrlToImageData(dataUrl) {
  const img = await loadCachedImage(dataUrl, { anonymous: false });
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, w, h);
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
 * @param {object} item
 */
function imageStem(item) {
  return String(item.image || item.id || '')
    .replace(/^.*\//, '')
    .replace(/\.(png|webp)$/i, '');
}

/**
 * Unexplained board cells: non-leather in shot, empty in paint.
 * @param {ImageData} shot
 * @param {ImageData} paint  same size as shot
 * @param {{ cellW: number, cellH: number, originX: number, originY: number }} metrics
 * @returns {Set<string>}
 */
export function unexplainedCells(shot, paint, metrics) {
  const leather = bagMedianRgb(shot);
  const { cellW, cellH, originX, originY } = metrics;
  /** @type {Set<string>} */
  const cells = new Set();
  const sd = shot.data;
  const pd = paint.data;
  const step = 2;
  const inset = 0.2;

  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      const x0 = Math.max(0, Math.floor(originX + col * cellW + cellW * inset));
      const y0 = Math.max(0, Math.floor(originY + row * cellH + cellH * inset));
      const x1 = Math.min(shot.width, Math.ceil(originX + (col + 1) * cellW - cellW * inset));
      const y1 = Math.min(shot.height, Math.ceil(originY + (row + 1) * cellH - cellH * inset));
      let unex = 0;
      let n = 0;
      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          const i = (y * shot.width + x) * 4;
          n += 1;
          if (pd[i + 3] >= PAINT_EMPTY_A) continue;
          const d =
            Math.abs(sd[i] - leather.r) +
            Math.abs(sd[i + 1] - leather.g) +
            Math.abs(sd[i + 2] - leather.b);
          if (d >= NON_LEATHER_THRESH) unex += 1;
        }
      }
      if (n > 0 && unex / n >= 0.28) cells.add(`${col},${row}`);
    }
  }
  return cells;
}

/**
 * 4-connected clusters → AABB in cells.
 * @param {Set<string>} cells
 * @returns {{ cols: number[], rows: number[], w: number, h: number, area: number, minX: number, minY: number }[]}
 */
function clusterCells(cells) {
  const left = new Set(cells);
  /** @type {{ cols: number[], rows: number[], w: number, h: number, area: number, minX: number, minY: number }[]} */
  const out = [];
  while (left.size) {
    const start = left.values().next().value;
    left.delete(start);
    const queue = [start];
    /** @type {string[]} */
    const members = [start];
    while (queue.length) {
      const cur = queue.pop();
      const [cs, rs] = cur.split(',');
      const c = Number(cs);
      const r = Number(rs);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const k = `${c + dx},${r + dy}`;
        if (!left.has(k)) continue;
        left.delete(k);
        queue.push(k);
        members.push(k);
      }
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const m of members) {
      const [cs, rs] = m.split(',');
      const c = Number(cs);
      const r = Number(rs);
      minX = Math.min(minX, c);
      minY = Math.min(minY, r);
      maxX = Math.max(maxX, c);
      maxY = Math.max(maxY, r);
    }
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    out.push({
      cols: members.map((m) => Number(m.split(',')[0])),
      rows: members.map((m) => Number(m.split(',')[1])),
      w,
      h,
      area: members.length,
      minX,
      minY,
    });
  }
  out.sort((a, b) => b.area - a.area);
  return out;
}

/**
 * @param {{
 *   cropDataUrl: string,
 *   grid: import('../../shared/screenshot-grid.js').BagGrid | null,
 *   bags: { id: string, x: number, y: number, r: number }[],
 *   items: { id: string, x: number, y: number, r: number, score?: number }[],
 *   itemsById: Map<string, object>,
 *   detections?: { id: string, name?: string, confidence?: number }[],
 *   root: string,
 *   getSpriteUrl: (item: object) => string,
 *   cellW: number,
 *   cellH: number,
 *   originX: number,
 *   originY: number,
 *   byImage?: Record<string, { w?: number, texW?: number }>,
 * }} opts
 */
export async function gapFillUnexplained(opts) {
  const t0 = performance.now();
  const {
    cropDataUrl,
    bags,
    items,
    itemsById,
    detections = [],
    root,
    getSpriteUrl,
    cellW,
    cellH,
    originX,
    originY,
    byImage = {},
  } = opts;

  const shot = await dataUrlToImageData(cropDataUrl);
  const metrics = { cellW, cellH, originX, originY };

  const placements = [
    ...bags.map((b, i) => ({ ...b, key: `gb-${i}` })),
    ...items.map((it, i) => ({ ...it, key: `gi-${i}` })),
  ];

  /** @type {ImageData} */
  let paint;
  if (!items.length) {
    // Blank paint: every non-leather bag cell is unexplained so NCC can recover
    // when the item detector returned nothing (common on tight leather crops).
    paint = new ImageData(shot.width, shot.height);
  } else {
    const { canvas } = await paintBoardForCompare({
      placements,
      itemsById,
      cellPx: cellW,
      cols: BOARD_COLS,
      rows: BOARD_ROWS,
      root,
      loadImage: loadCachedImage,
    });

    // Align paint canvas to crop size
    const align = document.createElement('canvas');
    align.width = shot.width;
    align.height = shot.height;
    const actx = align.getContext('2d', { willReadFrequently: true });
    if (!actx) throw new Error('Canvas unavailable');
    actx.clearRect(0, 0, shot.width, shot.height);
    actx.drawImage(canvas, originX, originY, cellW * BOARD_COLS, cellH * BOARD_ROWS);
    paint = actx.getImageData(0, 0, shot.width, shot.height);
  }

  const bagCells = new Set(
    bags.flatMap((b) =>
      placementBodyCells(itemsById.get(String(b.id)), b).map((c) => `${c.x},${c.y}`),
    ),
  );
  let unex = new Set([...unexplainedCells(shot, paint, metrics)].filter((k) => bagCells.has(k)));
  if (unex.size < MIN_CLUSTER) {
    console.info('[screenshot] gapfill +0', `unex=${unex.size}`, `ms=${(performance.now() - t0).toFixed(0)}`);
    return { items: [], added: 0, unexplained: unex };
  }

  const hay = imageDataToGray(shot);
  const ds = Math.max(1, cellW / NCC_CELL_PX);
  const small = downsampleGray(hay, ds);
  const base = root.endsWith('/') ? root : `${root}/`;

  /** @type {Map<string, object>} */
  const byName = new Map();
  for (const item of itemsById.values()) {
    byName.set(String(item.name || '').toLowerCase(), item);
  }

  /** @type {object[]} */
  const pool = [];
  const addPool = (item, allowGem = false) => {
    if (!item || isBagItem(item)) return;
    if (isGemItem(item) && !allowGem) return;
    if (pool.some((p) => p.id === item.id)) return;
    pool.push(item);
  };
  for (const name of GAP_POOL_NAMES) addPool(byName.get(name.toLowerCase()));
  for (const d of detections) {
    if ((Number(d.confidence) || 0) < 0.2) continue;
    if ((Number(d.confidence) || 0) >= 0.5) continue; // already tried as high-conf
    addPool(itemsById.get(String(d.id)), true);
  }
  const bodyCount = (item) => shapeForItem(item, 0).body.length;

  /** @type {object[]} */
  const placedAll = placements.map((p) => ({ ...p }));
  /** @type {{ id: string, name: string, x: number, y: number, r: number, score: number }[]} */
  const added = [];
  let tries = 0;

  const hasGemPool = pool.some((p) => isGemItem(p));
  const clusters = clusterCells(unex).filter((c) => c.area >= MIN_CLUSTER || (c.area === 1 && hasGemPool));

  // Shape-match catalog only when refining an existing placement (detector had items).
  // Blank-paint recovery sticks to GAP_POOL_NAMES — full catalog invents Stone-for-Buckler.
  if (items.length) {
    for (const cl of clusters) {
      for (const item of itemsById.values()) {
        if (isBagItem(item) || isGemItem(item)) continue;
        const cells = bodyCount(item);
        if (cells < 2 || cells > cl.area + 2) continue;
        const fits = [0, 1, 2, 3].some((r) => {
          const b = bodyBounds(shapeForItem(item, r));
          return Math.abs(b.w - cl.w) <= 1 && Math.abs(b.h - cl.h) <= 1;
        });
        if (fits) addPool(item);
      }
    }
  }
  pool.sort((a, b) => bodyCount(b) - bodyCount(a));
  if (pool.length > 80) pool.length = 80;

  const gapFloor = items.length ? GAP_NCC_FLOOR : Math.max(GAP_NCC_FLOOR, 0.5);
  const scanFloor = items.length ? SCAN_NCC_FLOOR : Math.max(SCAN_NCC_FLOOR, 0.52);

  /** @type {Map<string, { sprite: HTMLImageElement, scale: number } | null>} */
  const spriteCache = new Map();
  const spriteFor = async (item) => {
    const key = String(item.id);
    if (spriteCache.has(key)) return spriteCache.get(key);
    const sprite =
      (await loadImage(`${base}assets/item-sprites/${imageStem(item)}.png`)) ||
      (await loadImage(getSpriteUrl(item)));
    let val = null;
    if (sprite) {
      const disp = byImage[`${imageStem(item)}.png`];
      const nativeW = Number(disp?.texW) || sprite.naturalWidth || sprite.width || 64;
      val = { sprite, scale: knownScales(cellW, Number(disp?.w) || 1, nativeW)[2] ?? 1 };
    }
    spriteCache.set(key, val);
    return val;
  };

  /**
   * Large clusters are mostly bag trim / sprite gaps: scan every spot whose body cells
   * are all unexplained instead of fitting one item to the whole cluster.
   * @param {Set<string>} clusterKeys
   */
  async function scanCluster(clusterKeys) {
    /** @type {{ item: object, r: number, score: number, ranked: number, x: number, y: number } | null} */
    let best = null;
    for (const item of pool) {
      const sp = await spriteFor(item);
      if (!sp) continue;
      const cells = bodyCount(item);
      // 1x1 sprites at ~18px/cell match noise; only multi-cell items are scanned.
      if (cells < 2 && !isGemItem(item)) continue;
      for (const r of [0, 1, 2, 3]) {
        const body = bodyBounds(shapeForItem(item, r));
        const probe = prepareTemplateBrowser(sp.sprite, r * 90, sp.scale / ds);
        for (let y = 0; y + body.h <= BOARD_ROWS; y++) {
          for (let x = 0; x + body.w <= BOARD_COLS; x++) {
            const cand = { x, y, r };
            const keys = placementBodyCells(item, cand).map((c) => `${c.x},${c.y}`);
            if (!keys.every((k) => clusterKeys.has(k) && unex.has(k))) continue;
            if (!canPlace(item, cand, placedAll, itemsById, null, EDIT_MODE.DEFAULT)) continue;
            const cx = originX + (x + body.w / 2) * cellW;
            const cy = originY + (y + body.h / 2) * cellH;
            const pad = 3;
            const x0 = Math.floor(cx / ds - probe.w / 2) - pad;
            const y0 = Math.floor(cy / ds - probe.h / 2) - pad;
            const hit = matchTemplateAtScales(small, sp.sprite, {
              scales: [sp.scale],
              rotations: [r * 90],
              stride: 1,
              bounds: { x0, y0, x1: x0 + pad * 2, y1: y0 + pad * 2 },
              prepare: (img, rot, s) => prepareTemplateBrowser(img, rot, s / ds),
            });
            if (hit.score < scanFloor) continue;
            const ranked = hit.score + FOOTPRINT_BONUS * cells;
            if (!best || ranked > best.ranked) {
              best = { item, r, score: hit.score, ranked, x, y };
            }
          }
        }
      }
    }
    return best;
  }

  const queue = clusters.slice();
  while (queue.length) {
    const cl = queue.shift();
    if (tries >= MAX_TRIES) break;
    await new Promise((r) => setTimeout(r, 0));

    const box = {
      w: cl.w * cellW,
      h: cl.h * cellH,
      cx: originX + (cl.minX + cl.w / 2) * cellW,
      cy: originY + (cl.minY + cl.h / 2) * cellH,
    };

    /** @type {{ item: object, r: number, score: number, ranked: number, x: number, y: number } | null} */
    let best = null;
    const large = cl.area > LARGE_CLUSTER;
    const clusterKeys = new Set(cl.cols.map((c, i) => `${c},${cl.rows[i]}`));
    if (large) best = await scanCluster(clusterKeys);

    for (const item of large ? [] : pool) {
      const cells = bodyCount(item);
      if (cells < cl.area * MIN_FOOTPRINT_SHARE) continue;
      const faces = candidateFaces(item, box);
      const body0 = bodyBounds(shapeForItem(item, faces[0] || 0));
      // Footprint must roughly fit cluster AABB (±1)
      if (
        Math.abs(body0.w - cl.w) > 1 &&
        Math.abs(body0.h - cl.h) > 1 &&
        !(body0.w <= cl.w + 1 && body0.h <= cl.h + 1)
      ) {
        // still allow if one face matches
        const okFace = [0, 1, 2, 3].some((r) => {
          const b = bodyBounds(shapeForItem(item, r));
          return Math.abs(b.w - cl.w) <= 1 && Math.abs(b.h - cl.h) <= 1;
        });
        if (!okFace) continue;
      }

      const sprite =
        (await loadImage(`${base}assets/item-sprites/${imageStem(item)}.png`)) ||
        (await loadImage(getSpriteUrl(item)));
      if (!sprite) continue;
      const disp = byImage[`${imageStem(item)}.png`];
      const nativeW = Number(disp?.texW) || sprite.naturalWidth || sprite.width || 64;
      const scale = knownScales(cellW, Number(disp?.w) || 1, nativeW)[2] ?? 1;

      for (const r of faces) {
        const body = bodyBounds(shapeForItem(item, r));
        if (Math.abs(body.w - cl.w) > 1 || Math.abs(body.h - cl.h) > 1) {
          if (!(body.w <= cl.w + 1 && body.h <= cl.h + 1)) continue;
        }
        const bx = cl.minX;
        const by = cl.minY;
        const probe = prepareTemplateBrowser(sprite, r * 90, scale / ds);
        const pad = 4;
        const x0 = Math.floor(box.cx / ds - probe.w / 2) - pad;
        const y0 = Math.floor(box.cy / ds - probe.h / 2) - pad;
        const hit = matchTemplateAtScales(small, sprite, {
          scales: [scale],
          rotations: [r * 90],
          stride: 1,
          bounds: { x0, y0, x1: x0 + pad * 2, y1: y0 + pad * 2 },
          prepare: (img, rot, s) => prepareTemplateBrowser(img, rot, s / ds),
        });
        if (hit.score < gapFloor) continue;
        const ranked = hit.score + FOOTPRINT_BONUS * cells;
        if (!best || ranked > best.ranked) {
          best = { item, r, score: hit.score, ranked, x: bx, y: by };
        }
      }
    }

    tries += 1;
    if (!best) continue;

    const body = bodyBounds(shapeForItem(best.item, best.r));
    let placed = false;
    for (const mode of [EDIT_MODE.DEFAULT, EDIT_MODE.ITEM_LAYER]) {
      for (const [dx, dy] of [
        [0, 0],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const cand = {
          x: Math.max(0, Math.min(BOARD_COLS - body.w, best.x + dx)),
          y: Math.max(0, Math.min(BOARD_ROWS - body.h, best.y + dy)),
          r: best.r,
        };
        if (!canPlace(best.item, cand, placedAll, itemsById, null, mode)) continue;
        placedAll.push({
          id: String(best.item.id),
          ...cand,
          key: `gap-${added.length}`,
        });
        added.push({
          id: String(best.item.id),
          name: String(best.item.name || best.item.id),
          ...cand,
          score: best.score,
        });
        // Remove covered unexplained cells
        for (let yy = cand.y; yy < cand.y + body.h; yy++) {
          for (let xx = cand.x; xx < cand.x + body.w; xx++) {
            unex.delete(`${xx},${yy}`);
          }
        }
        placed = true;
        break;
      }
      if (placed) break;
    }
    // A large cluster may hold several misses; revisit it after each placement.
    if (placed && large) queue.unshift(cl);
  }

  console.info(
    '[screenshot] gapfill',
    `+${added.length}`,
    `tries=${tries}`,
    `ms=${(performance.now() - t0).toFixed(0)}`,
  );
  return { items: added, added: added.length, unexplained: unex };
}
