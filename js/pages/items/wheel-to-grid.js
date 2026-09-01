/**
 * Forward wheel from the filter rail to the items grid.
 *
 * Important: do NOT attach a non-passive wheel listener on an ancestor of the
 * scroller — that blocks Chromium's compositor scrolling and feels laggy with
 * a full Itemiary DOM. The bag uses native scroll; only the sibling filter
 * rail needs forwarding.
 *
 * When the rail itself overflows (short viewports), scroll the rail first;
 * forward to the bag only when the rail has no overflow or is at that edge.
 */

/**
 * @param {{
 *   filtersSelector?: string,
 *   gridSelector?: string,
 *   hostSelector?: string,
 *   chainWheelToGrid?: boolean,
 * }} [options]
 * @returns {() => void} teardown
 */
export function initWheelToGrid(options = {}) {
  const filtersSel = options.filtersSelector ?? '.items-filters';
  const gridSel = options.gridSelector ?? '.items-bag__stage .bpb-bg';
  const hostSel = options.hostSelector ?? '#items-catalog';
  /** When false, wheel on the rail never drives the bag (create Filter|Build). */
  const chainWheelToGrid = options.chainWheelToGrid !== false;

  /** @type {HTMLElement | null} */
  let grid = null;
  let target = 0;
  let current = 0;
  let raf = 0;

  /** Snappy catch-up when rolling over the filter rail. */
  const LERP = 0.35;

  function reducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  }

  function resolveGrid() {
    const el = document.querySelector(gridSel);
    return el instanceof HTMLElement ? el : null;
  }

  function maxScroll(el) {
    return Math.max(0, el.scrollHeight - el.clientHeight);
  }

  /**
   * @param {WheelEvent} e
   * @param {HTMLElement} el
   */
  function wheelDeltaY(e, el) {
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= el.clientHeight;
    return dy;
  }

  function stopAnim() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function tick() {
    const el = grid;
    if (!(el instanceof HTMLElement)) {
      raf = 0;
      return;
    }

    const max = maxScroll(el);
    target = Math.min(max, Math.max(0, target));
    const diff = target - current;

    if (Math.abs(diff) < 0.4) {
      current = target;
      el.scrollTop = current;
      raf = 0;
      return;
    }

    current += diff * LERP;
    el.scrollTop = current;
    raf = requestAnimationFrame(tick);
  }

  /**
   * @param {HTMLElement} el
   * @param {number} dy
   */
  function applySmooth(el, dy) {
    grid = el;
    if (!raf) {
      current = el.scrollTop;
      target = current;
    }
    const max = maxScroll(el);
    target = Math.min(max, Math.max(0, target + dy));
    if (!raf) raf = requestAnimationFrame(tick);
  }

  /**
   * Scroll the filter rail when it overflows; otherwise false → forward to bag.
   * On /create/ Filter|Build tabs, the active `.cr-panel` is the scroller.
   * Uses the same lerp as bag forwarding (preventDefault kills native smooth).
   * @param {WheelEvent} e
   * @param {HTMLElement} rail
   */
  function tryScrollRail(e, rail) {
    const panel = rail.querySelector(
      '.cr-panel.is-active:not([hidden]), .cr-panel:not([hidden])',
    );
    const scroller =
      panel instanceof HTMLElement && maxScroll(panel) > 1 ? panel : rail;

    const max = maxScroll(scroller);
    if (max <= 1) return false;

    const dy = wheelDeltaY(e, scroller);
    if (dy === 0) return false;

    const pos = raf && grid === scroller ? target : scroller.scrollTop;
    const atTop = pos <= 0 && dy < 0;
    const atBottom = pos >= max - 0.5 && dy > 0;
    if (atTop || atBottom) {
      if (raf && grid === scroller) stopAnim();
      return false;
    }

    e.preventDefault();

    if (reducedMotion()) {
      stopAnim();
      scroller.scrollTop = Math.min(max, Math.max(0, scroller.scrollTop + dy));
      return true;
    }

    applySmooth(scroller, dy);
    return true;
  }

  /** @param {WheelEvent} e */
  function onFiltersWheel(e) {
    if (e.ctrlKey) return;

    if (document.querySelector('.il-spotlight.is-open, .il-spotlight.is-closing')) {
      return;
    }

    const rail = e.currentTarget;
    if (rail instanceof HTMLElement && tryScrollRail(e, rail)) {
      return;
    }

    // Create Filter|Build: only the hovered section scrolls — never chain into the bag
    if (!chainWheelToGrid) {
      e.preventDefault();
      return;
    }

    const el = resolveGrid();
    if (!(el instanceof HTMLElement)) return;

    const max = maxScroll(el);
    if (max <= 1) return;

    const dy = wheelDeltaY(e, el);
    if (dy === 0) return;

    const atTop = el.scrollTop <= 0 && dy < 0;
    const atBottom = el.scrollTop >= max - 0.5 && dy > 0;
    if ((atTop || atBottom) && !raf) return;

    e.preventDefault();

    if (reducedMotion()) {
      stopAnim();
      el.scrollTop = Math.min(max, Math.max(0, el.scrollTop + dy));
      return;
    }

    applySmooth(el, dy);
  }

  /** @type {HTMLElement | null} */
  let filtersEl = null;

  function bindFilters() {
    const next = document.querySelector(filtersSel);
    if (next === filtersEl) return;
    if (filtersEl) {
      filtersEl.removeEventListener('wheel', onFiltersWheel);
    }
    filtersEl = next instanceof HTMLElement ? next : null;
    filtersEl?.addEventListener('wheel', onFiltersWheel, { passive: false });
  }

  bindFilters();

  // Filters markup is swapped after data load — rebind when the catalog host changes
  const mo = new MutationObserver(() => bindFilters());
  const catalogHost =
    document.querySelector(hostSel) ||
    document.querySelector('[data-create-catalog]');
  if (catalogHost) mo.observe(catalogHost, { childList: true, subtree: true });

  return () => {
    mo.disconnect();
    filtersEl?.removeEventListener('wheel', onFiltersWheel);
    filtersEl = null;
    stopAnim();
  };
}
