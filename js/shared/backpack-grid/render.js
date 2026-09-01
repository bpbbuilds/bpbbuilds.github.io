/**
 * DOM mounts for backpack grids (builds + generic packed/placed).
 * Catalog Itemiary uses mountItemiaryGrid from item-pool.js.
 */

import { shapeForItem, bodyBounds } from './shape.js';
import { packItems, colsForWidth } from './pack.js';
import { paintPooled, packWidth, cellPxFill } from './item-pool.js';

const CELL_PX_DEFAULT = 34;

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
 *   exactBoard?: boolean,
 *   reserveScrollGap?: boolean,
 *   appear?: boolean,
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
  el.className = 'bpb-bg bpb-bg--placed';

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
  // Build boards: exact cols×cell, no Itemiary scrollbar gutter (avoids right-edge clip)
  const exactBoard = options.exactBoard !== false;
  const reserveScrollGap = options.reserveScrollGap === true;
  let placements = options.placements || [];
  let itemsById = map;
  let lastLayoutKey = '';
  /** First paint uses options.appear (items-page AppearInLibrary wave). */
  let appearOnce = options.appear === true;
  /** @type {Map<string, { itemEl: HTMLElement, underEl: HTMLElement | null }>} */
  const pool = new Map();

  function render({
    forcePaint = false,
    appear = false,
    animateFace = false,
    animateFaceKeys = null,
    faceContinue = null,
  } = {}) {
    const fallback = cols * baseCellPx;
    // Prefer host width — measuring `el` after a large first paint locks fillWidth
    // to the oversized board (feed compact thumbs were leaking at 60px cells).
    const avail = reserveScrollGap
      ? packWidth(el, host.clientWidth || fallback)
      : Math.max(1, host.clientWidth || el.clientWidth || fallback);
    const cellPx = fillWidth ? cellPxFill(avail, cols, baseCellPx) : baseCellPx;
    const layoutKey = `${avail}:${cols}:${cellPx}:${rows}`;
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
      // Park items not in the current round (round scrubber / board updates)
      parkRest: true,
      appear: doAppear,
      appearLayer: 'item',
      animateFace: animateFace === true,
      animateFaceKeys:
        animateFaceKeys instanceof Set ? animateFaceKeys : null,
      faceContinue: faceContinue instanceof Map ? faceContinue : null,
    });
  }

  let ro = null;
  if (fillWidth) {
    ro = new ResizeObserver(() => render());
    ro.observe(el);
  }
  render({ forcePaint: true });

  return {
    el,
    /**
     * @param {{ id: string, x: number, y: number }[]} nextPlacements
     * @param {Map<string, object> | Record<string, object>} [nextItemsById]
     * @param {{
     *   appear?: boolean,
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
        animateFace: opts.animateFace === true,
        animateFaceKeys: opts.animateFaceKeys,
        faceContinue: opts.faceContinue,
      });
    },
    /**
     * @param {{ keepHost?: boolean }} [opts]
     */
    destroy(opts = {}) {
      ro?.disconnect();
      pool.clear();
      if (!opts.keepHost) el.remove();
    },
  };
}
