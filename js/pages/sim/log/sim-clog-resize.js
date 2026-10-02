/**
 * Vertical resize strips for the three Combat Log sections.
 * Game: Interface/ResizableControl.gd — VerticalResizeButton "button_down" sets
 * verticalResizing, then _process does
 *   rect_size.y = clampToScreen(mouse + resizeOffset).y - rect_global_position.y
 * so the drag moves the bottom edge only. Mins come from rect_min_size.y
 * (CombatLog 300, DamageMeter 200 while open).
 */

const SECTIONS = {
  log: { sel: '.sim-clog-panel', min: 300 },
  you: { sel: '.sim-clog-tab--you', min: 200 },
  opp: { sel: '.sim-clog-tab--opp', min: 200 },
};

/** Godot Util.clampToScreen — keep the dragged edge on screen */
const SCREEN_PAD = 6;

/** @param {number} n */
const round = (n) => Math.round(n);

/**
 * @param {HTMLElement} ui .sim-clog-ui
 * @param {{ onResize?: (id: string, px: number) => void }} [opts]
 * @returns {() => void} unbind
 */
export function bindClogResize(ui, opts = {}) {
  /** @type {{ id: string, el: HTMLElement, min: number, ptr: number, offset: number, h: number } | null} */
  let drag = null;

  /** @param {HTMLElement} handle */
  function sectionOf(handle) {
    const id = handle.getAttribute('data-resize-handle') || 'log';
    const cfg = SECTIONS[id];
    if (!cfg) return null;
    const el = handle.closest(cfg.sel) || ui.querySelector(cfg.sel);
    return el instanceof HTMLElement ? { id, el, min: cfg.min } : null;
  }

  /**
   * @param {HTMLElement} el
   * @param {number} min
   * @param {number} bottom target bottom edge in viewport px
   */
  function applyHeight(el, min, bottom) {
    const top = el.getBoundingClientRect().top;
    const capped = Math.min(window.innerHeight - SCREEN_PAD, bottom);
    // The panel's CSS max-height keeps it on screen; clamp to it so the stored
    // height never drifts past what the box actually renders.
    const maxCss = Number.parseFloat(getComputedStyle(el).maxHeight);
    const max = Number.isFinite(maxCss) ? maxCss : Infinity;
    const h = Math.min(max, Math.max(min, capped - top));
    el.style.height = `${round(h)}px`;
    return h;
  }

  /** @param {PointerEvent} e */
  function onDown(e) {
    if (e.button !== 0) return;
    const handle =
      e.target instanceof Element ? e.target.closest('[data-resize-handle]') : null;
    if (!(handle instanceof HTMLElement) || !ui.contains(handle)) return;
    const section = sectionOf(handle);
    if (!section) return;
    const rect = section.el.getBoundingClientRect();
    drag = {
      ...section,
      ptr: e.pointerId,
      offset: rect.bottom - e.clientY,
      h: rect.height,
    };
    handle.setPointerCapture?.(e.pointerId);
    ui.classList.add('is-resizing');
    e.preventDefault();
  }

  /** @param {PointerEvent} e */
  function onMove(e) {
    if (!drag || e.pointerId !== drag.ptr) return;
    drag.h = applyHeight(drag.el, drag.min, e.clientY + drag.offset);
  }

  /** @param {PointerEvent} e */
  function onUp(e) {
    if (!drag || e.pointerId !== drag.ptr) return;
    const { id, h } = drag;
    drag = null;
    ui.classList.remove('is-resizing');
    opts.onResize?.(id, round(h));
  }

  /** Keyboard fallback — the game strip is pointer only */
  function onKey(e) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const handle =
      e.target instanceof Element ? e.target.closest('[data-resize-handle]') : null;
    if (!(handle instanceof HTMLElement)) return;
    const section = sectionOf(handle);
    if (!section) return;
    const rect = section.el.getBoundingClientRect();
    const step = e.key === 'ArrowDown' ? 16 : -16;
    const h = applyHeight(section.el, section.min, rect.bottom + step);
    opts.onResize?.(section.id, round(h));
    e.preventDefault();
  }

  ui.addEventListener('pointerdown', onDown);
  ui.addEventListener('keydown', onKey);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  return () => {
    ui.removeEventListener('pointerdown', onDown);
    ui.removeEventListener('keydown', onKey);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
}

/**
 * Game DamageMeter.open() always resets rect_size.y to 500, so a reopened meter
 * drops any dragged height.
 * @param {HTMLElement} tab
 */
export function clearResizedHeight(tab) {
  tab.style.height = '';
}

/**
 * @param {'log' | 'you' | 'opp'} id
 * @param {string} label
 */
export function resizeHandleHtml(id, label) {
  return `<button type="button" class="sim-clog-resize sim-clog-resize--${id}" data-resize-handle="${id}" aria-label="${label}" title="Drag to resize"></button>`;
}
