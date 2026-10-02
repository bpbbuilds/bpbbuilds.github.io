/**
 * Items riding with a dragged bag (Bag.getItemsInside → draggedInsideItems).
 * Touches any bag cell — including footprints that also sit in another bag.
 *
 * Game: cargo is reparented to Item.insideRotationNode, which tracks sprite
 * rotation — positions orbit and faces turn with the bag.
 */

import { shapeForItem, bodyBounds } from '../../shared/backpack-grid/index.js';
import { placementsInsideBag } from './collision.js';
import { gemCarry } from './socket-place.js';

/**
 * @param {object} bagItem
 * @param {{ x: number, y: number, r?: number, key?: string }} bagP
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 */
export function captureBagCargo(bagItem, bagP, placements, itemsById) {
  return placementsInsideBag(bagItem, bagP, placements, itemsById).map((p) => {
    const it = itemsById.get(p.id);
    const face = ((Number(p.r) || 0) % 4 + 4) % 4;
    const b = it
      ? bodyBounds(shapeForItem(it, face))
      : { w: 1, h: 1 };
    return {
      key: p.key,
      id: p.id,
      x: p.x,
      y: p.y,
      r: face,
      ox: Number(p.x) - Number(bagP.x),
      oy: Number(p.y) - Number(bagP.y),
      /** Footprint at current face — used when reprojecting with the bag */
      bw: Math.max(1, b.w),
      bh: Math.max(1, b.h),
      ...gemCarry(p),
    };
  });
}

/**
 * MultiSelect followers → draggedInsideItems (Item.pickup MultiSelect).
 * Main stays the held cursor; everyone else rides at cell offsets (ox, oy).
 *
 * @param {string} mainKey
 * @param {string[]} groupKeys main + followers (Inventory.getMultiSelectItems keys)
 * @param {object[]} placements
 * @param {Map<string, object>} itemsById
 */
export function captureMultiDraggedInside(mainKey, groupKeys, placements, itemsById) {
  const main = placements.find((p) => p.key === mainKey);
  if (!main || !groupKeys?.length) return [];
  /** @type {ReturnType<typeof captureBagCargo>} */
  const out = [];
  for (const key of groupKeys) {
    if (!key || key === mainKey) continue;
    const p = placements.find((row) => row.key === key);
    if (!p) continue;
    const it = itemsById.get(p.id);
    if (!it) continue;
    const face = ((Number(p.r) || 0) % 4 + 4) % 4;
    const b = bodyBounds(shapeForItem(it, face));
    out.push({
      key: p.key,
      id: p.id,
      x: p.x,
      y: p.y,
      r: face,
      ox: Number(p.x) - Number(main.x),
      oy: Number(p.y) - Number(main.y),
      bw: Math.max(1, b.w),
      bh: Math.max(1, b.h),
      ...gemCarry(p),
    });
  }
  return out;
}

/**
 * One 90° CW step of a cargo top-left inside a bag AABB (y-down cell grid).
 * Item AABB also turns CW (w↔h). Matches rotating children of insideRotationNode.
 *
 * @param {number} ox
 * @param {number} oy
 * @param {number} itemW
 * @param {number} itemH
 * @param {number} bagH bag body height *before* this CW step
 */
function rotateTopLeftCW(ox, oy, itemW, itemH, bagH) {
  return {
    ox: bagH - oy - itemH,
    oy: ox,
    bw: itemH,
    bh: itemW,
  };
}

/**
 * Reproject cargo cell offsets + faces when the bag face changes.
 * @param {{ ox: number, oy: number, id: string, r: number, key?: string, x?: number, y?: number, bw?: number, bh?: number }[]} cargo
 * @param {object} bagItem
 * @param {number} fromFace
 * @param {number} toFace
 * @param {Map<string, object>} [itemsById] fill bw/bh if missing (older cargo)
 */
export function reprojectCargoForFace(cargo, bagItem, fromFace, toFace, itemsById) {
  if (!cargo?.length || !bagItem) return cargo || [];
  let from = ((Number(fromFace) || 0) % 4 + 4) % 4;
  const to = ((Number(toFace) || 0) % 4 + 4) % 4;
  let steps = (to - from + 4) % 4;
  if (!steps) return cargo.map((c) => ({ ...c }));

  /** @type {typeof cargo} */
  let next = cargo.map((c) => {
    let bw = Number(c.bw);
    let bh = Number(c.bh);
    if ((!Number.isFinite(bw) || !Number.isFinite(bh)) && itemsById) {
      const it = itemsById.get(c.id);
      const face = ((Number(c.r) || 0) % 4 + 4) % 4;
      if (it) {
        const b = bodyBounds(shapeForItem(it, face));
        bw = b.w;
        bh = b.h;
      }
    }
    return {
      ...c,
      bw: Math.max(1, Number.isFinite(bw) ? bw : 1),
      bh: Math.max(1, Number.isFinite(bh) ? bh : 1),
    };
  });

  while (steps > 0) {
    const b = bodyBounds(shapeForItem(bagItem, from));
    next = next.map((entry) => {
      const ir = ((Number(entry.r) || 0) % 4 + 4) % 4;
      const turned = rotateTopLeftCW(
        Number(entry.ox) || 0,
        Number(entry.oy) || 0,
        entry.bw,
        entry.bh,
        b.h,
      );
      return {
        ...entry,
        ox: turned.ox,
        oy: turned.oy,
        bw: turned.bw,
        bh: turned.bh,
        r: (ir + 1) % 4,
      };
    });
    from = (from + 1) % 4;
    steps -= 1;
  }
  return next;
}
