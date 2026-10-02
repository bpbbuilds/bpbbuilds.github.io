/**
 * Create Sellbox stand-in — delete held item.
 *
 * Single bag: game Item.drop → SELLBOX (sell main, insides/gems → Parked).
 * Multi-select: delete every selected piece; socketed gems still → Parked.
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
 * @param {(string | null | undefined)[] | null | undefined} gems
 * @param {import('./draft-io.js').ParkedEntry[]} toPark
 */
function parkGems(gems, toPark) {
  if (!Array.isArray(gems)) return;
  for (const gid of gems) {
    if (!gid) continue;
    toPark.push({
      id: String(gid),
      r: 0,
      key: newPlacementKey(),
      priority: null,
    });
  }
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
  const discardFollowers = Array.isArray(multiMoveKeys) && multiMoveKeys.length > 1;
  const cargo = Array.isArray(cur.cargo) ? cur.cargo : [];

  for (const c of cargo) {
    if (c?.key) removeKeys.add(c.key);
    if (discardFollowers) {
      // Multi-select: dump the follower, keep only its socketed gems.
      parkGems(c.gems, toPark);
      continue;
    }
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

  parkGems(cur.gems, toPark);

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
