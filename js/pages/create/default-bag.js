/**
 * The compact 9x7 starter layout: leather bags fill the interior while
 * stamina sacks make the top and left edges.
 */
export const DEFAULT_BAG_LAYOUT = Object.freeze([
  { id: 'stamina_sack', x: 0, y: 0, r: 1 },
  { id: 'stamina_sack', x: 3, y: 0, r: 1 },
  { id: 'stamina_sack', x: 6, y: 0, r: 1 },
  { id: 'stamina_sack', x: 0, y: 1, r: 0 },
  { id: 'stamina_sack', x: 0, y: 4, r: 0 },
  { id: 'leather_bag', x: 1, y: 1, r: 0 },
  { id: 'leather_bag', x: 3, y: 1, r: 0 },
  { id: 'leather_bag', x: 5, y: 1, r: 0 },
  { id: 'leather_bag', x: 7, y: 1, r: 0 },
  { id: 'leather_bag', x: 1, y: 3, r: 0 },
  { id: 'leather_bag', x: 3, y: 3, r: 0 },
  { id: 'leather_bag', x: 5, y: 3, r: 0 },
  { id: 'leather_bag', x: 7, y: 3, r: 0 },
  { id: 'leather_bag', x: 1, y: 5, r: 0 },
  { id: 'leather_bag', x: 3, y: 5, r: 0 },
  { id: 'leather_bag', x: 5, y: 5, r: 0 },
  { id: 'leather_bag', x: 7, y: 5, r: 0 },
]);

/**
 * @param {Map<string, object>} itemsById
 * @param {(index: number) => string} [keyFactory]
 */
export function createDefaultBagPlacements(itemsById, keyFactory = (i) => `default-bag-${i}`) {
  if (!itemsById?.has('leather_bag') || !itemsById.has('stamina_sack')) return [];
  const placements = [];
  for (const [index, layout] of DEFAULT_BAG_LAYOUT.entries()) {
    placements.push({ ...layout, key: keyFactory(index) });
  }
  return placements;
}

/**
 * Confirm, preserve the old board in Parked, and install the starter layout.
 * @param {{
 *   state: object,
 *   itemsById: Map<string, object>,
 *   confirm?: () => Promise<boolean> | boolean,
 *   keyFactory?: (index: number) => string,
 *   parkedFromPlacement?: (placement: object) => object,
 *   canFitParkEntries?: (parked: object[], incoming: object[]) => boolean,
 *   onParkOverflow?: () => void,
 * }} opts
 */
export async function applyDefaultBag({
  state,
  itemsById,
  confirm = () => true,
  keyFactory,
  parkedFromPlacement = (placement) => ({
    id: placement.id,
    r: placement.r,
    key: placement.key,
    priority: placement.priority ?? null,
  }),
  canFitParkEntries = () => true,
  onParkOverflow,
}) {
  const current = state.getDraft?.().placements || [];
  if (current.length && !(await confirm())) return false;
  if (state.isHistoryLocked?.() && !(await state.requestHistoryUnlock?.())) return false;

  const next = createDefaultBagPlacements(itemsById, keyFactory);
  if (!next.length) return false;

  const incoming = current.map(parkedFromPlacement);
  const parked = state.getParked?.() || [];
  if (incoming.length && !canFitParkEntries(parked, incoming)) {
    onParkOverflow?.();
    return false;
  }
  if (incoming.length) state.appendParked?.(incoming);
  state.setPlacements?.(next);
  return true;
}
