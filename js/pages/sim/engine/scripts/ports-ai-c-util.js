/**
 * Band AI Wave C — shared adjacency helper.
 */

import { affectedTargets } from '../board-graph.js';

/**
 * @param {object} ctx
 * @param {object} piece
 * @param {(o: object, link: object) => boolean} [pred]
 * @returns {{ other: object, link: object }[]}
 */
export function linkedWith(ctx, piece, pred) {
  const links = affectedTargets(ctx.graph, piece.placementKey, ctx.itemsById, ctx.canAffect);
  /** @type {{ other: object, link: object }[]} */
  const out = [];
  for (const link of links) {
    const other = (ctx.pieces || []).find((p) => p.placementKey === link.key);
    if (!other || other.placementKey === piece.placementKey) continue;
    if (pred && !pred(other, link)) continue;
    out.push({ other, link });
  }
  return out;
}
