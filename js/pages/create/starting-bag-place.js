/**
 * Auto-place a starting bag on the create board (once, best-effort).
 * Prefers cells near the board center (outward spiral by Manhattan distance).
 */

import { canPlace, BOARD_COLS, BOARD_ROWS } from './collision.js';
import { EDIT_MODE } from './editor-state.js';
import { newPlacementKey } from './draft-io.js';

/**
 * @returns {{ x: number, y: number }[]}
 */
function cellsFromCenter() {
  const cx = Math.floor(BOARD_COLS / 2);
  const cy = Math.floor(BOARD_ROWS / 2);
  /** @type {{ x: number, y: number, d: number }[]} */
  const cells = [];
  for (let y = 0; y < BOARD_ROWS; y += 1) {
    for (let x = 0; x < BOARD_COLS; x += 1) {
      cells.push({ x, y, d: Math.abs(x - cx) + Math.abs(y - cy) });
    }
  }
  cells.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  return cells;
}

/**
 * @param {{
 *   state: ReturnType<import('./editor-state.js').createEditorState>,
 *   itemsById: Map<string, object>,
 *   itemId: string,
 * }} opts
 * @returns {boolean} true if a new placement was added
 */
export function tryAutoPlaceStartingBag(opts) {
  const { state, itemsById, itemId } = opts;
  const id = String(itemId || '').trim();
  if (!id) return false;
  const item = itemsById.get(id);
  if (!item) return false;

  const placements = state.getDraft().placements || [];
  if (placements.some((p) => p.id === id)) return false;

  for (const { x, y } of cellsFromCenter()) {
    for (let r = 0; r < 4; r += 1) {
      if (
        !canPlace(
          item,
          { x, y, r },
          placements,
          itemsById,
          null,
          EDIT_MODE.BAG_LAYER,
        )
      ) {
        continue;
      }
      const row = state.addPlacement?.({
        id,
        x,
        y,
        r,
        key: newPlacementKey(),
        priority: null,
      });
      return !!row;
    }
  }

  // Last resort: drop at center origin even if shape checks failed (missing shape data)
  const cx = Math.max(0, Math.floor(BOARD_COLS / 2) - 1);
  const cy = Math.max(0, Math.floor(BOARD_ROWS / 2) - 1);
  const row = state.addPlacement?.({
    id,
    x: cx,
    y: cy,
    r: 0,
    key: newPlacementKey(),
    priority: null,
  });
  return !!row;
}
