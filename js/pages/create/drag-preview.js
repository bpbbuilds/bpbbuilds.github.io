/**
 * Inventory.previewItem wiring — taxonomy tiles + affect + gem hover.
 */

import {
  floatOriginAtPointer,
  isBagItem,
  isGemItem,
  toSkipSet,
} from './collision.js';
import {
  previewTaxonomyFromFloat,
  tryAddFromFloat,
} from './try-add.js';
import { pickOffsetPx } from './drag-feel.js';
import {
  findHoveredSocket,
  paintSocketHover,
  setShowSockets,
} from './socket-place.js';

/**
 * @param {{
 *   grid: { el: HTMLElement },
 *   stageEl: HTMLElement | null,
 *   ghostEl: HTMLElement | null,
 *   state: any,
 *   itemsById: Map<string, object>,
 *   metrics: ReturnType<import('./drag-metrics.js').createDragMetrics>,
 *   affect: { clear: () => void, sync: (o: object) => void } | null,
 *   invPreview: { clear: () => void, paint: (o: object) => void, destroy?: () => void } | null,
 *   getEditMode: () => string,
 *   updateDragCursor: (id: string, r: number, x: number, y: number, dt?: number, ok?: boolean) => void,
 *   setGemSocketsVisible: (on: boolean) => void,
 *   getHoveredSocket: () => any,
 *   setHoveredSocket: (s: any) => void,
 *   setLastPlaceOk: (v: boolean) => void,
 *   getHeldSkipKeys?: () => string[],
 *   getCanSnap?: () => boolean,
 * }} deps
 */
export function createPreviewController(deps) {
  const {
    grid,
    stageEl,
    ghostEl,
    state,
    itemsById,
    metrics,
    affect,
    invPreview,
    getEditMode,
    updateDragCursor,
    setGemSocketsVisible,
    getHoveredSocket,
    setHoveredSocket,
    setLastPlaceOk,
    getHeldSkipKeys,
    getCanSnap,
  } = deps;

  /** @type {ReturnType<typeof tryAddFromFloat> | { socket: true } | null} */
  let lastTryAdd = null;

  /**
   * @param {string} itemId
   * @param {number} r
   * @param {number} clientX
   * @param {number} clientY
   * @param {string | null} skipKey
   * @param {number} [dt]
   */
  function previewAt(itemId, r, clientX, clientY, skipKey, dt) {
    const item = itemsById.get(itemId);
    if (!item || !(stageEl instanceof HTMLElement)) {
      updateDragCursor(itemId, r, clientX, clientY, dt, false);
      affect?.clear();
      invPreview?.clear();
      return null;
    }
    const m = metrics.ensure();
    const board = m?.board || grid.el.querySelector('.bpb-bg__board');
    if (!(board instanceof HTMLElement)) {
      affect?.clear();
      invPreview?.clear();
      return null;
    }
    const boardRect = m?.boardRect || board.getBoundingClientRect();
    const stageRect = m?.stageRect || stageEl.getBoundingClientRect();
    const placements = state.getDraft().placements;
    const mode = getEditMode();
    const pickX = clientX;
    const pickY = clientY - pickOffsetPx();

    setHoveredSocket(null);
    if (isGemItem(item)) {
      setShowSockets(grid.el, true);
      const hovered = findHoveredSocket(
        grid.el, pickX, pickY, m?.cellPx ?? metrics.currentCellPx(),
      );
      setHoveredSocket(hovered);
      paintSocketHover(grid.el, hovered);
      if (hovered) {
        updateDragCursor(itemId, r, clientX, clientY, dt, true);
        setLastPlaceOk(true);
        affect?.clear();
        invPreview?.clear();
        lastTryAdd = { socket: true };
        return lastTryAdd;
      }
    } else {
      setGemSocketsVisible(false);
    }

    const floatOrigin = floatOriginAtPointer(
      board, item, r, pickX, pickY, boardRect,
    );
    // Held main + multi followers + cargo must not collide with themselves
    const held = getHeldSkipKeys?.() || [];
    const skip =
      toSkipSet([skipKey, ...held].filter(Boolean)) || skipKey || null;
    const canSnap = getCanSnap ? getCanSnap() : true;
    const tryAdd = tryAddFromFloat(
      item, floatOrigin, r, placements, itemsById, skip, mode, { canSnap },
    );
    const hover = previewTaxonomyFromFloat(
      item, floatOrigin, r, placements, itemsById, skip, mode,
    );
    const cursorOk = !!(tryAdd && (
      tryAdd.collisions.length === 0
      || (!isBagItem(item) && tryAdd.collisions.length >= 1)
    ));
    updateDragCursor(itemId, r, clientX, clientY, dt, cursorOk);
    setLastPlaceOk(cursorOk);

    affect?.sync({
      item,
      r,
      origin: floatOrigin,
      placements,
      itemsById,
      skipKey: skip,
      boardRect,
      stageRect,
    });

    // Bags: same board CanAdd / CantAdd under the footprint as items.
    // PotentialSpace (FilledSlot) fills empty cells; hover cells punch that hole.
    invPreview?.paint({
      cells: hover.cells,
      showPotential: isBagItem(item),
      placements,
      itemsById,
      skipKey: skip,
      boardRect,
      stageRect,
    });

    // Keep last *valid* board snap across a one-frame miss (fast rotate+drop).
    // Bags: clear on miss so drop never reapplies an older edge snap.
    if (tryAdd) lastTryAdd = tryAdd;
    else if (isBagItem(item)) lastTryAdd = null;
    if (!tryAdd) return null;
    return tryAdd;
  }

  function hidePreview() {
    if (ghostEl instanceof HTMLElement) {
      ghostEl.hidden = true;
      ghostEl.replaceChildren();
      ghostEl.classList.remove('is-bag', 'is-valid', 'is-invalid');
    }
    invPreview?.clear();
    affect?.clear();
    lastTryAdd = null;
  }

  return {
    previewAt,
    hidePreview,
    /** Last non-null board tryAdd from preview (fallback for fast drop). */
    getLastTryAdd: () => lastTryAdd,
  };
}
