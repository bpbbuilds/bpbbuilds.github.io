/**
 * Rubber-band multi-select (Interface/SelectionBox.gd).
 * LMB-drag empty board → grow rect → brighten pickable hits → release picks up.
 */

import { canMarqueePick } from './collision.js';

/**
 * @param {{
 *   stageEl: HTMLElement,
 *   grid: { el: HTMLElement },
 *   itemsById: Map<string, object>,
 *   getEditMode: () => string,
 *   onHitsChange: (keys: string[]) => void,
 * }} opts
 */
export function createSelectionBox(opts) {
  const { stageEl, grid, itemsById, getEditMode, onHitsChange } = opts;

  let active = false;
  let startX = 0;
  let startY = 0;
  let frames = 0;
  /** @type {string[]} */
  let hitKeys = [];
  /** @type {HTMLElement | null} */
  let boxEl = null;
  /** @type {number} */
  let pointerId = -1;

  function ensureBox() {
    if (boxEl?.isConnected) return boxEl;
    boxEl = document.createElement('div');
    boxEl.className = 'create-board__selection-box';
    boxEl.hidden = true;
    boxEl.setAttribute('aria-hidden', 'true');
    stageEl.appendChild(boxEl);
    return boxEl;
  }

  function stageRect() {
    return stageEl.getBoundingClientRect();
  }

  /**
   * @param {number} x0
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   */
  function paintBox(x0, y0, x1, y1) {
    const el = ensureBox();
    const sr = stageRect();
    const left = Math.min(x0, x1) - sr.left;
    const top = Math.min(y0, y1) - sr.top;
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    el.hidden = false;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
  }

  /**
   * @param {number} x0
   * @param {number} y0
   * @param {number} x1
   * @param {number} y1
   * @returns {string[]}
   */
  function hitTest(x0, y0, x1, y1) {
    const left = Math.min(x0, x1);
    const right = Math.max(x0, x1);
    const top = Math.min(y0, y1);
    const bottom = Math.max(y0, y1);
    const mode = getEditMode();
    /** @type {string[]} */
    const keys = [];
    grid.el
      .querySelectorAll('.bpb-bg__item:not(.bpb-bg__item--parked)')
      .forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const key = node.dataset.placementKey;
        if (!key) return;
        const id = node.getAttribute('data-item-id');
        const item = id ? itemsById.get(id) : null;
        if (!canMarqueePick(item, mode)) return;
        const r = node.getBoundingClientRect();
        if (r.right < left || r.left > right || r.bottom < top || r.top > bottom) {
          return;
        }
        keys.push(key);
      });
    return keys;
  }

  function sameKeys(a, b) {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every((k) => set.has(k));
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} [pid]
   */
  function start(clientX, clientY, pid = -1) {
    if (active) cancel();
    active = true;
    pointerId = pid;
    startX = clientX;
    startY = clientY;
    frames = 0;
    hitKeys = [];
    document.body.classList.add('is-bpb-selecting');
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      /* ignore */
    }
    paintBox(startX, startY, startX, startY);
    onHitsChange([]);
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   */
  function move(clientX, clientY) {
    if (!active) return;
    frames += 1;
    paintBox(startX, startY, clientX, clientY);
    const next = hitTest(startX, startY, clientX, clientY);
    if (!sameKeys(hitKeys, next)) {
      hitKeys = next;
      onHitsChange(hitKeys.slice());
    }
  }

  /**
   * @param {number} clientX
   * @param {number} clientY
   * @returns {{ keys: string[], clientX: number, clientY: number, moved: boolean, pointerId: number } | null}
   */
  function end(clientX, clientY) {
    if (!active) return null;
    move(clientX, clientY);
    const moved =
      frames >= 2 ||
      (clientX - startX) ** 2 + (clientY - startY) ** 2 > 16;
    const result = {
      keys: hitKeys.slice(),
      clientX,
      clientY,
      moved,
      pointerId,
    };
    hide();
    return result;
  }

  function hide() {
    active = false;
    pointerId = -1;
    frames = 0;
    hitKeys = [];
    document.body.classList.remove('is-bpb-selecting');
    if (boxEl) {
      boxEl.hidden = true;
      boxEl.style.width = '0';
      boxEl.style.height = '0';
    }
  }

  function cancel() {
    if (!active) return;
    hide();
    onHitsChange([]);
  }

  /**
   * Closest selected placement key to a client point (SelectionBox mainBag).
   * @param {string[]} keys
   * @param {number} clientX
   * @param {number} clientY
   */
  function closestKey(keys, clientX, clientY) {
    let best = /** @type {string | null} */ (null);
    let bestDist = Infinity;
    for (const key of keys) {
      const el = grid.el.querySelector(
        `.bpb-bg__item[data-placement-key="${CSS.escape(key)}"]:not(.bpb-bg__item--parked)`,
      );
      if (!(el instanceof HTMLElement)) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = (cx - clientX) ** 2 + (cy - clientY) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = key;
      }
    }
    return best || keys[0] || null;
  }

  return {
    start,
    move,
    end,
    cancel,
    isActive: () => active,
    getPointerId: () => pointerId,
    closestKey,
    destroy() {
      cancel();
      boxEl?.remove();
      boxEl = null;
    },
  };
}
