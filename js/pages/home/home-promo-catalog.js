/**
 * Compact Itemiary preview for the homepage create promo (left of the empty board).
 *
 *   import {
 *     mountPromoCatalog,
 *     seekPromoCatalogItem,
 *     hidePromoCatalogItem,
 *     restorePromoCatalogItems,
 *   } from './home-promo-catalog.js';
 */

import { getSupabase } from '../../shared/supabase.js';
import { mountItemiaryGrid } from '../../shared/backpack-grid/index.js';
import {
  applyShapes,
  applySocketOffsets,
  makeSpriteUrl,
  mapItem,
} from '../build/map-item.js';

/** Sprites + pack only — skip tooltip/combat blobs (those dominate payload). */
const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, image, sockets';

const CATALOG_COLS = 10;
const CATALOG_CELL_PX = 22;
const SEEK_TIMEOUT_MS = 540;
const SEEK_SNAP_PX = 2;
const CATALOG_DEPART_MS = 400;
const CATALOG_APPEAR_MS = 500;

/**
 * @param {string} url
 */
async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Duplicate the packed grid so wrapping past the end stays seamless.
 * @param {HTMLElement} gridEl
 */
function loopCatalogTrack(gridEl) {
  const board = gridEl.querySelector(':scope > .bpb-bg__board');
  const contentH =
    (board instanceof HTMLElement && board.getBoundingClientRect().height) ||
    gridEl.scrollHeight;
  if (contentH < 8) return;

  gridEl.style.height = `${contentH}px`;
  gridEl.style.maxHeight = 'none';
  gridEl.style.overflow = 'hidden';
  gridEl.style.scrollbarGutter = 'auto';

  const track = document.createElement('div');
  track.className = 'home-promo__catalog-track';
  track.style.transform = 'translateY(0px)';

  gridEl.replaceWith(track);
  track.appendChild(gridEl);

  const clone = /** @type {HTMLElement} */ (gridEl.cloneNode(true));
  clone.setAttribute('aria-hidden', 'true');
  clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  track.appendChild(clone);
}

/**
 * @param {HTMLElement} el
 */
function currentTranslateY(el) {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  try {
    return new DOMMatrixReadOnly(t).m42;
  } catch {
    return 0;
  }
}

/**
 * @param {HTMLElement} track
 */
function copyHeight(track) {
  const first = track.firstElementChild;
  if (!(first instanceof HTMLElement)) return 0;
  return first.offsetHeight || first.getBoundingClientRect().height;
}

/**
 * Snap back by one copy after scrolling into the clone.
 * @param {HTMLElement} track
 */
function wrapTrack(track) {
  const copyH = copyHeight(track);
  if (copyH < 8) return;
  let y = currentTranslateY(track);
  if (y > -copyH + 0.5) return;
  while (y <= -copyH + 0.5) y += copyH;
  track.style.transition = 'none';
  track.style.transform = `translateY(${y}px)`;
  void track.getBoundingClientRect();
  track.style.transition = '';
}

/**
 * @param {HTMLElement} catalogRoot
 * @param {string} itemId
 * @returns {HTMLElement | null}
 */
function nearestCatalogNode(catalogRoot, itemId, midY) {
  let nearest = null;
  let nearestAbs = Infinity;
  const nodes = catalogRoot.querySelectorAll(
    `.bpb-bg__item[data-item-id="${CSS.escape(itemId)}"]`,
  );
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.classList.contains('home-promo__item--depart')) continue;
    const r = node.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const d = Math.abs((r.top + r.bottom) / 2 - midY);
    if (d < nearestAbs) {
      nearestAbs = d;
      nearest = node;
    }
  }
  return nearest;
}

/**
 * Scroll the catalog so the nearest copy of `itemId` is vertically centered.
 * @param {Element | null} catalogRoot
 * @param {string} itemId
 * @returns {Promise<HTMLElement | null>}
 */
