/**
 * Itemiary DOM pool — create once, cool+park off-window, reuse on scroll/filter.
 */

import { shapeForItem, bodyBounds } from './shape.js';
import { packItems, packGeom } from './pack.js';
import { bindHoverSparks } from './hover-sparks.js';
import { bindRarityHover } from './rarity-hover.js';
import {
  createItemEl,
  createUnderEl,
  setItemZ,
  placeEntry,
  parkEntry,
  applyItemFace,
  syncItemGems,
  stampAffectCells,
  playAppearInLibraryBatch,
  placedStackZ,
  bagLayerPriority,
  markSpritePending,
  needsSpriteAttach,
  warmItemSprites,
  filterEntriesNearViewport,
  APPEAR_VIEW_PAD_EM,
} from './item-pieces.js';
import {
  VIRTUAL_PAD_EM,
  placementsNearViewport,
  itemHeightEm,
  parkCooledEntry,
} from './item-virtual.js';

function isBagItem(item) {
  return String(item?.type || '') === 'Bag';
}

function assetPrefix() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function bagSlotUrl() {
  return `${assetPrefix()}assets/icons/FilledSlot.png`;
}

/** Soft FilledSlot fabric sits above bags via CSS z-index 5000. */

/**
 * Board cells occupied by a bag body (rotation-aware), for soft FilledSlot fabric.
 * @param {object} item
 * @param {number} x
 * @param {number} y
 * @param {number} face
 * @returns {{ x: number, y: number }[]}
 */
function bagBodyCells(item, x, y, face = 0) {
  const r = ((Number(face) || 0) % 4 + 4) % 4;
  const up = shapeForItem(item, 0);
  const upBounds = item.__bpbBounds || (item.__bpbBounds = bodyBounds(up));
  const rotBounds = r ? bodyBounds(shapeForItem(item, r)) : upBounds;
  const px = Number(x) || 0;
  const py = Number(y) || 0;
  const cx = px + rotBounds.w / 2;
  const cy = py + rotBounds.h / 2;
  const bw = upBounds.w;
  const bh = upBounds.h;

  /** @param {number} lx @param {number} ly */
  const toBoard = (lx, ly) => {
    let ox = lx + 0.5 - bw / 2;
    let oy = ly + 0.5 - bh / 2;
    for (let s = 0; s < r; s += 1) {
      const nx = -oy;
      const ny = ox;
      ox = nx;
      oy = ny;
    }
    return { x: Math.floor(cx + ox), y: Math.floor(cy + oy) };
  };

  return up.body.map((c) => toBoard(c.x - upBounds.minX, c.y - upBounds.minY));
}

/**
 * Soft FilledSlot fabric above bag sprites (so overhanging Icon art cannot
 * cover neighbor seams) and below gear items.
 * @param {HTMLElement} itemsLayer
 * @param {{ id: string, x: number, y: number, r?: number }[]} placements
 * @param {Map<string, object>} itemsById
 * @param {boolean} enabled
 * @param {{ appear?: boolean }} [opts]
 */
function syncBagFabric(itemsLayer, placements, itemsById, enabled, opts = {}) {
  let fabric = itemsLayer.querySelector(':scope > .bpb-bg__fabric');
  if (!enabled) {
    fabric?.replaceChildren();
    return;
  }
  if (!(fabric instanceof HTMLElement)) {
    fabric = document.createElement('div');
    fabric.className = 'bpb-bg__fabric';
    fabric.setAttribute('aria-hidden', 'true');
    itemsLayer.appendChild(fabric);
  }

  /** @type {Set<string> | null} */
  const skipKeys =
    opts.skipBagKeys instanceof Set && opts.skipBagKeys.size
      ? opts.skipBagKeys
      : null;

  /** @type {Map<string, { x: number, y: number }>} */
  const cells = new Map();
  for (const p of placements) {
    const item = itemsById.get(p.id);
    if (!isBagItem(item)) continue;
    const key = p.key != null ? String(p.key) : '';
    // Bag mid-rotate: per-bag slots spin with the sprite — omit from fabric
    if (key && skipKeys?.has(key)) continue;
    const face = ((Number(p.r) || 0) % 4 + 4) % 4;
    for (const c of bagBodyCells(item, p.x, p.y, face)) {
      cells.set(`${c.x},${c.y}`, c);
    }
  }

  const url = bagSlotUrl();
  const doAppear =
    opts.appear === true &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  // Pending = invisible until delays are stamped (avoids a full-opacity flash)
  const pendingCls = doAppear ? ' bpb-bg__cell--appear-pending' : '';
  const html = [...cells.values()]
    .map(
      (c) =>
        `<span class="bpb-bg__cell bpb-bg__cell--bag${pendingCls}" style="left:${c.x}em;top:${c.y}em;background-image:url('${url}')"></span>`,
    )
    .join('');
  fabric.innerHTML = html;

  if (doAppear) playFabricAppear(fabric);
}

