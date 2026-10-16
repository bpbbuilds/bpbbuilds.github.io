/**
 * DOM mounts for backpack grids (builds + generic packed/placed).
 * Catalog Itemiary uses mountItemiaryGrid from item-pool.js.
 */

import { shapeForItem, bodyBounds } from './shape.js';
import { packItems, colsForWidth } from './pack.js';
import { paintPooled, packWidth, cellPxFill } from './item-pool.js';

const CELL_PX_DEFAULT = 34;

/**
 * Largest cell that keeps a cols×rows board inside the host content box.
 * @param {Element} host
 * @param {number} cols
 * @param {number} rows
 * @param {number} fallback
 */
function cellPxFitHost(host, cols, rows, fallback) {
  const cs = getComputedStyle(host);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const w = host.clientWidth - padX;
  const h = host.clientHeight - padY;
  if (w < 8 || h < 8 || cols < 1 || rows < 1) return fallback;
  return Math.round(Math.max(18, Math.min(w / cols, h / rows)) * 100) / 100;
}

/**
 * Auto-pack items into a continuous Itemiary grid.
 *
 * @param {Element | string} container
 * @param {{
 *   items: object[],
 *   getSpriteUrl: (item: object) => string,
 *   cellPx?: number,
 *   minCols?: number,
 *   maxCols?: number,
 *   compact?: boolean,
 *   fillWidth?: boolean,
 * }} options
 */
export function mountPackedGrid(container, options) {
  const host = typeof container === 'string' ? document.querySelector(container) : container;
  if (!host) throw new Error('mountPackedGrid: container not found');

  let el = host.querySelector(':scope > .bpb-bg');
  if (!(el instanceof HTMLElement)) {
    el = document.createElement('div');
    host.replaceChildren(el);
  }
  el.className = 'bpb-bg bpb-bg--packed';

  const baseCellPx = options.cellPx ?? CELL_PX_DEFAULT;
  const minCols = options.minCols ?? 8;
  const maxCols = options.maxCols ?? 28;
  const compact = options.compact !== false;
  const fillWidth = options.fillWidth !== false;
  let currentItems = options.items || [];
  let lastLayoutKey = '';
  /** @type {Map<string, { itemEl: HTMLElement, underEl: HTMLElement | null }>} */
  const pool = new Map();

  function render({ forcePaint = false } = {}) {
    const avail = packWidth(el, host.clientWidth || 600);
    const cols = colsForWidth(avail, baseCellPx, minCols, maxCols);
    const cellPx = fillWidth ? cellPxFill(avail, cols, baseCellPx) : baseCellPx;
    const layoutKey = `${avail}:${cols}:${cellPx}`;
    const layoutChanged = layoutKey !== lastLayoutKey;
    lastLayoutKey = layoutKey;
    if (!forcePaint && !layoutChanged && el.childElementCount) return;

    const itemsById = new Map(currentItems.map((i) => [i.id, i]));
    const { placements, rows } = packItems(currentItems, cols, { compact });
    paintPooled(el, {
      cols,
      rows,
      cellPx,
      fillWidth,
      placements,
      itemsById,
      getSpriteUrl: options.getSpriteUrl,
      pool,
      parkRest: false,
    });
  }

  const ro = new ResizeObserver(() => render());
  ro.observe(el);
  render({ forcePaint: true });

  return {
    el,
    update(items) {
      currentItems = items || [];
      render({ forcePaint: true });
    },
    /**
     * @param {{ keepHost?: boolean }} [opts]
     */
    destroy(opts = {}) {
      ro.disconnect();
      pool.clear();
      if (!opts.keepHost) el.remove();
    },
  };
}

/**
 * Render explicit placements (build backpacks).
 *
 * @param {Element | string} container
 * @param {{
 *   placements: { id: string, x: number, y: number }[],
 *   itemsById: Map<string, object> | Record<string, object>,
 *   cols: number,
 *   rows?: number,
 *   getSpriteUrl: (item: object) => string,
 *   cellPx?: number,
 *   fillWidth?: boolean,
 *   fitHost?: boolean,
 *   exactBoard?: boolean,
 *   reserveScrollGap?: boolean,
   *   appear?: boolean,
   *   appearNewOnly?: boolean,
   *   appearMissing?: boolean,
   *   appearOrder?: 'reading' | 'diagonal' | 'diagonal-top-right',
 *   appearStaggerMs?: number,
 *   preserveBagFabric?: boolean,
 *   promo?: boolean,
 *   promoInteractive?: boolean,
 *   ringConfig?: boolean,
 * }} options
 */
