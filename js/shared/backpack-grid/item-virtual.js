/**
 * Itemiary viewport window — near-scroll placements stay placed; the rest
 * cool+park in the pool (DOM kept, sprites unloaded) so scrubbing does not
 * rebuild nodes.
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
 * @param {{ id: string, x: number, y: number }[]} placements
 * @param {Map<string, object>} itemsById
 * @param {{
 *   cellPx: number,
 *   rows: number,
 *   scrollTop: number,
 *   clientHeight: number,
 * }} metrics
 * @param {number} [padEm]
 */
export function placementsNearViewport(
  placements,
  itemsById,
  metrics,
  padEm = VIRTUAL_PAD_EM,
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
  for (const p of placements) {
    const h = itemHeightEm(itemsById.get(p.id));
    const topPx = (Number(p.y) || 0) * cellPx;
    const bottomPx = topPx + h * cellPx;
    if (bottomPx >= scrollTop - padPx && topPx <= viewBottom + padPx) {
      near.push(p);
    }
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
 * Keep-alive: cool bitmaps + park off-board, leave the pool entry in place.
 * @param {{
 *   itemEl: HTMLElement,
 *   underEl: HTMLElement | null,
 *   shown?: boolean,
 *   x?: number,
 *   y?: number,
 * } | null | undefined} entry
 */
export function parkCooledEntry(entry) {
  if (!entry?.itemEl) return;
  cancelItemLeave(entry.itemEl, entry.underEl);
  coolItemSprites(entry.itemEl);
  parkEntry(entry.itemEl, entry.underEl);
  entry.shown = false;
  entry.x = NaN;
  entry.y = NaN;
}

/**
 * After leave clip — keep-alive parks; does not destroy the node.
 * @param {{
 *   itemEl: HTMLElement,
 *   underEl: HTMLElement | null,
 *   shown?: boolean,
 *   x?: number,
 *   y?: number,
 * }} entry
 */
export function finishItemLeave(entry) {
  parkCooledEntry(entry);
}
