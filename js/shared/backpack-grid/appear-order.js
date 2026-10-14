/**
 * Return a stable reveal order without changing the caller's collection.
 *
 * The Player Info preview can use a diagonal sweep from either board corner.
 * All other surfaces retain the original row order.
 * @template T
 * @param {({ x?: number, y?: number } & T)[]} entries
 * @param {'reading' | 'diagonal' | 'diagonal-top-right'} [order]
 * @returns {({ x?: number, y?: number } & T)[]}
 */
export function orderAppearEntries(entries, order = 'reading') {
  return [...entries].sort((a, b) => {
    const ax = Number(a.x) || 0;
    const ay = Number(a.y) || 0;
    const bx = Number(b.x) || 0;
    const by = Number(b.y) || 0;
    if (order === 'diagonal') {
      const diagonal = ax + ay - (bx + by);
      if (diagonal) return diagonal;
    }
    if (order === 'diagonal-top-right') {
      // Sweep anti-diagonals from the board's top-right toward its
      // bottom-left. The board width is intentionally not required: y - x
      // preserves the same ordering for any clipped/rotated board slice.
      const diagonal = ay - ax - (by - bx);
      if (diagonal) return diagonal;
      const diagonalRow = ay - by;
      if (diagonalRow) return diagonalRow;
      return bx - ax;
    }
    const dy = ay - by;
    if (dy) return dy;
    return ax - bx;
  });
}