export function mountPlacedGrid(container, options) {
  const host = typeof container === 'string' ? document.querySelector(container) : container;
  if (!host) throw new Error('mountPlacedGrid: container not found');

  let el = host.querySelector(':scope > .bpb-bg');
  if (!(el instanceof HTMLElement)) {
    el = document.createElement('div');
    host.replaceChildren(el);
  }
  el.className =
    'bpb-bg bpb-bg--placed' + (options.promo === true ? ' bpb-bg--promo' : '');

  const map =
    options.itemsById instanceof Map
      ? options.itemsById
      : new Map(Object.entries(options.itemsById || {}));

  let maxY = 0;
  for (const p of options.placements || []) {
    const item = map.get(p.id);
    if (!item) continue;
    const face = Number(p.r) || 0;
    const shape = shapeForItem(item, face);
    const bounds = face ? bodyBounds(shape) : item.__bpbBounds || (item.__bpbBounds = bodyBounds(shape));
    maxY = Math.max(maxY, p.y + bounds.h);
  }

  const cols = options.cols;
  let rows = options.rows ?? Math.max(1, maxY);
  const fixedRows = options.rows != null;
  const baseCellPx = options.cellPx ?? CELL_PX_DEFAULT;
  const fillWidth = options.fillWidth === true;
  const fitHost = options.fitHost === true;
  // Build boards: exact cols×cell, no Itemiary scrollbar gutter (avoids right-edge clip)
  const exactBoard = options.exactBoard !== false;
  const reserveScrollGap = options.reserveScrollGap === true;
  let placements = options.placements || [];
  let itemsById = map;
  let lastLayoutKey = '';
  /** First paint uses options.appear (items-page AppearInLibrary wave). */
  let appearOnce = options.appear === true;
  /** Optional keep-alive set for staged previews that reveal existing entries only once. */
  let previousShown = null;
  /** @type {Map<string, { itemEl: HTMLElement, underEl: HTMLElement | null }>} */
  const pool = new Map();
  let resizePaused = false;
  let resizePending = false;
  let resizeRaf = 0;

  function render({
    forcePaint = false,
    appear = false,
    appearNewOnly = options.appearNewOnly === true,
    appearMissing = options.appearMissing === true,
    animateFace = false,
    animateFaceKeys = null,
    faceContinue = null,
    preserveBagFabric = false,
  } = {}) {
    const fallback = cols * baseCellPx;
    // Prefer host width — measuring `el` after a large first paint locks fillWidth
    // to the oversized board (feed compact thumbs were leaking at 60px cells).
    const avail = reserveScrollGap
      ? packWidth(el, host.clientWidth || fallback)
      : Math.max(1, host.clientWidth || el.clientWidth || fallback);
    const cellPx = fitHost ? cellPxFitHost(host, cols, rows, baseCellPx) : fillWidth ? cellPxFill(avail, cols, baseCellPx) : baseCellPx;
    const layoutKey = `${avail}:${host.clientHeight}:${cols}:${cellPx}:${rows}`;
    const layoutChanged = layoutKey !== lastLayoutKey;
    lastLayoutKey = layoutKey;
    if (!forcePaint && !layoutChanged && el.childElementCount) return;

    const doAppear = appear === true || appearOnce;
    appearOnce = false;

    paintPooled(el, {
      cols,
      rows,
      cellPx,
      fillWidth,
      exactBoard,
      placements,
      itemsById,
      getSpriteUrl: options.getSpriteUrl,
      pool,
      prevShown: appearNewOnly ? previousShown : undefined,
      appearNewOnly,
      appearMissing,
      // Park items not in the current round (round scrubber / board updates)
      parkRest: true,
      appear: doAppear,
      appearLayer: 'item',
      appearOrder:
        options.appearOrder === 'diagonal-top-right'
          ? 'diagonal-top-right'
          : options.appearOrder === 'diagonal'
            ? 'diagonal'
            : 'reading',
      appearStaggerMs: options.appearStaggerMs,
      preserveBagFabric:
        preserveBagFabric === true || options.preserveBagFabric === true,
      promoInteractive: options.promoInteractive === true,
      animateFace: animateFace === true,
      animateFaceKeys:
        animateFaceKeys instanceof Set ? animateFaceKeys : null,
      faceContinue: faceContinue instanceof Map ? faceContinue : null,
      ringConfig: options.ringConfig === true,
    });
    if (options.appearNewOnly === true || appearNewOnly === true) {
      previousShown = new Set(
        [...pool.entries()]
          .filter(([, entry]) => entry.shown)
          .map(([key]) => key),
      );
    }
  }

  function scheduleResizePaint() {
    if (resizePaused) {
      resizePending = true;
      return;
    }
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      void render();
    });
  }

  let ro = null;
  if (fillWidth || fitHost) {
    ro = new ResizeObserver(scheduleResizePaint);
    ro.observe(fitHost ? host : el);
  }
  render({ forcePaint: true });

  return {
    el,
    /**
     * @param {{ id: string, x: number, y: number }[]} nextPlacements
     * @param {Map<string, object> | Record<string, object>} [nextItemsById]
     * @param {{
     *   appear?: boolean,
     *   appearNewOnly?: boolean,
     *   appearMissing?: boolean,
     *   preserveBagFabric?: boolean,
     *   animateFace?: boolean,
     *   animateFaceKeys?: Set<string>,
     *   faceContinue?: Map<string, { fromDeg: number, durationMs?: number }>,
     * }} [opts]
     */
    update(nextPlacements, nextItemsById, opts = {}) {
      placements = nextPlacements || [];
      if (nextItemsById instanceof Map) itemsById = nextItemsById;
      else if (nextItemsById)
        itemsById = new Map(Object.entries(nextItemsById));
      if (!fixedRows) {
        let nextMaxY = 0;
        for (const p of placements) {
          const item = itemsById.get(p.id);
          if (!item) continue;
          const face = Number(p.r) || 0;
          const shape = shapeForItem(item, face);
          const bounds = face
            ? bodyBounds(shape)
            : item.__bpbBounds || (item.__bpbBounds = bodyBounds(shape));
          nextMaxY = Math.max(nextMaxY, p.y + bounds.h);
        }
        rows = Math.max(1, nextMaxY);
      }
      render({
        forcePaint: true,
        appear: opts.appear === true,
        appearNewOnly:
          opts.appearNewOnly === undefined
            ? options.appearNewOnly === true
            : opts.appearNewOnly === true,
        appearMissing:
          opts.appearMissing === undefined
            ? options.appearMissing === true
            : opts.appearMissing === true,
        preserveBagFabric: opts.preserveBagFabric === true,
        animateFace: opts.animateFace === true,
        animateFaceKeys: opts.animateFaceKeys,
        faceContinue: opts.faceContinue,
      });
    },
    /**
     * Defer responsive repaints while a staged promo wave is running. The
     * latest resize is coalesced and painted once the wave releases the gate.
     * @param {boolean} paused
     */
    setResizePaused(paused) {
      resizePaused = paused === true;
      if (!resizePaused && resizePending) {
        resizePending = false;
        scheduleResizePaint();
      }
    },
    /**
     * Remove parked item nodes that are outside the next staged board.
     *
     * Placed grids normally keep parked nodes alive for instant re-entry. The
     * Home Player Info loop rotates through public builds instead of offering
     * a scrollable keep-alive surface, so it can safely release old entries
     * after the departure animation has finished. Visible entries are never
     * touched; callers may retain a small next-build key window.
     *
     * @param {{ keepKeys?: Set<string> }} [opts]
     * @returns {number} number of parked placement nodes removed
     */
    pruneParked(opts = {}) {
      const keepKeys = opts.keepKeys instanceof Set ? opts.keepKeys : new Set();
      let removed = 0;
      for (const [key, entry] of pool) {
        if (entry.shown || keepKeys.has(key)) continue;
        entry.itemEl.remove();
        entry.underEl?.remove();
        pool.delete(key);
        removed += 1;
      }
      if (previousShown) {
        for (const key of [...previousShown]) {
          if (!pool.has(key)) previousShown.delete(key);
        }
      }
      return removed;
    },
    /**
     * @param {{ keepHost?: boolean }} [opts]
     */
    destroy(opts = {}) {
      ro?.disconnect();
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = 0;
      resizePending = false;
      pool.clear();
      if (!opts.keepHost) el.remove();
    },
  };
}
