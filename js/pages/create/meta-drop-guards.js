/**
 * Item-derived Build Info edits require an actual board item to anchor them.
 * Plain text metadata remains editable on an empty board.
 * @param {unknown} placements
 * @returns {boolean}
 */
export function hasBoardItems(placements) {
  return Array.isArray(placements) && placements.length > 0;
}
