/**
 * Typical bag gold from board placements (item `cost`; gems excluded).
 */

/**
 * @param {import('./draft-io.js').DraftPlacement[]} placements
 * @param {Map<string, object>} itemsById
 * @returns {number}
 */
export function sumBoardGold(placements, itemsById) {
  if (!Array.isArray(placements) || !(itemsById instanceof Map)) return 0;
  let total = 0;
  for (const p of placements) {
    if (!p?.id) continue;
    const item = itemsById.get(p.id);
    const n = Number(item?.cost);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}
