/**
 * Itemiary viewport window — near-scroll placements stay placed; the rest
 * park warm in the pool (DOM + decoded sprites kept) so scrubbing does not
 * rebuild nodes or re-decode thumbs.
 */

import { unmountLiveArt } from '../item-live-art/index.js';
import { bodyBounds, shapeForItem } from './shape.js';
import {
  clearAppear,
  markSpritePending,
  parkEntry,
} from './item-pieces.js';

/** Extra rows above/below the scroller that stay placed (prefetch). */
export const VIRTUAL_PAD_EM = 6;
/** AppearInLibrary reverse — short enough that scroll does not feel sticky. */
export const ITEM_LEAVE_MS = 220;
/** Skip the leave wave when a filter dumps many pieces at once. */
export const MAX_LEAVE_ANIM = 18;

export function itemWidthEm(item) {
  if (!item) return 1;
  const bounds =
    item.__bpbBounds || (item.__bpbBounds = bodyBounds(shapeForItem(item)));
  return bounds?.w > 0 ? bounds.w : 1;
}

/**
 * @param {object | null | undefined} item
 */
export function itemHeightEm(item) {
  if (!item) return 1;
  const bounds =
    item.__bpbBounds || (item.__bpbBounds = bodyBounds(shapeForItem(item)));
  return bounds?.h > 0 ? bounds.h : 1;
}

/**
 * Build the small row index used by Itemiary viewport queries. Bounds are
 * computed once per packed/placed layout, then reused while scrolling.
 *
 * @param {{ id: string, x: number, y: number }[]} placements
 * @param {Map<string, object>} itemsById
 * @returns {{ placements: typeof placements, rows: Map<number, object[]>, count: number }}
 */
export function buildPlacementIndex(placements, itemsById) {
  const rows = new Map();
  let count = 0;
  for (const placement of placements) {
    const item = itemsById.get(placement.id);
    const x = Number(placement.x) || 0;
    const y = Number(placement.y) || 0;
    const width = itemWidthEm(item);
    const height = itemHeightEm(item);
    const rowStart = Math.floor(y);
    const rowEnd = Math.max(rowStart, Math.ceil(y + height) - 1);
    const entry = {
      placement,
      index: count++,
      x,
      y,
      width,
      height,
      rowStart,
      rowEnd,
    };
    for (let row = rowStart; row <= rowEnd; row += 1) {
      const bucket = rows.get(row);
      if (bucket) bucket.push(entry);
      else rows.set(row, [entry]);
    }
  }
  return { placements, rows, count };
}

/**
 * @param {{ id: string, x: number, y: number }[]} placements
 * @param {Map<string, object>} itemsById
 * @param {{
 *   cellPx: number,
 *   rows: number,
 *   scrollTop: number,
 *   clientHeight: number,
 *   scrollLeft?: number,
 *   clientWidth?: number,
 * }} metrics
 * @param {number} [padEm]
 * @param {{ placements: typeof placements, rows: Map<number, object[]>, count: number } | null} [index]
 */
