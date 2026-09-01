/**
 * Create Sellbox stand-in — delete held item; cargo/gems → Parked
 * (game Item.drop → SELLBOX: sell main, pushDraggedInside / gems to storage).
 */

import { newPlacementKey } from './draft-io.js';
import { parkedFromPlacement, pointOverElement } from './park-strip.js';

/**
 * @param {HTMLElement | null | undefined} sellEl
 * @param {number} clientX
 * @param {number} clientY
 */
export function pointerOverSell(sellEl, clientX, clientY) {
  // Sellbox.isHovered — mouse in sell rect (not bag position)
  return pointOverElement(sellEl, clientX, clientY);
}

/**
 * @param {{
 *   cur: any,
 *   state: any,
 *   itemsById: Map<string, object>,
 *   multiMoveKeys: string[] | null,
 *   endDragHard: () => void,
 * }} args
 * @returns {'done' | 'failed'}
 */
export function commitDragToSell(args) {
  const { cur, state, multiMoveKeys, endDragHard } = args;
  if (!cur) return 'failed';

  /** @type {Set<string>} */
  const removeKeys = new Set();
  /** @type {import('./draft-io.js').ParkedEntry[]} */
  const toPark = [];

  // Game: cargo / multi followers → storage (Parked), main is discarded
  for (const c of Array.isArray(cur.cargo) ? cur.cargo : []) {
    if (c?.key) removeKeys.add(c.key);
    if (c?.id) {
      toPark.push(
        parkedFromPlacement({
          id: c.id,
          r: c.r,
          key: c.key || newPlacementKey(),
          gems: c.gems,
          priority: null,
        }),
      );
    }
  }

  // Game pushGemsToStorage on sell
  if (Array.isArray(cur.gems)) {
    for (const gid of cur.gems) {
      if (!gid) continue;
      toPark.push({
        id: String(gid),
        r: 0,
        key: newPlacementKey(),
        priority: null,
      });
    }
  }

  if (cur.mode === 'move' && cur.moveKey) {
    removeKeys.add(cur.moveKey);
    if (multiMoveKeys?.length) {
      for (const k of multiMoveKeys) {
        if (!k || k === cur.moveKey) continue;
        // Followers should already be in cargo; belt-and-suspenders
        removeKeys.add(k);
      }
    }
    const placements = state.getDraft().placements;
    state.setPlacements(placements.filter((p) => !p.key || !removeKeys.has(p.key)));
  } else if (cur.mode === 'unsocket') {
    // Gem already lifted from host — discard it (do not reseat)
    cur.unsocketRestore = null;
  } else if (cur.fromPark && cur.restoreParked) {
    // Already removed from parked on lift — just discard
    cur.restoreParked = null;
  } else if (cur.hotswap && cur.restorePlacement?.key) {
    // Free-follow orphan already off the board
    removeKeys.add(cur.restorePlacement.key);
    const placements = state.getDraft().placements;
    if (placements.some((p) => p.key === cur.restorePlacement.key)) {
      state.setPlacements(
        placements.filter((p) => p.key !== cur.restorePlacement.key),
      );
    }
  }
  // Catalog place: nothing on board to remove

  if (toPark.length) state.appendParked?.(toPark);
  endDragHard();
  return 'done';
}

/**
 * Fixed bottom-right Chestnut sell bin (game Sellbox).
 * @param {HTMLElement} root append target (usually document.body or page main)
 * @returns {{ el: HTMLElement, destroy: () => void }}
 */
export function mountSellBin(root) {
  const el = document.createElement('aside');
  el.className = 'create-sellbin';
  el.dataset.createSell = '';
  el.setAttribute('aria-label', 'Delete — drop items to remove');
  el.innerHTML = `
    <div class="create-sellbin__chest" aria-hidden="true">
      <img class="create-sellbin__bottom" src="" alt="" draggable="false" />
      <img class="create-sellbin__top" src="" alt="" draggable="false" />
    </div>
  `;

  const rootPrefix = document.body?.dataset?.root ?? '../';
  const base = rootPrefix.endsWith('/') ? rootPrefix : `${rootPrefix}/`;
  const bottom = el.querySelector('.create-sellbin__bottom');
  const top = el.querySelector('.create-sellbin__top');
  if (bottom instanceof HTMLImageElement) {
    bottom.src = `${base}assets/theme/ui/sellbox/bottom-front.png`;
  }
  if (top instanceof HTMLImageElement) {
    top.src = `${base}assets/theme/ui/sellbox/top-front.png`;
  }

  root.appendChild(el);
  return {
    el,
    destroy() {
      el.remove();
    },
  };
}
