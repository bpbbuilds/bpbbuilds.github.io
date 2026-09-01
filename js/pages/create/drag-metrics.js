/**
 * Board/stage metrics for create drag (rects + cell size).
 */

import { BOARD_COLS } from './collision.js';

/**
 * @param {{
 *   grid: { el: HTMLElement },
 *   stageEl: HTMLElement | null,
 *   cellPx: number,
 *   isActive: () => boolean,
 * }} opts
 */
export function createDragMetrics(opts) {
  const { grid, stageEl, cellPx, isActive } = opts;

  let cachedBoardEl = /** @type {HTMLElement | null} */ (null);
  /** @type {ResizeObserver | null} */
  let metricsRo = null;
  /** @type {{ board: HTMLElement, boardRect: DOMRect, stageRect: DOMRect, cellPx: number, at: number } | null} */
  let dragMetrics = null;

  function boardEl() {
    if (cachedBoardEl?.isConnected) return cachedBoardEl;
    const el = grid.el.querySelector('.bpb-bg__board');
    cachedBoardEl = el instanceof HTMLElement ? el : null;
    return cachedBoardEl;
  }

  /**
   * @param {boolean} [force]
   */
  function ensure(force = false) {
    if (!force && dragMetrics && dragMetrics.board.isConnected) {
      return dragMetrics;
    }
    const board = boardEl();
    if (!(board instanceof HTMLElement) || !(stageEl instanceof HTMLElement)) {
      dragMetrics = null;
      return null;
    }
    const boardRect = board.getBoundingClientRect();
    const stageRect = stageEl.getBoundingClientRect();
    dragMetrics = {
      board,
      boardRect,
      stageRect,
      cellPx: boardRect.width > 0 ? boardRect.width / BOARD_COLS : cellPx,
      at: performance.now(),
    };
    return dragMetrics;
  }

  function currentCellPx() {
    const m = ensure();
    if (m) return m.cellPx;
    const board = boardEl();
    if (!(board instanceof HTMLElement)) return cellPx;
    const w = board.getBoundingClientRect().width;
    return w > 0 ? w / BOARD_COLS : cellPx;
  }

  function clear() {
    dragMetrics = null;
  }

  function bindObserver() {
    if (metricsRo || typeof ResizeObserver === 'undefined') return;
    metricsRo = new ResizeObserver(() => {
      if (isActive()) ensure(true);
    });
    if (stageEl instanceof HTMLElement) metricsRo.observe(stageEl);
    const b = boardEl();
    if (b) metricsRo.observe(b);
  }

  function destroy() {
    metricsRo?.disconnect();
    metricsRo = null;
    clear();
  }

  bindObserver();

  return {
    boardEl,
    ensure,
    currentCellPx,
    clear,
    destroy,
  };
}