/** Same stagger as AppearInLibrary item wave. */
const FABRIC_APPEAR_STAGGER_MS = 2;
const FABRIC_APPEAR_STAGGER_MAX_MS = 400;

/**
 * Pop fabric cells in with the bag wave (reading order).
 * Cells start as --appear-pending (hidden); this stamps delays and starts the wave.
 * @param {HTMLElement} fabric
 */
function playFabricAppear(fabric) {
  const cells = [...fabric.querySelectorAll('.bpb-bg__cell--bag')];
  if (!cells.length) return;

  cells.sort((a, b) => {
    const ay = parseFloat(a.style.top) || 0;
    const by = parseFloat(b.style.top) || 0;
    if (ay !== by) return ay - by;
    return (parseFloat(a.style.left) || 0) - (parseFloat(b.style.left) || 0);
  });

  for (let i = 0; i < cells.length; i += 1) {
    const el = cells[i];
    const delay = `${Math.min(i * FABRIC_APPEAR_STAGGER_MS, FABRIC_APPEAR_STAGGER_MAX_MS)}ms`;
    el.style.setProperty('--bpb-appear-delay', delay);
    el.classList.remove('bpb-bg__cell--appear-pending');
    el.classList.add('bpb-bg__cell--appear');
    el.addEventListener(
      'animationend',
      (ev) => {
        if (ev.target !== el) return;
        if (!String(ev.animationName || '').includes('bpb-bg-appear-fabric')) return;
        el.classList.remove('bpb-bg__cell--appear');
        el.style.removeProperty('--bpb-appear-delay');
      },
      { once: true },
    );
  }
}

/**
 * Game Game.sort_BagOrder + Bag layer priority: bags first (plain→effect→unique), then items.
 * @param {{ id: string }[]} placements
 * @param {Map<string, object>} itemsById
 */
function sortPlacementsForPaint(placements, itemsById) {
  return [...placements].sort((a, b) => {
    const ia = itemsById.get(a.id);
    const ib = itemsById.get(b.id);
    const ba = isBagItem(ia);
    const bb = isBagItem(ib);
    if (ba !== bb) return ba ? -1 : 1;
    if (ba && bb) {
      const dp = bagLayerPriority(ia) - bagLayerPriority(ib);
      if (dp) return dp;
    }
    return 0;
  });
}

const CELL_PX_DEFAULT = 34;
const CELL_PX_MIN = 22;
const SCROLL_GAP_PX = 14;
/** Matches `.bpb-bg::-webkit-scrollbar { width: 16px }` — reserved in Itemiary metrics. */
const SCROLLBAR_PX = 16;
/** Stage width delta (px) treated as a real resize vs scrollbar/subpixel noise. */
const HOST_RESIZE_EPS_PX = 2;
/** Appear stagger cap + duration + buffer — ignore ResizeObserver during the wave. */
const APPEAR_LAYOUT_GUARD_MS = 1200;

/**
 * @param {HTMLElement} el
 * @param {number} fallback
 * @param {number} [scrollGap=SCROLL_GAP_PX] pass 0 when the board has no scrollbar
 */
export function packWidth(el, fallback, scrollGap = SCROLL_GAP_PX) {
  const raw = el.clientWidth || fallback;
  const gap = Number.isFinite(scrollGap) ? Math.max(0, scrollGap) : SCROLL_GAP_PX;
  return Math.max(1, raw - gap);
}

/**
 * @param {number} availWidth
 * @param {number} cols
 * @param {number} [fallback=CELL_PX_DEFAULT]
 */
export function cellPxFill(availWidth, cols, fallback = CELL_PX_DEFAULT) {
  const n = Math.max(1, Math.floor(cols) || 1);
  const w = Math.max(0, availWidth);
  if (w < 1) return fallback;
  return Math.max(CELL_PX_MIN, w / n);
}

/**
 * Ensure board chrome exists; bind hover once.
 * @param {HTMLElement} root
 */
function ensureBoard(root) {
  let board = root.querySelector(':scope > .bpb-bg__board');
  if (!(board instanceof HTMLElement)) {
    root.replaceChildren();
    board = document.createElement('div');
    board.className = 'bpb-bg__board';
    board.innerHTML =
      '<div class="bpb-bg__lines" aria-hidden="true"></div>' +
      '<div class="bpb-bg__under" aria-hidden="true"></div>' +
      '<div class="bpb-bg__items"></div>';
    root.appendChild(board);
    // Homepage create promo: decorative only — hover chrome is the hover jank.
    if (!root.classList.contains('bpb-bg--promo')) {
      bindRarityHover(root);
      bindHoverSparks(root);
    }
  }
  const under = board.querySelector('.bpb-bg__under');
  const itemsLayer = board.querySelector('.bpb-bg__items');
  if (!(under instanceof HTMLElement) || !(itemsLayer instanceof HTMLElement)) {
    return null;
  }
  return { board, under, itemsLayer };
}