export function placementsNearViewport(
  placements,
  itemsById,
  metrics,
  padEm = VIRTUAL_PAD_EM,
  index = null,
) {
  if (!placements.length) return [];
  const cellPx = metrics.cellPx > 0 ? metrics.cellPx : 34;
  const clientHeight = metrics.clientHeight || 0;
  const rows = metrics.rows > 0 ? metrics.rows : 1;
  const maxScroll = Math.max(0, rows * cellPx - clientHeight);
  const scrollTop = Math.min(Math.max(0, metrics.scrollTop || 0), maxScroll);
  const viewBottom = scrollTop + Math.max(clientHeight, cellPx);
  const padPx = padEm * cellPx;
  /** @type {typeof placements} */
  const near = [];
  const indexed = index?.placements === placements && index.rows instanceof Map;
  const candidates = [];
  if (indexed) {
    const firstRow = Math.floor(Math.max(0, (scrollTop - padPx) / cellPx));
    const lastRow = Math.floor(
      Math.min(Math.ceil(rows) - 1, (viewBottom + padPx) / cellPx),
    );
    const seen = new Set();
    for (let row = firstRow; row <= lastRow; row += 1) {
      for (const entry of index.rows.get(row) || []) {
        if (seen.has(entry.index)) continue;
        seen.add(entry.index);
        candidates.push(entry);
      }
    }
    candidates.sort((a, b) => a.index - b.index);
  } else {
    for (let i = 0; i < placements.length; i += 1) {
      const p = placements[i];
      candidates.push({
        placement: p,
        x: Number(p.x) || 0,
        y: Number(p.y) || 0,
        width: itemWidthEm(itemsById.get(p.id)),
        height: itemHeightEm(itemsById.get(p.id)),
      });
    }
  }
  for (const entry of candidates) {
    const p = entry.placement;
    const topPx = entry.y * cellPx;
    const bottomPx = topPx + entry.height * cellPx;
    if (bottomPx < scrollTop - padPx || topPx > viewBottom + padPx) continue;
    const clientWidth = metrics.clientWidth || 0;
    if (clientWidth > 0) {
      const scrollLeft = Math.max(0, metrics.scrollLeft || 0);
      const viewRight = scrollLeft + clientWidth;
      const leftPx = entry.x * cellPx;
      const rightPx = leftPx + entry.width * cellPx;
      if (rightPx < scrollLeft - padPx || leftPx > viewRight + padPx) continue;
    }
    near.push(p);
  }
  return near;
}

/**
 * Drop decoded sprites so off-screen Itemiary nodes do not keep bitmaps.
 * @param {HTMLElement} itemEl
 */
export function coolItemSprites(itemEl) {
  if (!(itemEl instanceof HTMLElement)) return;
  for (const img of itemEl.querySelectorAll(
    'img.bpb-bg__sprite[src], img.bpb-live__layer[src]',
  )) {
    if (!(img instanceof HTMLImageElement)) continue;
    const src = img.getAttribute('src');
    if (src && !img.getAttribute('data-src')) img.setAttribute('data-src', src);
    img.removeAttribute('src');
  }
  unmountLiveArt(itemEl);
  markSpritePending(itemEl);
}

/**
 * @param {HTMLElement} itemEl
 * @param {HTMLElement | null} underEl
 */
export function startItemLeave(itemEl, underEl) {
  clearAppear(itemEl, underEl);
  itemEl.classList.add('bpb-bg__item--leave');
  underEl?.classList.add('bpb-bg__under-item--leave');
}

/**
 * @param {HTMLElement} itemEl
 * @param {HTMLElement | null} underEl
 */
export function cancelItemLeave(itemEl, underEl) {
  itemEl.classList.remove('bpb-bg__item--leave');
  underEl?.classList.remove('bpb-bg__under-item--leave');
}

/**
 * Unload sprites + drop the node (teardown / hard reset only).
 * @param {{
 *   itemEl: HTMLElement,
 *   underEl: HTMLElement | null,
 *   shown?: boolean,
 *   x?: number,
 *   y?: number,
 * } | null | undefined} entry
 */
export function recycleEntry(entry) {
  if (!entry?.itemEl) return;
  cancelItemLeave(entry.itemEl, entry.underEl);
  coolItemSprites(entry.itemEl);
  entry.itemEl.remove();
  entry.underEl?.remove();
}

/**
 * Keep-alive warm park: leave decoded sprites attached, only stop live-art
 * RAF/WebGL, then park off-board. Scrubbing back skips re-decode.
 * @param {{
 *   itemEl: HTMLElement,
 *   underEl: HTMLElement | null,
 *   shown?: boolean,
 *   x?: number,
 *   y?: number,
 * } | null | undefined} entry
 */
export function parkWarmEntry(entry) {
  if (!entry?.itemEl) return;
  cancelItemLeave(entry.itemEl, entry.underEl);
  unmountLiveArt(entry.itemEl);
  parkEntry(entry.itemEl, entry.underEl);
  entry.shown = false;
  entry.x = NaN;
  entry.y = NaN;
}

/**
 * After leave clip — warm park; does not destroy the node or cool sprites.
 * @param {{
 *   itemEl: HTMLElement,
 *   underEl: HTMLElement | null,
 *   shown?: boolean,
 *   x?: number,
 *   y?: number,
 * }} entry
 */
export function finishItemLeave(entry) {
  parkWarmEntry(entry);
}
