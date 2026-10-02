/**
 * Homepage promo catalog sprite warm — visible band only, keep src once set.
 */

import {
  attachSpriteSrc,
  needsSpriteAttach,
  warmItemSprites,
} from '../../shared/backpack-grid/index.js';

export const CATALOG_CELL_PX = 22;
export const CATALOG_APPEAR_MS = 500;
const PARK_LEFT_EM = -100;

/**
 * @param {HTMLElement} node
 */
export function isPackedCatalogItem(node) {
  if (node.classList.contains('bpb-bg__item--parked')) return false;
  if (node.classList.contains('home-promo__item--depart')) return false;
  const left = parseFloat(node.style.left);
  return !(Number.isFinite(left) && left < PARK_LEFT_EM);
}

/**
 * @param {HTMLElement} el
 */
export function currentTranslateY(el) {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  try {
    return new DOMMatrixReadOnly(t).m42;
  } catch {
    return 0;
  }
}

/**
 * @param {Element | null} grid
 */
function catalogCellPx(grid) {
  if (!(grid instanceof HTMLElement)) return CATALOG_CELL_PX;
  const v = parseFloat(getComputedStyle(grid).getPropertyValue('--bpb-bg-cell'));
  return v > 0 ? v : CATALOG_CELL_PX;
}

/**
 * Packed midpoint in track-local px (ignores scale(0) pending sprites).
 * @param {HTMLElement} node
 */
export function itemMidYInTrack(node) {
  const grid = node.closest('.bpb-bg');
  const cellPx = catalogCellPx(grid);
  const topEm = parseFloat(node.style.top) || 0;
  const hEm = parseFloat(node.style.height) || 1;
  const board =
    grid instanceof HTMLElement
      ? grid.querySelector(':scope > .bpb-bg__board')
      : null;
  const boardTop = board instanceof HTMLElement ? board.offsetTop : 0;
  return boardTop + (topEm + hEm / 2) * cellPx;
}

/**
 * @param {HTMLElement} catalogRoot
 * @returns {HTMLElement[]}
 */
function packedCatalogItems(catalogRoot) {
  const grid = catalogRoot.querySelector('.bpb-bg');
  if (!(grid instanceof Element)) return [];
  /** @type {HTMLElement[]} */
  const out = [];
  for (const node of grid.querySelectorAll('.bpb-bg__item')) {
    if (node instanceof HTMLElement && isPackedCatalogItem(node)) out.push(node);
  }
  return out;
}

/**
 * @param {HTMLElement} catalogRoot
 * @param {number} y0
 * @param {number} y1
 * @param {number} pad
 * @returns {HTMLElement[]}
 */
export function pendingInBand(catalogRoot, y0, y1, pad) {
  const lo = Math.min(y0, y1) - pad;
  const hi = Math.max(y0, y1) + pad;
  /** @type {HTMLElement[]} */
  const pending = [];
  for (const node of packedCatalogItems(catalogRoot)) {
    const mid = itemMidYInTrack(node);
    if (mid < lo || mid > hi) continue;
    if (needsSpriteAttach(node)) pending.push(node);
  }
  return pending;
}

/**
 * @param {HTMLElement} catalogRoot
 * @param {HTMLElement[]} nodes
 */
function popInVisible(catalogRoot, nodes) {
  const clip = catalogRoot.getBoundingClientRect();
  /** @type {HTMLElement[]} */
  const shown = [];
  for (const n of nodes) {
    const r = n.getBoundingClientRect();
    if (r.bottom < clip.top - 4 || r.top > clip.bottom + 4) continue;
    n.classList.remove('home-promo__item--depart');
    n.classList.add('home-promo__item--appear');
    shown.push(n);
  }
  if (!shown.length) return;
  window.setTimeout(() => {
    for (const n of shown) n.classList.remove('home-promo__item--appear');
  }, CATALOG_APPEAR_MS + 16);
}

/** @type {Promise<void> | null} */
let catalogWarmLock = null;

/**
 * @param {HTMLElement} catalogRoot
 * @param {HTMLElement[]} pending
 */
export function warmPending(catalogRoot, pending) {
  if (!pending.length) return Promise.resolve();
  if (catalogWarmLock) return catalogWarmLock;
  catalogWarmLock = warmItemSprites(pending)
    .then(() => popInVisible(catalogRoot, pending))
    .finally(() => {
      catalogWarmLock = null;
    });
  return catalogWarmLock;
}

/**
 * @param {HTMLElement} catalogRoot
 */
export function warmVisibleCatalog(catalogRoot) {
  const track = catalogRoot.querySelector('.home-promo__catalog-track');
  const clipH = catalogRoot.getBoundingClientRect().height || 1;
  const y = track instanceof HTMLElement ? currentTranslateY(track) : 0;
  const viewTop = -y;
  const viewBot = -y + clipH;
  return warmPending(
    catalogRoot,
    pendingInBand(catalogRoot, viewTop, viewBot, clipH * 0.85),
  );
}

/**
 * @param {HTMLElement} catalogRoot
 * @param {HTMLElement} focus
 */
export function revealCatalogNear(catalogRoot, focus) {
  const clipH = catalogRoot.getBoundingClientRect().height || 1;
  const focusMid = itemMidYInTrack(focus);
  const pending = pendingInBand(catalogRoot, focusMid, focusMid, clipH * 0.85);
  if (!pending.includes(focus) && needsSpriteAttach(focus)) pending.push(focus);
  if (!pending.length) {
    attachSpriteSrc(focus);
    return Promise.resolve();
  }
  return warmPending(catalogRoot, pending);
}

/**
 * Decode packed copies for these ids wherever they sit (keep in memory).
 * @param {Element | null} catalogRoot
 * @param {Iterable<string>} itemIds
 * @returns {Promise<void>}
 */
export function prefetchPromoCatalogItems(catalogRoot, itemIds) {
  if (!(catalogRoot instanceof HTMLElement)) return Promise.resolve();
  const want = new Set();
  for (const id of itemIds) {
    if (id) want.add(String(id));
  }
  if (!want.size) return Promise.resolve();
  /** @type {HTMLElement[]} */
  const pending = [];
  for (const node of packedCatalogItems(catalogRoot)) {
    if (!want.has(node.dataset.itemId || '')) continue;
    if (needsSpriteAttach(node)) pending.push(node);
  }
  if (!pending.length) return Promise.resolve();
  return warmItemSprites(pending);
}
