/**
 * Floating hover/focus host for ItemTooltip.render().
 * Requires classic script: js/shared/tooltip.js (window.ItemTooltip).
 *
 *   import { createTooltipHover } from '../../shared/tooltip-hover.js';
 *   const tip = createTooltipHover({ pinOnAlt: true });
 *   tip.bind(root, { getItem: (el) => map.get(el.dataset.itemId) });
 *
 *   // Spotlight: tip.lock(item, { stage }); tip.unlock();
 */

const GAP = 12;
const EDGE = 8;
const FILTERS_INSET = -28;

/** @typedef {'near' | 'overFilters' | 'cursor' | 'itemRight' | 'itemLeft' | 'center'} PlaceMode */

/**
 * @typedef {{
 *   mode: PlaceMode,
 *   filtersSelector: string,
 *   filtersScope: ParentNode | null,
 * }} PlaceConfig
 */

function ensureApi() {
  if (!window.ItemTooltip?.render) {
    throw new Error('ItemTooltip missing — load js/shared/tooltip.js before modules');
  }
  return window.ItemTooltip;
}

function fitTooltipScale(tip) {
  const vw = window.innerWidth;
  const maxW = Math.max(200, vw - EDGE * 2);
  const cluster = tip.querySelector?.('.bpb-tooltip-cluster');
  const card = cluster?.querySelector?.('.bpb-tooltip') || tip.querySelector?.('.bpb-tooltip') || tip;
  let layoutW = card.offsetWidth || 584;
  if (cluster instanceof HTMLElement) {
    layoutW = cluster.scrollWidth || layoutW + 490;
  }
  const scale = Math.min(1, maxW / layoutW);
  tip.style.setProperty('--bpb-tooltip-scale', String(scale));
  return scale;
}

/**
 * Keep tooltip on-screen; sidecar gets its own full-height scroll column.
 * @param {HTMLElement} host
 */
function clampTooltipHeight(host) {
  if (!host.classList.contains('is-visible')) return;
  const vh = window.innerHeight;
  const sidecar = host.querySelector('.bpb-tooltip-sidecar');

  if (sidecar instanceof HTMLElement) {
    host.style.removeProperty('--bpb-tooltip-max-h');
    host.style.removeProperty('--bpb-tooltip-mods-max-h');

    const cluster = host.querySelector('.bpb-tooltip-cluster');
    if (cluster instanceof HTMLElement) {
      const clusterRect = host.getBoundingClientRect();
      const clusterH = clusterRect.height;
      let topAdjust = 0;
      if (clusterRect.top + clusterH > vh - EDGE) {
        topAdjust = Math.max(EDGE, vh - EDGE - clusterH) - clusterRect.top;
      } else if (clusterRect.top < EDGE) {
        topAdjust = EDGE - clusterRect.top;
      }
      if (topAdjust) {
        const curTop = Number.parseFloat(host.style.top) || clusterRect.top;
        host.style.top = `${Math.round(curTop + topAdjust)}px`;
      }
    }

    const sidecarRect = sidecar.getBoundingClientRect();
    const maxSidecarH = Math.max(
      220,
      Math.min(vh - EDGE * 2, vh - EDGE - Math.max(EDGE, sidecarRect.top)),
    );
    host.style.setProperty('--bpb-sidecar-max-h', `${maxSidecarH}px`);
    return;
  }

  const rect = host.getBoundingClientRect();
  host.style.removeProperty('--bpb-tooltip-max-h');
  host.style.removeProperty('--bpb-tooltip-mods-max-h');

  const card = host.querySelector('.bpb-tooltip');
  const box = card instanceof HTMLElement ? card : host;
  const boxRect = box.getBoundingClientRect();
  const overflow = boxRect.bottom - (vh - EDGE);
  if (overflow > 0) {
    const curTop = Number.parseFloat(host.style.top);
    const base = Number.isFinite(curTop) ? curTop : rect.top;
    const nextTop = Math.max(EDGE, base - overflow);
    host.style.top = `${Math.round(nextTop)}px`;
    const still = overflow - (base - nextTop);
    if (still <= 1) return;
  } else {
    return;
  }

  const fitted = host.getBoundingClientRect();
  const maxTooltipH = Math.max(160, vh - EDGE - Math.max(0, fitted.top));
  host.style.setProperty('--bpb-tooltip-max-h', `${maxTooltipH}px`);

  const modsScroll = host.querySelector('.bpb-tooltip__mods-scroll');
  if (!(card instanceof HTMLElement) || !(modsScroll instanceof HTMLElement)) return;

  const cardH = card.getBoundingClientRect().height;
  const scrollH = modsScroll.getBoundingClientRect().height;
  const nonScrollH = Math.max(0, cardH - scrollH);
  const maxModsH = Math.max(72, maxTooltipH - nonScrollH);
  host.style.setProperty('--bpb-tooltip-mods-max-h', `${maxModsH}px`);
}

