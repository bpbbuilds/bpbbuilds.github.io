/**
 * Tiling solver: Edge vision as soft prior, known-scale thumb/sprite NCC ranks poses,
 * greedy non-overlap places the board.
 */

import {
  consumePriorBudget,
  expandConfusionPool,
} from '../../shared/screenshot-confusion.js?v=fa3633b';
import { cellToPx, pxToCell } from '../../shared/screenshot-grid.js?v=fa3633b';
import {
  NCC_RANK_FLOOR,
  downsampleGray,
  imageDataToGray,
  knownScales,
  matchTemplateAtScales,
  maskRegion,
  prepareTemplateBrowser,
} from '../../shared/screenshot-ncc.js?v=fa3633b';
import {
  BOARD_COLS,
  BOARD_ROWS,
  canPlace,
  isBagItem,
} from './collision.js';
import { EDIT_MODE } from './editor-state.js';

/** Max detector/vision priors to feed the tiling solver (keeps NCC interactive). */
const MAX_PRIOR_ITEMS = 18;
/** Max unique catalog templates to NCC-scan. */
const MAX_POOL_ITEMS = 24;
/** Target cell width (px) for the downsampled NCC haystack. */
const NCC_CELL_PX = 18;
/** Stop scanning templates after this long; detector ids are scanned first. */
const SOLVER_BUDGET_MS = 8000;

/** @type {Promise<Record<string, { w?: number, texW?: number }> | null> | null} */
let displayPromise = null;

/**
 * Drop low-conf / duplicate detector boxes so the solver stays fast.
 * @param {{ id: string, name?: string, x?: number, y?: number, r?: number, confidence?: number }[]} items
 * @param {{ max?: number, minConf?: number }} [opts]
 */
export function pruneScreenshotPriors(items, opts = {}) {
  const max = opts.max ?? MAX_PRIOR_ITEMS;
  const minConf = opts.minConf ?? 0.22;
  const sorted = (items || [])
    .filter((it) => it?.id)
    .map((it) => ({
      ...it,
      confidence: Number.isFinite(Number(it.confidence)) ? Number(it.confidence) : 0.5,
    }))
    .filter((it) => it.confidence >= minConf)
    .sort((a, b) => b.confidence - a.confidence);

  /** @type {typeof sorted} */
  const out = [];
  for (const it of sorted) {
    if (out.length >= max) break;
    const x = Math.round(Number(it.x) || 0);
    const y = Math.round(Number(it.y) || 0);
    const dup = out.some(
      (o) =>
        o.id === it.id &&
        Math.abs(Math.round(Number(o.x) || 0) - x) <= 1 &&
        Math.abs(Math.round(Number(o.y) || 0) - y) <= 1,
    );
    if (dup) continue;
    out.push({ ...it, x, y });
  }
  return out;
}

function yieldToUi() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * @param {string} root
 */
