/**
 * Shared food activation helpers (Band Z 151).
 */

/**
 * @param {object} piece
 * @param {object} ctx
 * @param {string} handler
 */
export function markFoodConsumed(piece, ctx, handler) {
  if (piece.charges != null) {
    piece.charges -= 1;
    if (piece.charges <= 0) {
      piece.alive = false;
      ctx.events.push({
        t: ctx.t + 0.008,
        type: 'info',
        itemId: piece.itemId,
        placementKey: piece.placementKey,
        label: `${piece.name} consumed`,
        meta: { category: 'consumable', script: true, handler },
      });
    }
  }
}

/**
 * True if piece looks empowerable for aura damage buffs.
 * @param {object} other
 */
export function canBeEmpoweredPiece(other) {
  if (other.empowerable === false) return false;
  return (
    other.damageMax > 0 ||
    other.damageMin > 0 ||
    other.kind === 'weapon' ||
    other.kind === 'pet'
  );
}

/**
 * True if piece has an active combat cooldown loop.
 * @param {object} other
 */
export function hasCombatCooldown(other) {
  return other.cooldown > 0 && other.cooldown < 500;
}