/**
 * @typedef {{
 *   itemEl: HTMLElement,
 *   underEl: HTMLElement | null,
 *   x: number,
 *   y: number,
 *   z: number,
 *   shown: boolean,
 * }} PoolEntry
 */

/**
 * Paint placements; only move/park nodes that actually changed.
 * No appendChild reorder — stacking uses z-index.
 *
 * @param {HTMLElement} root
 * @param {{
 *   cols: number,
 *   rows: number,
 *   cellPx?: number,
 *   fillWidth?: boolean,
 *   placements: { id: string, x: number, y: number, key?: string, r?: number }[],
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   pool: Map<string, PoolEntry>,
 *   parkRest?: boolean,
 *   prevShown?: Set<string>,
 *   appear?: boolean,
 *   appearLayer?: 'item' | 'under',
 * }} opts
 * @returns {Set<string>} ids shown after this paint
 */
/**
 * @param {HTMLElement} root
 * @param {object} opts
 * @returns {Set<string> | {
 *   shown: Set<string>,
 *   appearList: { itemEl: HTMLElement, underEl: HTMLElement | null, isBag: boolean, x: number, y: number }[],
 *   warmEntries: { itemEl: HTMLElement, underEl: HTMLElement | null, isBag: boolean, x: number, y: number }[],
 * }}
 *   When `opts.deferAppear` (Itemiary): place/park only; caller warms then waves.
 */