/**
 * @param {HTMLElement} host
 */
function initTooltipInteractions(host) {
  clampTooltipHeight(host);
  host.querySelectorAll('.bpb-tooltip__mod-via').forEach((el) => {
    if (!(el instanceof HTMLDetailsElement)) return;
    el.addEventListener('toggle', () => clampTooltipHeight(host));
  });
}

function placeNear(tip, anchor) {
  fitTooltipScale(tip);
  const rect = anchor.getBoundingClientRect();
  const cluster = tip.querySelector('.bpb-tooltip-cluster');
  if (cluster instanceof HTMLElement) {
    cluster.classList.remove('bpb-tooltip-cluster--flip');
  }

  let tipRect = tip.getBoundingClientRect();
  let tw = tipRect.width || tip.offsetWidth;
  let th = tipRect.height || tip.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = rect.right + GAP;
  let top = rect.top;

  if (left + tw > vw - EDGE) {
    left = rect.left - tw - GAP;
  }
  if (left < EDGE) {
    left = Math.max(EDGE, Math.min(rect.left, vw - tw - EDGE));
    top = rect.bottom + GAP;
  }
  if (top + th > vh - EDGE) {
    top = Math.max(EDGE, vh - th - EDGE);
  }
  if (top < EDGE) top = EDGE;

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;

  if (cluster instanceof HTMLElement) {
    tipRect = tip.getBoundingClientRect();
    if (tipRect.right > vw - EDGE && !cluster.classList.contains('bpb-tooltip-cluster--flip')) {
      cluster.classList.add('bpb-tooltip-cluster--flip');
      tipRect = tip.getBoundingClientRect();
      tw = tipRect.width || tip.offsetWidth;
      left = rect.left - tw - GAP;
      if (left < EDGE) left = EDGE;
      tip.style.left = `${Math.round(left)}px`;
    }
  }
}

