/**
 * Item Library click spotlight — full-page dim, FLIP item to focus, locked tooltip left.
 * Bags keep AppearInLibrarySmall scale(0.9) on the piece so FLIP matches the grid.
 *
 *   import { createSpotlight } from './spotlight.js';
 *   const spot = createSpotlight({ host, getTip, getSpriteUrl, getItemById, getFilteredOrder });
 *   spot.open(itemId, sourceEl);
 */

import { createItemEl, createUnderEl } from '../../shared/backpack-grid/index.js';

const OPEN_MS = 300;
const CLOSE_MS = 400;
const EASE = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
/** Fallback if catalog --bpb-bg-cell is missing (matches catalog CELL_PX). */
const FALLBACK_CELL_PX = 34;

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

/**
 * @param {DOMRectReadOnly} r
 */
function rectCenter(r) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * FLIP delta between rect centers.
 * @param {DOMRectReadOnly} from
 * @param {DOMRectReadOnly} to
 */
function flipDelta(from, to) {
  const a = rectCenter(from);
  const b = rectCenter(to);
  return { dx: a.x - b.x, dy: a.y - b.y };
}

/**
 * Catalog Itemiary bags rest at scale(0.9) (AppearInLibrarySmall). Spotlight
 * must use the same scale on the piece or close FLIP looks oversized then snaps.
 * @param {number} dx
 * @param {number} dy
 * @param {number} [scale=1]
 */
function pieceFlipTransform(dx, dy, scale = 1) {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (s === 1) return `translate(${dx}px, ${dy}px)`;
  return `translate(${dx}px, ${dy}px) scale(${s})`;
}

/**
 * @param {{
 *   host: Element,
 *   getTip: () => {
 *     lock: (item: object, opts?: { stage?: Element | null }) => void,
 *     unlock: () => void,
 *     host: HTMLElement,
 *   } | null,
 *   getSpriteUrl: (item: object) => string,
 *   getItemById: (id: string) => object | undefined,
 *   getFilteredOrder: () => object[],
 *   recipes?: {
 *     showFor: (id: string, ctx?: {
 *       stage?: Element | null,
 *       piece?: Element | null,
 *       tipHost?: HTMLElement | null,
 *     }) => void,
 *     hide: () => void,
 *     el?: HTMLElement,
 *   } | null,
 *   builds?: {
 *     showFor: (id: string) => void,
 *     hide: () => void,
 *     el?: HTMLElement,
 *   } | null,
 * }} opts
 */