export function paintPooled(root, opts) {
  const cellPx = opts.cellPx ?? CELL_PX_DEFAULT;
  const { cols, rows, placements, itemsById, getSpriteUrl, pool } = opts;
  const parkRest = opts.parkRest !== false;
  const prevShown = opts.prevShown;
  const itemiary = root.classList.contains('bpb-bg--itemiary');
  const deferSprite = itemiary || opts.deferSprite === true;
  const deferAppear = opts.deferAppear === true;
  const appearNewOnly = opts.appearNewOnly === true;
  const skipPark = opts.skipPark instanceof Set ? opts.skipPark : null;
  const appear =
    opts.appear === true &&
    !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  // exactBoard: width = cols×cell so floor tiles + item em coords stay locked (no scrollbar gutter clip)
  const boardWidth =
    opts.fillWidth && !opts.exactBoard ? '100%' : `${cols}em`;

  root.style.setProperty('--bpb-bg-cell', `${cellPx}px`);
  root.style.setProperty('--bpb-bg-cols', String(cols));
  root.style.setProperty('--bpb-bg-rows', String(rows));

  const layers = ensureBoard(root);
  if (!layers) return deferAppear ? { shown: new Set(), appearList: [], warmEntries: [] } : new Set();
  const { board, under, itemsLayer } = layers;

  if (board.style.width !== boardWidth) board.style.width = boardWidth;
  const heightEm = `${rows}em`;
  if (board.style.height !== heightEm) board.style.height = heightEm;

  /** @type {Set<string>} */
  const shown = new Set();
  /** @type {{ itemEl: HTMLElement, underEl: HTMLElement | null, isBag: boolean, x: number, y: number }[]} */
  const appearList = [];
  /** @type {{ itemEl: HTMLElement, underEl: HTMLElement | null, isBag: boolean, x: number, y: number }[]} */
  const warmEntries = [];

  const ordered = sortPlacementsForPaint(placements, itemsById);
  /** Bags mid face-spin — fabric omitted; per-bag slots visible on the spin node */
  /** @type {Set<string>} */
  const spinningBagKeys = new Set();
  const fabricEnabled =
    root.classList.contains('bpb-bg--placed') &&
    !root.classList.contains('bpb-bg--itemiary');

  function refreshFabric() {
    if (!fabricEnabled) return;
    /** @type {Set<string>} */
    const skip = new Set(spinningBagKeys);
    for (const [k, ent] of pool) {
      if (ent.itemEl.classList.contains('is-face-spinning')) skip.add(k);
    }
    syncBagFabric(itemsLayer, placements, itemsById, true, {
      skipBagKeys: skip,
    });
  }

  for (let i = 0; i < ordered.length; i += 1) {
    const p = ordered[i];
    const item = itemsById.get(p.id);
    if (!item) continue;
    // Allow duplicate item ids (history boards) via stable per-placement key
    const face = ((Number(p.r) || 0) % 4 + 4) % 4;
    const key = p.key != null ? String(p.key) : `${p.id}:${face}:${p.x},${p.y}`;
    shown.add(key);

    const bag = isBagItem(item);
    const stackZ = placedStackZ(
      item,
      Number.isFinite(item.libraryIndex) ? item.libraryIndex : i,
    );
    const z = stackZ;

    let entry = pool.get(key);
    /** True when this paint created the DOM node (vs reusing a parked pool hit). */
    let created = false;
    /** @type {{ fromDeg: number, durationMs?: number } | undefined} */
    const faceCont =
      opts.faceContinue instanceof Map ? opts.faceContinue.get(key) : undefined;
    if (entry && Number(entry.itemEl.getAttribute('data-face')) !== face) {
      // Instant by default (place/drop / load). Opt in via animateFace / animateFaceKeys
      // for intentional rotates only (Item.rotateTo vs setFaceDirectionInstant).
      // faceContinue: mid-drag rotate handed off to the placed item (game keeps tween).
      const keyAnim =
        !!faceCont ||
        opts.animateFace === true ||
        (opts.animateFaceKeys instanceof Set && opts.animateFaceKeys.has(key));
      if (keyAnim && bag) spinningBagKeys.add(key);
      applyItemFace(entry.itemEl, entry.underEl, item, face, {
        animate: keyAnim,
        fromDeg: faceCont?.fromDeg,
        durationMs: faceCont?.durationMs,
        onDone: () => {
          spinningBagKeys.delete(key);
          refreshFabric();
        },
      });
    }

    const gemIds = Array.isArray(p.gems) ? p.gems : [];
    const gemSig = gemIds.map((g) => (g ? String(g) : '')).join('\0');
    const resolvedGems = gemIds.map((gid) => {
      if (!gid) return null;
      const gem = itemsById.get(gid);
      if (!gem) return null;
      const url = getSpriteUrl(gem) || null;
      if (!url) return null;
      return {
        url,
        id: gem.id,
        name: gem.name || '',
        rarity: gem.rarity || '',
        w: Number(gem.spriteW) || undefined,
        h: Number(gem.spriteH) || undefined,
      };
    });

    if (!entry) {
      created = true;
      // Full Icon.scale sprite — Itemiary shrinks the whole bag via CSS scale(0.9)
      // so FilledSlots stay proportional (do not use libraryBagScale here).
      const promo = root.classList.contains('bpb-bg--promo');
      const itemiaryPromo = promo && root.classList.contains('bpb-bg--itemiary');
      const itemEl = createItemEl(item, getSpriteUrl, stackZ, face, resolvedGems, {
        deferSprite,
        chrome: !promo,
        shadow: !itemiaryPromo,
        bagSlots: !itemiaryPromo,
      });
      if (!itemEl) continue;
      const underEl = promo ? null : createUnderEl(item, face);
      entry = {
        itemEl,
        underEl,
        x: NaN,
        y: NaN,
        z: NaN,
        shown: false,
        gemSig,
      };
      pool.set(key, entry);
      itemsLayer.appendChild(itemEl);
      if (underEl) under.appendChild(underEl);
      // New place while float was mid-rotate — continue spin on the board item
      if (faceCont && Number.isFinite(faceCont.fromDeg)) {
        if (bag) spinningBagKeys.add(key);
        applyItemFace(entry.itemEl, entry.underEl, item, face, {
          animate: true,
          fromDeg: faceCont.fromDeg,
          durationMs: faceCont.durationMs,
          onDone: () => {
            spinningBagKeys.delete(key);
            refreshFabric();
          },
        });
      }
    } else if (entry.gemSig !== gemSig) {
      syncItemGems(entry.itemEl, item, resolvedGems);
      entry.gemSig = gemSig;
    }

    if (entry.z !== z) {
      setItemZ(entry.itemEl, z);
      entry.z = z;
    }

    if (!entry.shown || entry.x !== p.x || entry.y !== p.y) {
      placeEntry(entry.itemEl, entry.underEl, p.x, p.y);
      entry.x = p.x;
      entry.y = p.y;
      entry.shown = true;
    }
    if (p.key != null && String(p.key) !== '') {
      entry.itemEl.dataset.placementKey = String(p.key);
    } else {
      entry.itemEl.dataset.placementKey = key;
    }
    stampAffectCells(entry.itemEl, item, p.x, p.y, face);

    if (deferSprite) markSpritePending(entry.itemEl);

    const warmEntry = {
      itemEl: entry.itemEl,
      underEl: entry.underEl,
      isBag: bag,
      x: p.x,
      y: p.y,
    };
    if (deferAppear) warmEntries.push(warmEntry);

    // Game refresh(popIn) / loading preview — batched after the loop (one reflow).
    // Scroll keep-alive (appearNewOnly): only brand-new DOM nodes wave — reused
    // parked pool hits must not re-appear every time they re-enter the window.
    if (appear) {
      const isNew =
        created ||
        (!appearNewOnly && (!prevShown || !prevShown.has(key)));
      if (isNew) {
        const waveUnder =
          opts.appearLayer === 'under' ||
          root.classList.contains('bpb-bg--placed') ||
          root.classList.contains('bpb-bg--itemiary');
        if (waveUnder) {
          entry.underEl?.classList.add('bpb-bg__under-item--appear-pending');
        }
        appearList.push(warmEntry);
      }
    }
  }

  // Fabric first (pending/hidden), then item wave — one turn, no early squares
  syncBagFabric(
    itemsLayer,
    placements,
    itemsById,
    // Build boards only — Itemiary keeps per-bag FilledSlot under the Icon.
    // Sharing .bpb-bg--placed for library layout used to paint fabric over bags.
    fabricEnabled,
    { appear, skipBagKeys: spinningBagKeys },
  );

  if (parkRest) {
    const leave = prevShown || pool.keys();
    for (const id of leave) {
      if (shown.has(id)) continue;
      if (skipPark?.has(id)) continue;
      const entry = pool.get(id);
      if (!entry?.shown) continue;
      if (deferSprite) {
        // Itemiary keep-alive: cool bitmaps + park; keep the pool entry so
        // scrubbing back does not rebuild DOM / re-decode from scratch.
        parkCooledEntry(entry);
      } else {
        parkEntry(entry.itemEl, entry.underEl);
        entry.shown = false;
      }
    }
  } else {
    for (const [id, entry] of pool) {
      if (shown.has(id)) continue;
      entry.itemEl.remove();
      entry.underEl?.remove();
      pool.delete(id);
    }
  }

  // Collar extension promotion (Acorn Ace), rarity-hover listeners, etc.
  root.dispatchEvent(new CustomEvent('bpb-bg:painted', { bubbles: false }));

  if (deferAppear) {
    return { shown, appearList, warmEntries };
  }

  if (appearList.length) {
    playAppearInLibraryBatch(root, appearList, {
      layer: opts.appearLayer === 'under' ? 'under' : 'item',
    });
  }

  return shown;
}