function loadSpriteDisplay(root) {
  if (!displayPromise) {
    const base = root.endsWith('/') ? root : `${root}/`;
    displayPromise = fetch(`${base}assets/data/sprite-display.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.byImage ? j.byImage : j))
      .catch(() => null);
  }
  return displayPromise;
}

/**
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`thumb load failed: ${url}`));
    img.src = url;
  });
}

/**
 * Prefer full sprite for NCC (Falcon thumbs under-score); fall back to catalog thumb URL.
 * @param {object} item
 * @param {(item: object) => string} getSpriteUrl
 * @param {string} root
 */
function templateUrls(item, getSpriteUrl, root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const stem = imageStem(item);
  /** @type {string[]} */
  const urls = [];
  if (stem) urls.push(`${base}assets/item-sprites/${stem}.png`);
  const thumb = getSpriteUrl(item);
  if (thumb && !urls.includes(thumb)) urls.push(thumb);
  return urls;
}

/**
 * @param {string} dataUrl
 * @returns {Promise<import('../../shared/screenshot-ncc.js').GrayBuf>}
 */
async function dataUrlToGrayBuf(dataUrl) {
  const img = await loadImage(dataUrl);
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
 * @param {Map<string, object>} itemsById
 * @param {string} name
 */
function findByName(itemsById, name) {
  const want = String(name || '').toLowerCase();
  for (const item of itemsById.values()) {
    if (String(item.name || '').toLowerCase() === want) return item;
  }
  return null;
}

/**
 * @param {object} item
 */
function imageStem(item) {
  const raw = String(item.image || item.id || '');
  return raw.replace(/^.*\//, '').replace(/\.(png|webp)$/i, '');
}

/**
 * Build multiplicity budget from Edge prior (id → count).
 * @param {{ id: string, name?: string }[]} visionItems
 * @param {Map<string, object>} itemsById
 */
function priorBudget(visionItems, itemsById) {
  /** @type {Map<string, number>} */
  const budget = new Map();
  /** @type {Map<string, { x: number, y: number, r: number }[]>} */
  const hints = new Map();
  for (const v of visionItems) {
    const item = itemsById.get(v.id) || findByName(itemsById, v.name || '');
    if (!item || isBagItem(item)) continue;
    const id = String(item.id);
    budget.set(id, (budget.get(id) || 0) + 1);
    if (!hints.has(id)) hints.set(id, []);
    hints.get(id).push({
      x: Math.round(Number(v.x) || 0),
      y: Math.round(Number(v.y) || 0),
      r: ((Math.round(Number(v.r) || 0) % 4) + 4) % 4,
    });
  }
  return { budget, hints };
}

/**
 * @param {{
 *   cropDataUrl: string,
 *   grid: import('../../shared/screenshot-grid.js').BagGrid | null,
 *   visionItems: { id: string, name?: string, x?: number, y?: number, r?: number, confidence?: number }[],
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root: string,
 *   draftPlacements?: object[],
 * }} opts
 * @returns {Promise<{
 *   items: { id: string, name: string, x: number, y: number, r: number, score: number }[],
 *   visionCount: number,
 *   rejected: number,
 * }>}
 */
export async function solveBoardPuzzle(opts) {
  const t0 = performance.now();
  const {
    cropDataUrl,
    grid,
    visionItems: rawVision,
    itemsById,
    getSpriteUrl,
    root,
    draftPlacements = [],
  } = opts;

  const visionItems = pruneScreenshotPriors(rawVision, { max: MAX_PRIOR_ITEMS });
  if (visionItems.length < (rawVision?.length || 0)) {
    console.info(
      '[screenshot] solver prior',
      `${rawVision.length}→${visionItems.length}`,
      '(capped)',
    );
  }

  const hay = await dataUrlToGrayBuf(cropDataUrl);
  const cellW = grid?.ok && grid.cellW > 0 ? grid.cellW : hay.w / 9;
  // NCC cost scales with (pixels)^2 — match on a ~18px-per-cell copy, map hits back.
  const ds = Math.max(1, cellW / NCC_CELL_PX);
  const small = downsampleGray(hay, ds);
  const work = {
    w: small.w,
    h: small.h,
    gray: new Float32Array(small.gray),
    alpha: new Uint8Array(small.alpha),
  };

  const { budget, hints } = priorBudget(visionItems, itemsById);
  const visionCount = [...budget.values()].reduce((a, b) => a + b, 0);
  if (!visionCount) {
    return { items: [], visionCount: 0, rejected: 0 };
  }

  const priorNames = visionItems
    .map((v) => v.name || itemsById.get(v.id)?.name || '')
    .filter(Boolean);
  const poolNames = expandConfusionPool(priorNames, MAX_POOL_ITEMS);
  /** @type {object[]} */
  const poolItems = [];
  for (const name of poolNames) {
    const item = findByName(itemsById, name);
    if (!item || isBagItem(item)) continue;
    if (!poolItems.some((x) => x.id === item.id)) poolItems.push(item);
  }
  for (const id of budget.keys()) {
    const item = itemsById.get(id);
    if (item && !poolItems.some((x) => x.id === item.id)) poolItems.push(item);
  }
  // Detector ids first so a time-budget cutoff only drops lookalikes.
  poolItems.sort((a, b) => Number(budget.has(String(b.id))) - Number(budget.has(String(a.id))));
  if (poolItems.length > MAX_POOL_ITEMS) poolItems.length = MAX_POOL_ITEMS;

  const byImage = (await loadSpriteDisplay(root)) || {};
  const localGrid = grid?.ok ? { ...grid, originX: 0, originY: 0 } : null;
  const prepareSmall = (img, rot, scale) => prepareTemplateBrowser(img, rot, scale / ds);

  /** @type {{ id: string, name: string, x: number, y: number, r: number, score: number, hitX: number, hitY: number, tw: number, th: number }[]} */
  const poses = [];
  let scanned = 0;

  for (let pi = 0; pi < poolItems.length; pi++) {
    const item = poolItems[pi];
    await yieldToUi();
    if (performance.now() - t0 > SOLVER_BUDGET_MS) {
      console.info('[screenshot] solver time budget hit', `scanned=${scanned}/${poolItems.length}`);
      break;
    }
    scanned += 1;

    const urls = templateUrls(item, getSpriteUrl, root);
    let img = null;
    let usedSprite = false;
    for (const url of urls) {
      try {
        img = await loadImage(url);
        usedSprite = /item-sprites\//.test(url);
        break;
      } catch {
        /* try next */
      }
    }
    if (!img) continue;

    const stem = `${imageStem(item)}.png`;
    const disp = byImage[stem];
    const dispW = Number(disp?.w) || 1;
    const nativeW = usedSprite
      ? Number(disp?.texW) || img.naturalWidth || img.width || 64
      : img.naturalWidth || img.width || 64;
    const known = knownScales(cellW, dispW, nativeW);
    const scales = known.length === 5 ? known.slice(1, 4) : known;

    const hintList = hints.get(String(item.id)) || [];
    /** @type {{ x: number, y: number, r: number }[]} */
    const searchHints =
      hintList.length > 0
        ? hintList
        : [...hints.values()].flat();
    /** @type {{ x0: number, y0: number, x1: number, y1: number } | null} */
    let bounds = null;
    let stride = 3;
    if (localGrid && searchHints.length) {
      // Search only near detector cells — full-bag NCC × dozens of templates freezes the page.
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      const pad = cellW * (hintList.length ? 1.75 : 2.25);
      for (const h of searchHints) {
        const px = cellToPx(localGrid, h.x, h.y);
        x0 = Math.min(x0, px.x - pad);
        y0 = Math.min(y0, px.y - pad);
        x1 = Math.max(x1, px.x + cellW + pad);
        y1 = Math.max(y1, px.y + cellW + pad);
      }
      bounds = {
        x0: Math.max(0, Math.floor(x0 / ds)),
        y0: Math.max(0, Math.floor(y0 / ds)),
        x1: Math.min(work.w - 1, Math.ceil(x1 / ds)),
        y1: Math.min(work.h - 1, Math.ceil(y1 / ds)),
      };
      stride = 1;
    }

    const hit = matchTemplateAtScales(work, img, {
      scales,
      rotations: [0, 90, 180, 270],
      stride,
      bounds,
      prepare: prepareSmall,
    });
    if (hit.score < NCC_RANK_FLOOR) continue;

    const cx = (hit.x + hit.tw / 2) * ds;
    const cy = (hit.y + hit.th / 2) * ds;
    let col;
    let row;
    if (localGrid) {
      const cell = pxToCell(localGrid, cx, cy);
      col = cell.col;
      row = cell.row;
    } else {
      col = Math.floor((cx / hay.w) * BOARD_COLS);
      row = Math.floor((cy / hay.h) * BOARD_ROWS);
    }
    col = Math.max(0, Math.min(BOARD_COLS - 1, col));
    row = Math.max(0, Math.min(BOARD_ROWS - 1, row));
    const rFace = Math.round(hit.rot / 90) % 4;

    let score = hit.score;
    for (const h of hintList) {
      if (Math.abs(h.x - col) <= 1 && Math.abs(h.y - row) <= 1) {
        score += 0.05;
        break;
      }
      if (h.r === rFace) score += 0.01;
    }

    poses.push({
      id: String(item.id),
      name: String(item.name || item.id),
      x: col,
      y: row,
      r: rFace,
      score,
      hitX: hit.x,
      hitY: hit.y,
      tw: hit.tw,
      th: hit.th,
    });
  }

  poses.sort((a, b) => b.score - a.score);

  const bags = draftPlacements.filter((p) => {
    const it = itemsById.get(p.id);
    return it && isBagItem(it);
  });
  const editMode = bags.length ? EDIT_MODE.DEFAULT : EDIT_MODE.ITEM_LAYER;

  /** @type {Map<string, number>} */
  const remaining = new Map(budget);
  let slotsLeft = visionCount;

  /** @type {object[]} */
  const placed = [];
  /** @type {{ id: string, name: string, x: number, y: number, r: number, score: number }[]} */
  const out = [];

  for (const pose of poses) {
    if (slotsLeft <= 0) break;
    const item = itemsById.get(pose.id);
    if (!item) continue;

    // Peek: only place if we can spend prior/confusion budget
    const peek = new Map(remaining);
    if (!consumePriorBudget(peek, pose.id, pose.name, itemsById)) continue;

    // No cell nudge — lookalike false peaks often sit on a stronger item; nudging
    // would spend the prior budget on the wrong catalog id elsewhere.
    const candidate = { x: pose.x, y: pose.y, r: pose.r };
    if (!canPlace(item, candidate, [...bags, ...placed], itemsById, null, editMode)) {
      continue;
    }

    consumePriorBudget(remaining, pose.id, pose.name, itemsById);
    placed.push({
      id: pose.id,
      x: candidate.x,
      y: candidate.y,
      r: candidate.r,
      key: `solv-${out.length}`,
    });
    out.push({
      id: pose.id,
      name: pose.name,
      x: candidate.x,
      y: candidate.y,
      r: candidate.r,
      score: pose.score,
    });
    slotsLeft -= 1;
    maskRegion(work, pose.hitX, pose.hitY, pose.tw || 12, pose.th || 12);
  }

  const rejected = Math.max(0, visionCount - out.length);
  console.info(
    '[screenshot] solver',
    `placed=${out.length}/${visionCount}`,
    `pool=${poolItems.length}`,
    `ms=${(performance.now() - t0).toFixed(0)}`,
  );
  return { items: out, visionCount, rejected };
}
