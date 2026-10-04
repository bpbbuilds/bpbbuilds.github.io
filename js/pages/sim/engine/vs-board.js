/**
 * Bag-vs-bag first slice: opponent placements share the dummy actor.
 * Ports keep ctx.player / ctx.dummy via a side flip.
 */

/**
 * @param {{ id: string, key?: string, gems?: string[], x?: number, y?: number, r?: number }[]} placements
 */
export function tagOpponentPlacements(placements) {
  return (placements || []).map((p, i) => ({
    ...p,
    side: 'them',
    key: String(p.key || `${p.id}:${i}`).startsWith('opp:')
      ? String(p.key || `${p.id}:${i}`)
      : `opp:${p.key || `${p.id}:${i}:${p.x},${p.y}`}`,
  }));
}

/**
 * @param {{ side?: string }} piece
 */
export function pieceIsThem(piece) {
  return piece?.side === 'them';
}

/**
 * @param {object} piece
 * @param {{
 *   you: object,
 *   them: object,
 *   youGraph: object,
 *   themGraph: object,
 *   youPieces: object[],
 *   themPieces: object[],
 *   youDeck: { i: number },
 *   themDeck: { i: number },
 *   youCardKeys: string[],
 *   themCardKeys: string[],
 *   t: number,
 *   rng: () => number,
 *   events: object[],
 *   itemsById: Map<string, object>,
 *   canAffect: object | null,
 *   activatePiece: Function,
 *   bus: object,
 *   fatigue: object,
 *   notifyDealtDamage: Function,
 *   notifyPreDealDamageEarly: Function,
 * }} world
 */
export function ctxForPiece(piece, world) {
  const them = pieceIsThem(piece);
  return {
    t: world.t,
    player: them ? world.them : world.you,
    dummy: them ? world.you : world.them,
    rng: world.rng,
    events: world.events,
    graph: them ? world.themGraph : world.youGraph,
    itemsById: world.itemsById,
    canAffect: world.canAffect,
    pieces: them ? world.themPieces : world.youPieces,
    /** Both boards — for auras that hit player + opponent (Time Dilator, …). */
    allPieces: [...(world.youPieces || []), ...(world.themPieces || [])],
    deckIndex: them ? world.themDeck : world.youDeck,
    cardKeys: them ? world.themCardKeys : world.youCardKeys,
    activatePiece: world.activatePiece,
    bus: world.bus,
    fatigue: world.fatigue,
    notifyDealtDamage: world.notifyDealtDamage,
    notifyPreDealDamageEarly: world.notifyPreDealDamageEarly,
    logChain: world.logChain,
    chargeJobs: world.chargeJobs,
  };
}

/**
 * @param {object} piece
 * @param {{ you: { stacks: object }, them: { stacks: object } }} world
 */
export function ownerStacks(piece, world) {
  return pieceIsThem(piece) ? world.them.stacks : world.you.stacks;
}

/** @typedef {'player' | 'dummy'} EventSide */

/**
 * World-relative combat-log side for the piece owner (`player` = you, `dummy` = opp board).
 * @param {{ side?: string, placementKey?: string } | null | undefined} piece
 * @returns {EventSide}
 */
export function eventSideForPiece(piece) {
  if (pieceIsThem(piece)) return 'dummy';
  if (piece?.placementKey && String(piece.placementKey).startsWith('opp:')) return 'dummy';
  return 'player';
}

/**
 * @param {{ side?: string, placementKey?: string } | null | undefined} piece
 * @returns {EventSide}
 */
export function eventFoeSide(piece) {
  return eventSideForPiece(piece) === 'dummy' ? 'player' : 'dummy';
}

/**
 * Buff/heal owner for report rollup when legacy events hardcode `target: 'player'`.
 * @param {object} e
 * @param {EventSide} fallback
 * @returns {EventSide}
 */
export function eventOwnerSide(e, fallback) {
  if (e.placementKey && String(e.placementKey).startsWith('opp:')) return 'dummy';
  if (e.actor === 'player' || e.actor === 'dummy') return e.actor;
  if (e.target === 'player' || e.target === 'dummy') return e.target;
  return fallback;
}