/**
 * Ensure pool entries exist for every item (parked until placed).
 * @param {Map<string, { itemEl: HTMLElement, underEl: HTMLElement | null }>} pool
 * @param {HTMLElement} root
 * @param {object[]} items
 * @param {(item: object) => string} getSpriteUrl
 */
export function ensurePoolEntries(pool, root, items, getSpriteUrl) {
  const layers = ensureBoard(root);
  if (!layers) return;
  const { under, itemsLayer } = layers;
  // Itemiary prewarm: DOM + geom only — deferred data-src (no network until warm/IO).
  const deferSprite = root.classList.contains('bpb-bg--itemiary');
  const promo = root.classList.contains('bpb-bg--promo');
  for (const item of items) {
    if (!item?.id || pool.has(item.id)) continue;
    const itemEl = createItemEl(item, getSpriteUrl, item.libraryIndex ?? 1, 0, [], {
      deferSprite,
      chrome: !promo,
      shadow: !promo,
      bagSlots: !promo,
    });
    if (!itemEl) continue;
    const underEl = promo ? null : createUnderEl(item);
    pool.set(item.id, {
      itemEl,
      underEl,
      x: NaN,
      y: NaN,
      z: NaN,
      shown: false,
    });
    itemsLayer.appendChild(itemEl);
    if (underEl) under.appendChild(underEl);
    packGeom(item);
  }
}

/**
 * Catalog Itemiary mount — one host for library layout + packed filters.
 *
 * @param {Element | string} container
 * @param {{
 *   getSpriteUrl: (item: object) => string,
 *   cellPx?: number,
 *   cols?: number,
 *   fillWidth?: boolean,
 *   promo?: boolean,
 *   spriteRoot?: Element | null,
 *   virtualize?: boolean,
 * }} options
 */