export function createSpotlight(opts) {
  const root = document.createElement('div');
  root.className = 'il-spotlight';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="il-spotlight__dim" data-spotlight-dim></div>
    <div class="il-spotlight__sheet" data-spotlight-sheet></div>
    <div class="il-spotlight__stage" data-spotlight-stage>
      <div
        class="il-spotlight__piece"
        data-spotlight-piece
        style="--bpb-bg-cell:${FALLBACK_CELL_PX}px;font-size:${FALLBACK_CELL_PX}px"
      >
        <div class="bpb-bg__under il-spotlight__under" data-spotlight-under aria-hidden="true"></div>
        <div class="bpb-bg__items il-spotlight__items" data-spotlight-items></div>
      </div>
    </div>`;

  document.body.appendChild(root);

  const dim = root.querySelector('[data-spotlight-dim]');
  const sheet = root.querySelector('[data-spotlight-sheet]');
  const stage = root.querySelector('[data-spotlight-stage]');
  const piece = root.querySelector('[data-spotlight-piece]');
  const underLayer = root.querySelector('[data-spotlight-under]');
  const itemsLayer = root.querySelector('[data-spotlight-items]');

  const mobileMq = window.matchMedia?.('(max-width: 900px)') || null;
  let mobileLayoutRaf = 0;
  /** @type {MutationObserver | null} */
  let mobilePanelObserver = null;

  /** @type {string | null} */
  let activeId = null;
  /** @type {Element | null} */
  let sourceEl = null;
  let open = false;
  let closing = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let closeTimer = null;
  /** @type {((e: TransitionEvent) => void) | null} */
  let pieceTransitionEnd = null;

  /** @type {Map<HTMLElement, { parent: Node, next: ChildNode | null }>} */
  const parked = new Map();

  /**
   * @param {HTMLElement} el
   */
  function parkInSheet(el) {
    if (!(sheet instanceof HTMLElement)) return;
    if (!parked.has(el)) {
      parked.set(el, { parent: el.parentNode || document.body, next: el.nextSibling });
    }
    sheet.appendChild(el);
  }

  function restoreParked() {
    for (const [el, home] of parked) {
      const parent = home.parent;
      if (!parent) continue;
      if (home.next && home.next.parentNode === parent) parent.insertBefore(el, home.next);
      else parent.appendChild(el);
    }
    parked.clear();
  }

  function clearMobileStackStyles() {
    restoreParked();
    root.style.removeProperty('--il-spotlight-top');
    if (stage instanceof HTMLElement) {
      stage.style.removeProperty('left');
      stage.style.removeProperty('top');
      stage.style.removeProperty('transform');
      stage.style.removeProperty('transform-origin');
      stage.style.removeProperty('margin-bottom');
    }

    const tipHost = opts.getTip()?.host;
    if (tipHost instanceof HTMLElement) {
      tipHost.style.removeProperty('--bpb-tooltip-mobile-cap');
      tipHost.style.removeProperty('--bpb-tooltip-scale');
    }

    for (const panel of [opts.recipes?.el, opts.builds?.el]) {
      if (!(panel instanceof HTMLElement)) continue;
      panel.style.removeProperty('left');
      panel.style.removeProperty('top');
      panel.style.removeProperty('right');
      panel.style.removeProperty('bottom');
      panel.style.removeProperty('width');
      panel.style.removeProperty('max-width');
      panel.style.removeProperty('max-height');
      panel.style.removeProperty('transform');
    }
  }

  function navClearancePx() {
    const nav = document.querySelector('#site-nav');
    const menu = document.querySelector('.site-nav__menu');
    let bottom = 0;
    if (nav instanceof HTMLElement) bottom = Math.max(bottom, nav.getBoundingClientRect().bottom);
    if (menu instanceof HTMLElement && menu.getClientRects().length) {
      bottom = Math.max(bottom, menu.getBoundingClientRect().bottom);
    }
    return Math.ceil(bottom);
  }

  function layoutMobileStack() {
    if (!mobileMq?.matches || (!open && !closing)) {
      clearMobileStackStyles();
      return;
    }
    if (!(sheet instanceof HTMLElement)) return;

    root.style.setProperty('--il-spotlight-top', `${navClearancePx()}px`);

    if (stage instanceof HTMLElement) parkInSheet(stage);
    const tipHost = opts.getTip()?.host;
    if (tipHost instanceof HTMLElement && tipHost.classList.contains('is-visible')) {
      parkInSheet(tipHost);
      const card = tipHost.querySelector('.bpb-tooltip');
      const declared = card instanceof HTMLElement
        ? parseFloat(getComputedStyle(card).getPropertyValue('--bpb-tooltip-w'))
        : 0;
      const cs = getComputedStyle(sheet);
      const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const room = Math.max(160, sheet.clientWidth - pad);
      const layoutW = declared > 0 ? declared : tipHost.scrollWidth;
      const scale = layoutW > 0 ? Math.min(1, room / layoutW) : 1;
      tipHost.style.setProperty('--bpb-tooltip-scale', scale.toFixed(4));
    }
    const recipes = opts.recipes?.el;
    if (recipes instanceof HTMLElement) parkInSheet(recipes);
    const builds = opts.builds?.el;
    if (builds instanceof HTMLElement) parkInSheet(builds);

    if (stage instanceof HTMLElement && piece instanceof HTMLElement) {
      stage.style.left = 'auto';
      stage.style.top = 'auto';
      stage.style.transformOrigin = 'top center';
      const naturalW = piece.offsetWidth;
      const naturalH = piece.offsetHeight;
      const maxW = Math.max(0, sheet.clientWidth - 8);
      const maxH = Math.min(Math.round(window.innerHeight * 0.22), 150);
      const scale =
        naturalW > 0 && naturalH > 0
          ? Math.min(1, maxW / naturalW, maxH / naturalH)
          : 1;
      stage.style.transform = scale < 1 ? `scale(${scale})` : 'none';
      stage.style.marginBottom = scale < 1 ? `${-Math.round(naturalH * (1 - scale))}px` : '0';
    }
  }

  function scheduleMobileStack() {
    if (mobileLayoutRaf) cancelAnimationFrame(mobileLayoutRaf);
    mobileLayoutRaf = requestAnimationFrame(() => {
      mobileLayoutRaf = requestAnimationFrame(() => {
        mobileLayoutRaf = 0;
        layoutMobileStack();
      });
    });
  }

  const onMobileResize = () => scheduleMobileStack();
  window.addEventListener('resize', onMobileResize);
  mobileMq?.addEventListener('change', onMobileResize);

  const mobilePanels = [opts.recipes?.el, opts.builds?.el].filter(
    (panel) => panel instanceof HTMLElement,
  );
  if (mobilePanels.length) {
    mobilePanelObserver = new MutationObserver(() => scheduleMobileStack());
    mobilePanels.forEach((panel) =>
      mobilePanelObserver.observe(panel, {
        childList: true,
        attributes: true,
        attributeFilter: ['hidden'],
      }),
    );
  }

  function clearPieceTransition() {
    if (pieceTransitionEnd && piece instanceof HTMLElement) {
      piece.removeEventListener('transitionend', pieceTransitionEnd);
      pieceTransitionEnd = null;
    }
    if (piece instanceof HTMLElement) {
      piece.style.transition = '';
      // Keep bag scale when clearing FLIP translate (mountPiece / finishClose reset).
      piece.style.transform = pieceFlipTransform(0, 0, pieceBagScale());
    }
  }

  function clearSourceMark() {
    if (sourceEl instanceof Element) {
      sourceEl.classList.remove('bpb-bg__item--spotlight-source');
    }
    sourceEl = null;
    opts.host
      .querySelectorAll('.bpb-bg__item--spotlight-source')
      .forEach((el) => el.classList.remove('bpb-bg__item--spotlight-source'));
  }

  function markSource(el) {
    clearSourceMark();
    if (el instanceof Element) {
      sourceEl = el;
      el.classList.add('bpb-bg__item--spotlight-source');
    }
  }

  function clearPiece() {
    underLayer?.replaceChildren();
    itemsLayer?.replaceChildren();
    if (piece instanceof HTMLElement) {
      delete piece.dataset.bagScale;
      piece.style.transform = '';
      piece.style.transition = '';
    }
  }

  /** @returns {number} */
  function pieceBagScale() {
    return piece instanceof HTMLElement && piece.dataset.bagScale === '0.9' ? 0.9 : 1;
  }

  /**
   * Match live catalog cell size (fillWidth may scale past 34px).
   * @param {Element | null} [fromEl]
   */
  function syncCellPxFromCatalog(fromEl = null) {
    if (!(piece instanceof HTMLElement)) return FALLBACK_CELL_PX;
    const probe =
      (fromEl instanceof Element && fromEl) ||
      opts.host.querySelector('.items-bag__stage .bpb-bg') ||
      opts.host.querySelector('.bpb-bg');
    let px = FALLBACK_CELL_PX;
    if (probe instanceof Element) {
      const raw = getComputedStyle(probe).getPropertyValue('--bpb-bg-cell').trim();
      const n = parseFloat(raw);
      if (Number.isFinite(n) && n > 0) px = n;
    }
    piece.style.setProperty('--bpb-bg-cell', `${px}px`);
    piece.style.fontSize = `${px}px`;
    return px;
  }

  /**
   * Full grid piece: rarity footprint + sprite + stars/diamonds/sockets/bag slots.
   * @param {object} item
   * @param {Element | null} [fromEl]
   */
  function mountPiece(item, fromEl = null) {
    if (!(underLayer instanceof HTMLElement) || !(itemsLayer instanceof HTMLElement)) return;
    clearPiece();
    syncCellPxFromCatalog(fromEl);

    const itemEl = createItemEl(item, opts.getSpriteUrl, item.libraryIndex ?? 1);
    if (!itemEl) return;

    itemEl.classList.remove('bpb-bg__item--parked');
    itemEl.classList.add('il-spotlight__item');
    itemEl.style.left = '0';
    itemEl.style.top = '0';

    const markers = itemEl.querySelector('.bpb-bg__markers');
    if (markers instanceof HTMLElement) {
      markers.classList.add('is-visible');
      markers.style.opacity = '1';
      markers.style.visibility = 'visible';
      markers.style.zIndex = '30000';
    }

    const hit = itemEl.querySelector('.bpb-bg__hit');
    if (hit instanceof HTMLElement) {
      hit.tabIndex = -1;
      hit.setAttribute('tabindex', '-1');
      hit.style.pointerEvents = 'none';
    }

    const underEl = createUnderEl(item);
    if (underEl) {
      underEl.classList.remove('bpb-bg__under-item--parked');
      underEl.classList.add('il-spotlight__under-item');
      underEl.style.left = '0';
      underEl.style.top = '0';
      underEl.querySelectorAll('.bpb-bg__cell--rarity').forEach((cell) => {
        cell.classList.add('is-lit');
      });
      underLayer.appendChild(underEl);
    }

    itemsLayer.appendChild(itemEl);

    if (piece instanceof HTMLElement) {
      piece.style.width = itemEl.style.width || '1em';
      piece.style.height = itemEl.style.height || '1em';
      // Match Itemiary bag resting scale so open/close FLIP size matches the grid.
      const isBag =
        itemEl.classList.contains('bpb-bg__item--bag') ||
        String(item?.type || '') === 'Bag';
      piece.dataset.bagScale = isBag ? '0.9' : '1';
      piece.style.transform = pieceFlipTransform(0, 0, pieceBagScale());
    }
  }

  /**
   * FLIP: start at catalog item, animate to stage.
   * @param {Element | null} fromEl
   */
  function animateOpenFrom(fromEl) {
    if (!(piece instanceof HTMLElement)) return;
    clearPieceTransition();

    const scale = pieceBagScale();
    if (!(fromEl instanceof Element) || prefersReducedMotion()) {
      piece.style.transform = pieceFlipTransform(0, 0, scale);
      return;
    }

    const to = piece.getBoundingClientRect();
    const from = fromEl.getBoundingClientRect();
    if (to.width < 1 || to.height < 1 || from.width < 1 || from.height < 1) return;

    const { dx, dy } = flipDelta(from, to);
    piece.style.transition = 'none';
    piece.style.transform = pieceFlipTransform(dx, dy, scale);
    // Force invert paint
    void piece.offsetWidth;
    requestAnimationFrame(() => {
      piece.style.transition = `transform ${OPEN_MS}ms ${EASE}`;
      piece.style.transform = pieceFlipTransform(0, 0, scale);
    });
  }

  /**
   * FLIP: stage → catalog item, then done.
   * @param {Element | null} toEl
   * @param {() => void} done
   */
  function animateCloseTo(toEl, done) {
    if (!(piece instanceof HTMLElement) || prefersReducedMotion() || !(toEl instanceof Element)) {
      done();
      return;
    }

    clearPieceTransition();
    const from = piece.getBoundingClientRect();
    const to = toEl.getBoundingClientRect();
    if (from.width < 1 || to.width < 1) {
      done();
      return;
    }

    // Keep bag scale(0.9) through the return FLIP so size matches the grid item.
    const scale = pieceBagScale();
    const a = rectCenter(from);
    const b = rectCenter(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearPieceTransition();
      done();
    };

    pieceTransitionEnd = (e) => {
      if (e.target !== piece || e.propertyName !== 'transform') return;
      finish();
    };
    piece.addEventListener('transitionend', pieceTransitionEnd);

    piece.style.transition = 'none';
    piece.style.transform = pieceFlipTransform(0, 0, scale);
    void piece.offsetWidth;
    requestAnimationFrame(() => {
      piece.style.transition = `transform ${CLOSE_MS}ms ${EASE}`;
      piece.style.transform = pieceFlipTransform(dx, dy, scale);
    });

    closeTimer = setTimeout(finish, CLOSE_MS + 80);
  }

  /**
   * @param {object} item
   * @param {Element | null} [fromEl]
   */
  function showItem(item, fromEl = null) {
    if (!item?.id) return;
    activeId = item.id;
    mountPiece(item, fromEl);

    if (fromEl instanceof Element) {
      markSource(fromEl);
    } else {
      const el = opts.host.querySelector(
        `.bpb-bg__item[data-item-id="${CSS.escape(item.id)}"]:not(.bpb-bg__item--parked)`,
      );
      markSource(el);
    }

    const tip = opts.getTip();
    tip?.lock(item, { stage: stage instanceof Element ? stage : null });
    opts.recipes?.showFor(item.id, {
      stage: stage instanceof Element ? stage : null,
      piece: piece instanceof Element ? piece : null,
      tipHost: tip?.host instanceof HTMLElement ? tip.host : null,
    });
    opts.builds?.showFor(item.id);
  }

  /**
   * @param {string} itemId
   * @param {Element | null} [fromEl]
   */
  function openAt(itemId, fromEl = null) {
    if (closing) {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = null;
      clearPieceTransition();
      closing = false;
      root.classList.remove('is-closing');
    }

    const order = opts.getFilteredOrder();
    const i = order.findIndex((it) => it.id === itemId);
    const item = (i >= 0 ? order[i] : null) || opts.getItemById(itemId);
    if (!item) return;

    const origin =
      fromEl instanceof Element
        ? fromEl
        : opts.host.querySelector(
            `.bpb-bg__item[data-item-id="${CSS.escape(itemId)}"]:not(.bpb-bg__item--parked)`,
          );

    open = true;
    showItem(item, origin instanceof Element ? origin : null);
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    layoutMobileStack();
    scheduleMobileStack();

    // Layout at final stage position, then FLIP from catalog
    requestAnimationFrame(() => {
      animateOpenFrom(origin instanceof Element ? origin : null);
    });
  }

  function finishClose() {
    open = false;
    closing = false;
    activeId = null;
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    clearPieceTransition();
    clearSourceMark();
    clearPiece();
    clearMobileStackStyles();
    root.classList.remove('is-open', 'is-closing');
    root.setAttribute('aria-hidden', 'true');
    opts.recipes?.hide();
    opts.builds?.hide();
    opts.getTip()?.unlock();
  }

  /**
   * @param {{ immediate?: boolean }} [optsClose]
   */
  function close(optsClose = {}) {
    if (!open && !closing) return;
    if (optsClose.immediate) {
      finishClose();
      return;
    }
    if (closing) return;
    closing = true;
    opts.recipes?.hide();
    opts.builds?.hide();
    opts.getTip()?.unlock();

    const target = sourceEl;
    root.classList.add('is-closing');
    // Keep is-open so stage/piece stay laid out for the return FLIP
    animateCloseTo(target, () => {
      root.classList.remove('is-open');
      finishClose();
    });
  }

  function onDimClick(e) {
    if (e.target === dim) close();
  }

  function onKey(e) {
    if (!open || closing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  dim?.addEventListener('click', onDimClick);
  sheet?.addEventListener('click', (e) => {
    if (e.target === sheet) close();
  });
  stage?.addEventListener('click', (e) => e.stopPropagation());
  window.addEventListener('keydown', onKey);

  return {
    el: root,
    isOpen: () => open && !closing,
    /**
     * @param {string} itemId
     * @param {Element | null} [fromEl]
     */
    open(itemId, fromEl = null) {
      openAt(itemId, fromEl);
    },
    close,
    destroy() {
      if (closeTimer) clearTimeout(closeTimer);
      if (mobileLayoutRaf) cancelAnimationFrame(mobileLayoutRaf);
      mobilePanelObserver?.disconnect();
      window.removeEventListener('resize', onMobileResize);
      mobileMq?.removeEventListener('change', onMobileResize);
      window.removeEventListener('keydown', onKey);
      finishClose();
      root.remove();
    },
  };
}