export function seekPromoCatalogItem(catalogRoot, itemId) {
  return new Promise((resolve) => {
    if (!(catalogRoot instanceof HTMLElement) || !itemId) {
      resolve(null);
      return;
    }
    const track = catalogRoot.querySelector('.home-promo__catalog-track');
    if (!(track instanceof HTMLElement)) {
      resolve(null);
      return;
    }

    const clip = catalogRoot.getBoundingClientRect();
    const clipMid = (clip.top + clip.bottom) / 2;
    const currentY = currentTranslateY(track);

    /** @type {HTMLElement | null} */
    let best = null;
    let bestDelta = 0;
    let bestAbs = Infinity;
    const nodes = catalogRoot.querySelectorAll(
      `.bpb-bg__item[data-item-id="${CSS.escape(itemId)}"]`,
    );
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      const r = node.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (node.classList.contains('home-promo__item--depart')) continue;
      const delta = clipMid - (r.top + r.bottom) / 2;
      const abs = Math.abs(delta);
      if (abs < bestAbs) {
        bestAbs = abs;
        bestDelta = delta;
        best = node;
      }
    }
    if (!best) {
      resolve(null);
      return;
    }

    const finish = () => {
      wrapTrack(track);
      const clip2 = catalogRoot.getBoundingClientRect();
      const mid = (clip2.top + clip2.bottom) / 2;
      resolve(nearestCatalogNode(catalogRoot, itemId, mid) || best);
    };

    if (bestAbs <= SEEK_SNAP_PX) {
      finish();
      return;
    }

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      track.removeEventListener('transitionend', onEnd);
      finish();
    };
    const onEnd = (e) => {
      if (e.target === track && e.propertyName === 'transform') done();
    };
    const timer = window.setTimeout(done, SEEK_TIMEOUT_MS);
    track.addEventListener('transitionend', onEnd);
    track.style.transform = `translateY(${currentY + bestDelta}px)`;
  });
}

/**
 * Library-depart both packed copies of an item so the pull lifts off the catalog.
 * @param {Element | null} catalogRoot
 * @param {string} itemId
 * @returns {Promise<void>}
 */
export function hidePromoCatalogItem(catalogRoot, itemId) {
  return new Promise((resolve) => {
    if (!(catalogRoot instanceof HTMLElement) || !itemId) {
      resolve();
      return;
    }
    const nodes = [...catalogRoot.querySelectorAll(
      `.bpb-bg__item[data-item-id="${CSS.escape(itemId)}"]`,
    )].filter(
      (n) =>
        n instanceof HTMLElement &&
        !n.classList.contains('home-promo__item--depart'),
    );
    if (!nodes.length) {
      resolve();
      return;
    }
    for (const n of nodes) n.classList.remove('home-promo__item--appear');
    void catalogRoot.offsetWidth;
    for (const n of nodes) n.classList.add('home-promo__item--depart');
    window.setTimeout(resolve, CATALOG_DEPART_MS + 16);
  });
}

/**
 * Bring pulled catalog sprites back with the library appear pop.
 * @param {Element | null} catalogRoot
 * @returns {Promise<void>}
 */
export function restorePromoCatalogItems(catalogRoot) {
  return new Promise((resolve) => {
    if (!(catalogRoot instanceof HTMLElement)) {
      resolve();
      return;
    }
    const nodes = [
      ...catalogRoot.querySelectorAll('.bpb-bg__item.home-promo__item--depart'),
    ];
    if (!nodes.length) {
      resolve();
      return;
    }
    for (const n of nodes) n.classList.remove('home-promo__item--depart');
    void catalogRoot.offsetWidth;
    for (const n of nodes) n.classList.add('home-promo__item--appear');
    window.setTimeout(() => {
      for (const n of nodes) n.classList.remove('home-promo__item--appear');
      resolve();
    }, CATALOG_APPEAR_MS + 16);
  });
}

/**
 * @param {Element} host
 * @param {{ root: string }} opts
 */
export async function mountPromoCatalog(host, opts) {
  const stage = host.querySelector('[data-promo-catalog]');
  if (!(stage instanceof HTMLElement)) return;

  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;

  const [itemsRes, spriteDisplay, shapesData, socketData] = await Promise.all([
    getSupabase()
      .from('items')
      .select(ITEM_SELECT)
      .order('gid', { ascending: true, nullsFirst: false }),
    fetchJson(`${root}assets/data/sprite-display.json`),
    fetchJson(`${root}assets/data/item-shapes.json`),
    fetchJson(`${root}assets/data/socket-offsets.json`),
  ]);

  if (itemsRes.error) {
    console.warn('[home-promo] catalog preview failed', itemsRes.error);
    stage.replaceChildren();
    return;
  }

  const items = (itemsRes.data || []).map(mapItem).filter((item) => item?.id);
  applyShapes(items, shapesData);
  applySocketOffsets(items, socketData);
  if (!items.length) {
    stage.replaceChildren();
    return;
  }

  const getSpriteUrl = makeSpriteUrl(root, spriteDisplay);
  for (const item of items) getSpriteUrl(item);

  stage.replaceChildren();
  const grid = mountItemiaryGrid(stage, {
    getSpriteUrl,
    cellPx: CATALOG_CELL_PX,
    cols: CATALOG_COLS,
    fillWidth: true,
  });
  await grid.showPacked(items, { compact: true, appear: false });
  loopCatalogTrack(grid.el);
}