export function mountItemiaryGrid(container, options) {
  const host = typeof container === 'string' ? document.querySelector(container) : container;
  if (!host) throw new Error('mountItemiaryGrid: container not found');

  let el = host.querySelector(':scope > .bpb-bg');
  if (!(el instanceof HTMLElement)) {
    el = document.createElement('div');
    host.replaceChildren(el);
  }
  el.className =
    'bpb-bg bpb-bg--itemiary' + (options.promo === true ? ' bpb-bg--promo' : '');

  const baseCellPx = options.cellPx ?? CELL_PX_DEFAULT;
  const fixedCols = options.cols ?? 20;
  const fillWidth = options.fillWidth !== false;
  const getSpriteUrl = options.getSpriteUrl;
  const virtualize = options.promo !== true && options.virtualize !== false;

  /** @type {Map<string, PoolEntry>} */
  const pool = new Map();
  /** @type {object[]} */
  let poolItems = [];
  /** @type {Set<string>} */
  let prevShown = new Set();

  let mode = /** @type {'placed' | 'packed' | null} */ (null);
  let placements = /** @type {{ id: string, x: number, y: number }[]} */ ([]);
  let itemsById = /** @type {Map<string, object>} */ (new Map());
  let rows = 1;
  let compact = true;
  /** @type {((item: object) => string | number) | null} */
  let groupKeyFn = null;
  /** Play AppearInLibrary on the next paint only (not resize). Opt-in. */
  let appearNext = false;
  /** Wave only newly mounted keys (scroll window), not the whole viewport. */
  let appearNewOnly = false;
  /** @type {'item' | 'under'} */
  let appearLayerNext = 'item';
  let previewMode = false;
  /** @type {object[]} */
  let packedItems = [];
  let lastPackKey = '';
  let lastPackResult = /** @type {{ placements: typeof placements, rows: number } | null} */ (null);
  let lastPaintKey = '';
  /** Cell size committed by the last paint — held until the stage really resizes. */
  let frozenCellPx = 0;
  let frozenHostW = 0;
  /** Ignore ResizeObserver while AppearInLibrary is in flight. */
  let appearGuardUntil = 0;
  let roRaf = 0;
  /** @type {IntersectionObserver | null} */
  let spriteIo = null;
  /** Bumps when a newer paint supersedes an in-flight warm. */
  let paintGen = 0;

  function stageWidth() {
    const rectW = host.getBoundingClientRect().width;
    if (rectW > 0) return rectW;
    return host.clientWidth || el.clientWidth || 0;
  }

  function layoutMetrics() {
    const hostW = stageWidth() || fixedCols * baseCellPx;

    // Keep the appear/filter paint's cell size unless the stage itself resized.
    // Scroller clientWidth flicker used to "correct" positions after the wave.
    if (
      frozenCellPx > 0 &&
      Math.abs(hostW - frozenHostW) < HOST_RESIZE_EPS_PX
    ) {
      return {
        avail: frozenCellPx * fixedCols,
        cellPx: frozenCellPx,
        cols: fixedCols,
        hostW,
      };
    }

    // Stage width minus board/scrollbar lanes (not el.clientWidth — that moves).
    const avail = Math.max(1, hostW - SCROLL_GAP_PX - SCROLLBAR_PX);
    const cellPx = fillWidth
      ? Math.round(cellPxFill(avail, fixedCols, baseCellPx) * 100) / 100
      : baseCellPx;
    return { avail, cellPx, cols: fixedCols, hostW };
  }

  /**
   * @param {number} cellPx
   * @param {number} nextRows
   * @param {{ id: string, x: number, y: number }[]} nextPlacements
   * @param {Map<string, object>} nextMap
   */
  function visibleSlice(cellPx, nextRows, nextPlacements, nextMap) {
    if (!virtualize) return nextPlacements;
    return placementsNearViewport(
      nextPlacements,
      nextMap,
      {
        cellPx,
        rows: nextRows,
        scrollTop: el.scrollTop,
        clientHeight: el.clientHeight,
      },
      VIRTUAL_PAD_EM,
    );
  }

  /**
   * @param {number} [cellPxHint]
   */
  function ensureSpriteIo(cellPxHint) {
    if (spriteIo) return spriteIo;
    const cellPx = cellPxHint > 0 ? cellPxHint : frozenCellPx || baseCellPx;
    const margin = Math.round(cellPx * Math.max(APPEAR_VIEW_PAD_EM, 2));
    const ioRoot =
      options.spriteRoot instanceof Element ? options.spriteRoot : el;
    spriteIo = new IntersectionObserver(
      (entries) => {
        for (const ent of entries) {
          if (!ent.isIntersecting) continue;
          const itemEl = ent.target;
          if (!(itemEl instanceof HTMLElement)) continue;
          if (!needsSpriteAttach(itemEl)) {
            spriteIo?.unobserve(itemEl);
            continue;
          }
          void warmItemSprites([itemEl]);
          spriteIo?.unobserve(itemEl);
        }
      },
      { root: ioRoot, rootMargin: `${margin}px 0px` },
    );
    return spriteIo;
  }

  /**
   * @param {number} [cellPxHint]
   */
  function syncSpriteObserver(cellPxHint) {
    spriteIo?.disconnect();
    spriteIo = null;
    const io = ensureSpriteIo(cellPxHint);
    for (const entry of pool.values()) {
      if (entry.shown && needsSpriteAttach(entry.itemEl)) {
        io.observe(entry.itemEl);
      }
    }
  }

  /**
   * @param {number} cellPx
   * @param {number} cols
   * @param {number} nextRows
   * @param {{ id: string, x: number, y: number }[]} nextPlacements
   * @param {Map<string, object>} nextMap
   * @param {number} [hostW]
   * @returns {Promise<void>}
   */
  async function paintNow(cellPx, cols, nextRows, nextPlacements, nextMap, hostW) {
    const appear = appearNext;
    const appearLayer = appearLayerNext;
    const newOnly = appearNewOnly;
    appearNext = false;
    appearNewOnly = false;
    appearLayerNext = 'item';
    frozenCellPx = cellPx;
    frozenHostW = hostW > 0 ? hostW : frozenHostW;
    if (appear) {
      appearGuardUntil = performance.now() + APPEAR_LAYOUT_GUARD_MS;
    }
    el.classList.toggle('bpb-bg--preview', previewMode);

    const slice = visibleSlice(cellPx, nextRows, nextPlacements, nextMap);

    // Keep-alive: off-window nodes cool+park in paintPooled (no destroy / leave
    // wave). Scrubbing back reuses the pool entry instead of rebuilding DOM.
    const gen = ++paintGen;
    const result = paintPooled(el, {
      cols,
      rows: nextRows,
      cellPx,
      fillWidth,
      placements: slice,
      itemsById: nextMap,
      getSpriteUrl,
      pool,
      parkRest: true,
      prevShown,
      appear,
      appearLayer,
      appearNewOnly: newOnly,
      skipPark: null,
      deferAppear: true,
      deferSprite: true,
    });
    const { shown, appearList, warmEntries } =
      result instanceof Set
        ? { shown: result, appearList: [], warmEntries: [] }
        : result;
    prevShown = shown;

    // One layout read for warm + appear cull (avoid getComputedStyle after paint).
    const clientHeight = el.clientHeight;
    const scrollTop = el.scrollTop;
    const viewMetrics = {
      cellPx,
      rows: nextRows,
      clientHeight,
      scrollTop,
    };

    // If the scroller has no clientHeight yet, viewport cull is empty — warm a
    // first band so first paint cannot leave everything --sprite-pending forever.
    let near = filterEntriesNearViewport(
      el,
      warmEntries,
      APPEAR_VIEW_PAD_EM,
      viewMetrics,
    );
    if (!near.length && warmEntries.length && clientHeight < 8) {
      const bandBottom = cellPx * 12;
      near = warmEntries.filter((entry) => {
        const y = Number.isFinite(entry.y) ? entry.y : 0;
        const hEm = parseFloat(entry.itemEl.style.height) || 1;
        return y * cellPx < bandBottom || (y + hEm) * cellPx <= bandBottom;
      });
    }
    if (near.length) {
      await warmItemSprites(near.map((e) => e.itemEl));
    }
    if (gen !== paintGen) return;

    if (appearList.length) {
      playAppearInLibraryBatch(el, appearList, {
        layer: appearLayer === 'under' ? 'under' : 'item',
        inView: newOnly ? appearList : near,
        metrics: viewMetrics,
      });
    }
    requestAnimationFrame(() => {
      if (gen !== paintGen) return;
      syncSpriteObserver(cellPx);
    });
  }

  function mergePoolIntoMap(map) {
    for (const item of poolItems) {
      if (!map.has(item.id)) map.set(item.id, item);
    }
    return map;
  }

  /**
   * @returns {Promise<void>}
   */
  function render() {
    const { avail, cellPx, cols, hostW } = layoutMetrics();
    const layoutKey = `${avail}:${cols}:${cellPx}:${mode}`;

    if (mode === 'packed') {
      const packKey = `${cols}|${compact ? 1 : 0}|${groupKeyFn ? 1 : 0}|${packedItems.map((i) => i.id).join('\0')}`;
      if (packKey !== lastPackKey || !lastPackResult) {
        lastPackKey = packKey;
        if (!packedItems.length) {
          lastPackResult = { placements: [], rows: 1 };
        } else {
          const packed = packItems(packedItems, cols, {
            compact,
            groupKey: groupKeyFn || undefined,
          });
          lastPackResult = { placements: packed.placements, rows: packed.rows };
        }
      }
      placements = lastPackResult.placements;
      rows = lastPackResult.rows;
      itemsById = mergePoolIntoMap(new Map(packedItems.map((i) => [i.id, i])));
    }

    const visKey = virtualize
      ? visibleSlice(cellPx, rows, placements, itemsById)
          .map((p) => `${p.id}:${p.x},${p.y}`)
          .join(';')
      : '*';
    const paintKey = `${layoutKey}|${lastPackKey}|${rows}|${visKey}|${mode}`;
    if (paintKey === lastPaintKey && el.childElementCount) {
      appearNext = false;
      appearNewOnly = false;
      return Promise.resolve();
    }
    lastPaintKey = paintKey;

    return paintNow(cellPx, cols, rows, placements, itemsById, hostW);
  }

  const ro = new ResizeObserver(() => {
    if (performance.now() < appearGuardUntil) return;
    if (roRaf) return;
    roRaf = requestAnimationFrame(() => {
      roRaf = 0;
      void render();
    });
  });
  // Observe the stage — scroller box changes from overflow are not real resizes.
  ro.observe(host);

  let scrollRaf = 0;
  function onScroll() {
    if (!virtualize || mode == null) return;
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      appearNewOnly = true;
      appearNext =
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches !== true;
      void render();
    });
  }
  if (virtualize) {
    el.addEventListener('scroll', onScroll, { passive: true });
  }

  return {
    el,
    /**
     * @param {object[]} items
     */
    ensurePool(items) {
      poolItems = items || [];
      if (!virtualize) {
        ensurePoolEntries(pool, el, poolItems, getSpriteUrl);
      }
      for (const item of poolItems) {
        shapeForItem(item);
        packGeom(item);
      }
    },
    /**
     * @param {{ id: string, x: number, y: number }[]} nextPlacements
     * @param {Map<string, object> | Record<string, object>} nextItemsById
     * @param {number} [nextRows]
     * @param {{ appear?: boolean, appearLayer?: 'item' | 'under', preview?: boolean }} [opts]
     * @returns {Promise<void>}
     */
    showPlaced(nextPlacements, nextItemsById, nextRows, opts = {}) {
      mode = 'placed';
      previewMode = opts.preview === true;
      el.className =
        'bpb-bg bpb-bg--itemiary bpb-bg--placed' +
        (options.promo === true ? ' bpb-bg--promo' : '') +
        (previewMode ? ' bpb-bg--preview' : '');
      placements = nextPlacements || [];
      itemsById = mergePoolIntoMap(
        nextItemsById instanceof Map
          ? new Map(nextItemsById)
          : new Map(Object.entries(nextItemsById || {})),
      );
      if (nextRows != null) {
        rows = nextRows;
      } else {
        let maxY = 1;
        for (const p of placements) {
          const item = itemsById.get(p.id);
          if (!item) continue;
          const shape = shapeForItem(item);
          const bounds = item.__bpbBounds || (item.__bpbBounds = bodyBounds(shape));
          maxY = Math.max(maxY, p.y + bounds.h);
        }
        rows = maxY;
      }
      appearNext = opts.appear === true;
      appearNewOnly = false;
      appearLayerNext = opts.appearLayer === 'under' ? 'under' : 'item';
      lastPackKey = '';
      lastPackResult = null;
      lastPaintKey = '';
      return render();
    },
    /**
     * @param {object[]} items
     * @param {{
     *   compact?: boolean,
     *   groupKey?: (item: object) => string | number,
     *   appear?: boolean,
     *   appearLayer?: 'item' | 'under',
     *   preview?: boolean,
     * }} [opts]
     * @returns {Promise<void>}
     */
    showPacked(items, opts = {}) {
      mode = 'packed';
      previewMode = opts.preview === true;
      el.className =
        'bpb-bg bpb-bg--itemiary bpb-bg--packed' +
        (options.promo === true ? ' bpb-bg--promo' : '') +
        (previewMode ? ' bpb-bg--preview' : '');
      packedItems = items || [];
      compact = opts.compact !== false;
      groupKeyFn = typeof opts.groupKey === 'function' ? opts.groupKey : null;
      appearNext = opts.appear === true;
      appearNewOnly = false;
      appearLayerNext = opts.appearLayer === 'under' ? 'under' : 'item';
      lastPackKey = '';
      lastPackResult = null;
      lastPaintKey = '';
      return render();
    },
    /**
     * @returns {Promise<void>}
     */
    parkAll() {
      mode = 'packed';
      packedItems = [];
      appearNext = false;
      appearNewOnly = false;
      appearLayerNext = 'item';
      previewMode = false;
      lastPackKey = '';
      lastPackResult = { placements: [], rows: 1 };
      placements = [];
      rows = 1;
      const { cellPx, cols, hostW } = layoutMetrics();
      lastPaintKey = '';
      return paintNow(cellPx, cols, 1, [], itemsById, hostW);
    },
    /**
     * Scroll an item into the window and mount it (spotlight / recipe pick).
     * @param {string} id
     * @returns {Promise<HTMLElement | null>}
     */
    async scrollToId(id) {
      const p = placements.find((pl) => pl.id === id);
      if (!p) return null;
      const { cellPx } = layoutMetrics();
      const hEm = itemHeightEm(itemsById.get(id));
      const topPx = (Number(p.y) || 0) * cellPx;
      const hPx = hEm * cellPx;
      const viewH = el.clientHeight;
      const current = el.scrollTop;
      if (topPx < current || topPx + hPx > current + viewH) {
        el.scrollTop = Math.max(0, topPx - Math.max(0, (viewH - hPx) / 2));
      }
      lastPaintKey = '';
      appearNewOnly = true;
      appearNext =
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches !== true;
      await render();
      const hit = el.querySelector(
        `.bpb-bg__item[data-item-id="${CSS.escape(id)}"]:not(.bpb-bg__item--parked)`,
      );
      return hit instanceof HTMLElement ? hit : null;
    },
    destroy() {
      if (virtualize) el.removeEventListener('scroll', onScroll);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      scrollRaf = 0;
      if (roRaf) cancelAnimationFrame(roRaf);
      roRaf = 0;
      ro.disconnect();
      spriteIo?.disconnect();
      spriteIo = null;
      for (const entry of pool.values()) {
        entry.itemEl.remove();
        entry.underEl?.remove();
      }
      pool.clear();
      el.remove();
    },
  };
}