function placeAtCursor(tip, anchor, pointer) {
  fitTooltipScale(tip);
  const tipRect = tip.getBoundingClientRect();
  const tw = tipRect.width || tip.offsetWidth;
  const th = tipRect.height || tip.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const px =
    pointer && Number.isFinite(pointer.x)
      ? pointer.x
      : anchor
        ? anchor.getBoundingClientRect().right
        : EDGE;
  const py =
    pointer && Number.isFinite(pointer.y)
      ? pointer.y
      : anchor
        ? anchor.getBoundingClientRect().top
        : EDGE;

  let left = px + GAP;
  let top = py + GAP;

  if (left + tw > vw - EDGE) {
    left = Math.max(EDGE, px - tw - GAP);
  }
  if (top + th > vh - EDGE) {
    top = Math.max(EDGE, vh - th - EDGE);
  }
  if (top < EDGE) top = EDGE;
  if (left < EDGE) left = EDGE;

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

function placeItemRight(tip, anchor) {
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = rect.right + GAP;
  const space = Math.max(160, vw - EDGE - left);

  const card = tip.querySelector?.('.bpb-tooltip') || tip;
  tip.style.setProperty('--bpb-tooltip-scale', '1');
  const layoutW = card.offsetWidth || 584;
  const scale = Math.min(1, space / layoutW);
  tip.style.setProperty('--bpb-tooltip-scale', String(scale));

  const tipRect = tip.getBoundingClientRect();
  const th = tipRect.height || tip.offsetHeight;

  let top = rect.top;
  if (top + th > vh - EDGE) top = Math.max(EDGE, vh - th - EDGE);
  if (top < EDGE) top = EDGE;

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

/** Card sits just left of the chip; sidecar continues further left. */
function placeItemLeft(tip, anchor) {
  const rect = anchor.getBoundingClientRect();
  const vh = window.innerHeight;
  const cluster = tip.querySelector('.bpb-tooltip-cluster');
  if (cluster instanceof HTMLElement) {
    cluster.classList.add('bpb-tooltip-cluster--flip');
  }

  tip.style.setProperty('--bpb-tooltip-scale', '1');
  const layoutW =
    (cluster instanceof HTMLElement ? cluster.offsetWidth : 0) ||
    tip.offsetWidth ||
    584;
  const space = Math.max(160, rect.left - GAP - EDGE);
  const scale = Math.min(1, space / layoutW);
  tip.style.setProperty('--bpb-tooltip-scale', String(scale));

  const tipRect = tip.getBoundingClientRect();
  const tw = tipRect.width || layoutW * scale;
  const th = tipRect.height || tip.offsetHeight;

  let left = rect.left - GAP - tw;
  if (left < EDGE) left = EDGE;

  let top = rect.top;
  if (top + th > vh - EDGE) top = Math.max(EDGE, vh - th - EDGE);
  if (top < EDGE) top = EDGE;

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

function placeOverFilters(tip, anchor, panel) {
  fitTooltipScale(tip);
  const panelRect = panel.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  const tw = tipRect.width || tip.offsetWidth;
  const th = tipRect.height || tip.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // The filters rail is often close to the right edge on desktop create. Keep
  // the tooltip's intended rail-relative placement, then pull it left into
  // the viewport safe area when the card would run past the screen edge.
  let left = panelRect.left + FILTERS_INSET;
  if (left + tw > vw - EDGE) left = vw - EDGE - tw;
  if (left < EDGE) left = EDGE;
  let top = anchorRect.top + anchorRect.height / 2 - th / 2;
  if (top + th > vh - EDGE) top = Math.max(EDGE, vh - th - EDGE);
  if (top < EDGE) top = EDGE;

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

function placeSpotlight(tip, stage) {
  fitTooltipScale(tip);
  const tipRect = tip.getBoundingClientRect();
  const th = tipRect.height || tip.offsetHeight;
  const vh = window.innerHeight;

  const bag = document.querySelector('.items-bag');
  let left = EDGE + 12;
  if (bag instanceof Element) {
    left = Math.max(EDGE, Math.round(bag.getBoundingClientRect().left + 12));
  }

  let top;
  if (stage instanceof Element) {
    const sr = stage.getBoundingClientRect();
    top = sr.top + sr.height / 2 - th / 2;
  } else {
    top = (vh - th) / 2;
  }
  if (top + th > vh - EDGE) top = Math.max(EDGE, vh - th - EDGE);
  if (top < EDGE) top = EDGE;

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

/** Center the tooltip cluster in the viewport (sim hover). */
function placeCenter(tip) {
  fitTooltipScale(tip);
  const cluster = tip.querySelector('.bpb-tooltip-cluster');
  if (cluster instanceof HTMLElement && !cluster.dataset.sidecarLeft) {
    cluster.classList.remove('bpb-tooltip-cluster--flip');
  }

  const tipRect = tip.getBoundingClientRect();
  const tw = tipRect.width || tip.offsetWidth;
  const th = tipRect.height || tip.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = (vw - tw) / 2;
  let top = (vh - th) / 2;

  if (left < EDGE) left = EDGE;
  if (top < EDGE) top = EDGE;
  if (left + tw > vw - EDGE) left = Math.max(EDGE, vw - EDGE - tw);
  if (top + th > vh - EDGE) top = Math.max(EDGE, vh - EDGE - th);

  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

/** @returns {PlaceConfig} */
function defaultPlaceConfig() {
  return {
    mode: 'near',
    filtersSelector: '.items-filters',
    filtersScope: null,
  };
}

/**
 * @param {{
 *   className?: string,
 *   getRenderOptions?: () => Record<string, unknown>,
 *   pinOnAlt?: boolean,
 * }} [options]
 */
export function createTooltipHover(options = {}) {
  ensureApi();

  const host = document.createElement('div');
  host.className = options.className || 'bpb-tooltip-float';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);

  const pinOnAlt = options.pinOnAlt === true;

  /** @type {() => Record<string, unknown>} */
  const getRenderOptions =
    typeof options.getRenderOptions === 'function'
      ? options.getRenderOptions
      : () => ({});

  function renderItem(item, anchor) {
    const renderOpts = getRenderOptions(anchor ?? activeAnchor ?? null);
    return window.ItemTooltip.render(item, renderOpts);
  }

  let activeAnchor = null;
  let hideTimer = 0;
  /** @type {PlaceConfig} */
  let activePlace = defaultPlaceConfig();
  let locked = false;
  let pinned = false;
  /** @type {Element | null} */
  let spotlightStage = null;
  /** @type {{ x: number, y: number } | null} */
  let pointer = null;

  /** @type {Set<Element>} */
  const bindRoots = new Set();
  /** @type {Map<Element, { selector: string }>} */
  const bindMeta = new Map();

  function clearHide() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = 0;
    }
  }

  function hide() {
    if (locked) return;
    pinned = false;
    host.classList.remove('is-pinned');
    clearHide();
    activeAnchor = null;
    activePlace = defaultPlaceConfig();
    host.replaceChildren();
    host.classList.remove('is-visible');
    host.setAttribute('aria-hidden', 'true');
  }

  function pinHover() {
    if (locked || !host.classList.contains('is-visible')) return;
    clearHide();
    pinned = true;
    host.classList.add('is-pinned');
    host.setAttribute('aria-hidden', 'false');
    initTooltipInteractions(host);
  }

  function unpinHover() {
    if (!pinned) return;
    pinned = false;
    host.classList.remove('is-pinned');
    host.setAttribute('aria-hidden', 'true');
  }

  /**
   * @param {Element | null} [anchor]
   */
  function placeTip(anchor) {
    if (locked) {
      placeSpotlight(host, spotlightStage);
      clampTooltipHeight(host);
      return;
    }
    if (pinned) {
      clampTooltipHeight(host);
      return;
    }

    const mode = activePlace.mode;
    if (mode !== 'itemLeft') {
      host.querySelector('.bpb-tooltip-cluster')?.classList.remove('bpb-tooltip-cluster--flip');
    }
    if (mode === 'center') {
      placeCenter(host);
    } else if (mode === 'cursor') {
      placeAtCursor(host, anchor, pointer);
    } else if (mode === 'itemRight' && anchor) {
      placeItemRight(host, anchor);
    } else if (mode === 'itemLeft' && anchor) {
      placeItemLeft(host, anchor);
    } else if (mode === 'overFilters' && anchor) {
      const scope = activePlace.filtersScope || document;
      const panel = scope.querySelector?.(activePlace.filtersSelector);
      if (panel instanceof Element) {
        placeOverFilters(host, anchor, panel);
      } else if (anchor) {
        placeNear(host, anchor);
      }
    } else if (anchor) {
      placeNear(host, anchor);
    }
    initTooltipInteractions(host);
  }

  /**
   * @param {object} item
   * @param {Element} anchor
   * @param {PlaceConfig} [place]
   */
  function show(item, anchor, place) {
    if (locked) return;
    if (document.body.classList.contains('is-bpb-dragging')) return;
    if (document.body.classList.contains('is-bpb-selecting')) return;
    if (pinned) return;
    clearHide();
    if (!item?.name) return;
    activeAnchor = anchor;
    if (place) activePlace = place;
    const el = renderItem(item, anchor);
    host.replaceChildren(el);
    host.classList.add('is-visible');
    host.setAttribute('aria-hidden', 'true');
    placeTip(anchor);
  }

  /**
   * @param {(anchor: Element) => object | null | undefined} getItem
   */
  function refresh(getItem) {
    if (locked || pinned) return;
    if (!activeAnchor || !host.classList.contains('is-visible')) return;
    if (typeof getItem !== 'function') return;
    const item = getItem(activeAnchor);
    if (!item?.name) return;
    const el = renderItem(item, activeAnchor);
    host.replaceChildren(el);
    placeTip(activeAnchor);
  }

  /**
   * @param {object} item
   * @param {{ stage?: Element | null }} [opts]
   */
  function lock(item, opts = {}) {
    if (!item?.name) return;
    clearHide();
    pinned = false;
    host.classList.remove('is-pinned');
    locked = true;
    spotlightStage = opts.stage instanceof Element ? opts.stage : null;
    activeAnchor = null;
    const el = window.ItemTooltip.render(item);
    host.replaceChildren(el);
    host.classList.add('is-visible', 'is-locked');
    placeSpotlight(host, spotlightStage);
    initTooltipInteractions(host);
  }

  function unlock() {
    locked = false;
    pinned = false;
    spotlightStage = null;
    host.classList.remove('is-locked', 'is-pinned');
    clearHide();
    activeAnchor = null;
    activePlace = defaultPlaceConfig();
    host.replaceChildren();
    host.classList.remove('is-visible');
    host.setAttribute('aria-hidden', 'true');
  }

  function scheduleHide(ms = 60) {
    if (locked || pinned) return;
    clearHide();
    hideTimer = window.setTimeout(hide, ms);
  }

  /**
   * @param {PointerEvent} e
   */
  function onDocPointerDown(e) {
    if (!pinned) return;
    const t = e.target;
    if (t instanceof Node && host.contains(t)) return;
    for (const root of bindRoots) {
      if (!(root instanceof Element) || !root.contains(t)) continue;
      const meta = bindMeta.get(root);
      if (meta?.selector && t instanceof Element && t.closest?.(meta.selector)) {
        return;
      }
    }
    unpinHover();
    scheduleHide(0);
  }

  /**
   * @param {KeyboardEvent} e
   */
  function onGlobalKey(e) {
    if (locked) return;

    if (e.key === 'Escape') {
      if (pinned) {
        e.preventDefault();
        unpinHover();
        scheduleHide(0);
        return;
      }
      hide();
      return;
    }

    if (!pinOnAlt || e.key !== 'Alt' || e.repeat) return;
    if (!host.classList.contains('is-visible')) return;
    e.preventDefault();
    if (pinned) {
      unpinHover();
    } else {
      pinHover();
    }
  }

  function onLayoutChange() {
    if (!host.classList.contains('is-visible')) return;
    if (locked) {
      placeSpotlight(host, spotlightStage);
    } else if (pinned) {
      clampTooltipHeight(host);
    } else if (activePlace.mode === 'center') {
      placeCenter(host);
      clampTooltipHeight(host);
    } else if (activeAnchor) {
      placeTip(activeAnchor);
    }
  }

  /**
   * @param {Element} root
   * @param {{
   *   selector?: string,
   *   getItem: (el: Element) => object | null | undefined,
   *   place?: PlaceMode,
   *   filtersSelector?: string,
   *   filtersScope?: ParentNode | null,
   * }} opts
   */
  function bind(root, opts) {
    const selector = opts.selector || '[data-item-id]';
    const getItem = opts.getItem;

    /** @type {PlaceConfig} */
    const placeCfg = {
      mode:
        opts.place === 'overFilters' ||
        opts.place === 'cursor' ||
        opts.place === 'itemRight' ||
        opts.place === 'itemLeft' ||
        opts.place === 'center'
          ? opts.place
          : 'near',
      filtersSelector: opts.filtersSelector || '.items-filters',
      filtersScope: opts.filtersScope || root,
    };

    bindRoots.add(root);
    bindMeta.set(root, { selector });

    const onEnter = (e) => {
      if (locked || pinned) return;
      if (document.body.classList.contains('is-bpb-dragging')) return;
      if (document.body.classList.contains('is-bpb-selecting')) return;
      const hit = e.target.closest?.(selector);
      if (!hit || !root.contains(hit)) return;
      if (Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
        pointer = { x: e.clientX, y: e.clientY };
      }
      const item = getItem(hit);
      if (!item) return;
      show(item, hit, placeCfg);
    };

    const onMove = (e) => {
      if (locked || pinned || placeCfg.mode !== 'cursor') return;
      if (!host.classList.contains('is-visible') || !activeAnchor) return;
      if (!root.contains(activeAnchor)) return;
      if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
      pointer = { x: e.clientX, y: e.clientY };
      placeTip(activeAnchor);
    };

    const onLeave = (e) => {
      if (locked || pinned) return;
      const hit = e.target.closest?.(selector);
      if (!hit || !root.contains(hit)) return;
      const next = e.relatedTarget;
      if (next && (hit.contains(next) || host.contains(next))) return;
      scheduleHide();
    };

    const onFocusIn = (e) => {
      if (locked || pinned) return;
      const hit = e.target.closest?.(selector);
      if (!hit || !root.contains(hit)) return;
      const item = getItem(hit);
      if (!item) return;
      show(item, hit, placeCfg);
    };

    const onFocusOut = (e) => {
      if (locked || pinned) return;
      const hit = e.target.closest?.(selector);
      if (!hit || !root.contains(hit)) return;
      if (e.relatedTarget && hit.contains(e.relatedTarget)) return;
      scheduleHide();
    };

    root.addEventListener('pointerover', onEnter);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerout', onLeave);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);

    return () => {
      root.removeEventListener('pointerover', onEnter);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerout', onLeave);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      bindRoots.delete(root);
      bindMeta.delete(root);
      pointer = null;
      unlock();
    };
  }

  document.addEventListener('pointerdown', onDocPointerDown, true);
  window.addEventListener('keydown', onGlobalKey);
  window.addEventListener('scroll', onLayoutChange, true);
  window.addEventListener('resize', onLayoutChange);

  function destroy() {
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    window.removeEventListener('keydown', onGlobalKey);
    window.removeEventListener('scroll', onLayoutChange, true);
    window.removeEventListener('resize', onLayoutChange);
    unlock();
    host.remove();
  }

  return {
    show,
    hide,
    refresh,
    lock,
    unlock,
    pin: pinHover,
    unpin: unpinHover,
    bind,
    destroy,
    host,
    isLocked: () => locked,
    isPinned: () => pinned,
    getActiveAnchor: () => activeAnchor,
  };
}
