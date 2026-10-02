/**
 * Compact Itemiary preview for the homepage create promo (left of the empty board).
 *
 *   import {
 *     mountPromoCatalog,
 *     seekPromoCatalogItem,
 *     hidePromoCatalogItem,
 *     restorePromoCatalogItems,
 *     prefetchPromoCatalogItems,
 *   } from './home-promo-catalog.js';
 */

import { getSupabase } from '../../shared/supabase.js';
import {
  attachSpriteSrc,
  mountItemiaryGrid,
} from '../../shared/backpack-grid/index.js';
import { loadLiveArt } from '../../shared/item-live-art/index.js';
import {
  applyShapes,
  applySocketOffsets,
  makeSpriteUrl,
  mapItem,
} from '../build/map-item.js';
import {
  CATALOG_APPEAR_MS,
  CATALOG_CELL_PX,
  currentTranslateY,
  isPackedCatalogItem,
  itemMidYInTrack,
  pendingInBand,
  prefetchPromoCatalogItems,
  revealCatalogNear,
  warmPending,
  warmVisibleCatalog,
} from './home-promo-catalog-warm.js';

export { prefetchPromoCatalogItems };

/** Sprites + pack only — skip tooltip/combat blobs (those dominate payload). */
const ITEM_SELECT =
  'id, gid, name, rarity, type, class, extra_types, tags, image, sockets';

const CATALOG_COLS = 10;
const SEEK_TIMEOUT_MS = 540;
const SEEK_SNAP_PX = 2;
const CATALOG_DEPART_MS = 400;

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
 * Wrap the packed grid in a transform track (no DOM clone — one catalog copy).
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
 * Keep the single catalog copy inside the clip (no looping clone).
 * @param {HTMLElement} track
 * @param {HTMLElement} catalogRoot
 */
function clampTrack(track, catalogRoot) {
  const copyH = copyHeight(track);
  if (copyH < 8) return;
  const clipH = catalogRoot.getBoundingClientRect().height || 0;
  const minY = Math.min(0, clipH - copyH);
  let y = currentTranslateY(track);
  if (y > 0) y = 0;
  if (y < minY) y = minY;
  const cur = currentTranslateY(track);
  if (Math.abs(cur - y) < 0.5) return;
  track.style.transition = 'none';
  track.style.transform = `translateY(${y}px)`;
  track.style.transition = '';
}

/**
 * @param {HTMLElement} catalogRoot
 * @param {string} itemId
 * @param {number} viewMidLocal
 * @returns {HTMLElement | null}
 */
function nearestPackedNode(catalogRoot, itemId, viewMidLocal) {
  let nearest = null;
  let nearestAbs = Infinity;
  const nodes = catalogRoot.querySelectorAll(
    `.bpb-bg__item[data-item-id="${CSS.escape(itemId)}"]`,
  );
  for (const node of nodes) {
    if (!(node instanceof HTMLElement) || !isPackedCatalogItem(node)) continue;
    const d = Math.abs(itemMidYInTrack(node) - viewMidLocal);
    if (d < nearestAbs) {
      nearestAbs = d;
      nearest = node;
    }
  }
  return nearest;
}

/**
 * Scroll the catalog so the packed slot for `itemId` is in view, then paint it.
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

    const clipH = catalogRoot.getBoundingClientRect().height || 1;
    const copyH = copyHeight(track);
    const minY = Math.min(0, clipH - copyH);
    const currentY = currentTranslateY(track);
    const viewMidLocal = -currentY + clipH * 0.38;
    const best = nearestPackedNode(catalogRoot, itemId, viewMidLocal);
    if (!best) {
      resolve(null);
      return;
    }

    const destMid = itemMidYInTrack(best);
    const targetY = Math.max(
      minY,
      Math.min(0, clipH * 0.38 - destMid),
    );
    const bestAbs = Math.abs(targetY - currentY);
    void warmPending(
      catalogRoot,
      pendingInBand(catalogRoot, viewMidLocal, destMid, clipH * 0.9),
    );

    let raf = 0;
    let lastWarm = 0;
    const tickWarm = (now) => {
      if (now - lastWarm > 48) {
        lastWarm = now;
        void warmVisibleCatalog(catalogRoot);
      }
      raf = requestAnimationFrame(tickWarm);
    };

    const finish = () => {
      if (raf) window.cancelAnimationFrame(raf);
      clampTrack(track, catalogRoot);
      const y = currentTranslateY(track);
      const mid = -y + clipH * 0.38;
      const node = nearestPackedNode(catalogRoot, itemId, mid) || best;
      void revealCatalogNear(catalogRoot, node).then(() => resolve(node));
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
    raf = requestAnimationFrame(tickWarm);
    track.style.transform = `translateY(${targetY}px)`;
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
    )].filter((n) => n instanceof HTMLElement && isPackedCatalogItem(n));
    if (!nodes.length) {
      resolve();
      return;
    }
    for (const n of nodes) {
      attachSpriteSrc(n);
      n.classList.remove('home-promo__item--appear');
      n.classList.add('home-promo__item--depart');
    }
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
    for (const n of nodes) {
      n.classList.remove('home-promo__item--depart');
      n.classList.add('home-promo__item--appear');
    }
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
    loadLiveArt(),
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
  const catalogClip = host.querySelector('[data-promo-catalog-root]');
  const grid = mountItemiaryGrid(stage, {
    getSpriteUrl,
    cellPx: CATALOG_CELL_PX,
    cols: CATALOG_COLS,
    fillWidth: true,
    promo: true,
    spriteRoot: catalogClip instanceof HTMLElement ? catalogClip : stage,
  });
  await grid.showPacked(items, { compact: true, appear: false });
  loopCatalogTrack(grid.el);
  const clip =
    catalogClip instanceof HTMLElement ? catalogClip : stage;
  void warmVisibleCatalog(clip);
}
