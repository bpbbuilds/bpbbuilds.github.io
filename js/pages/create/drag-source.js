/**
 * Hide board/catalog item + rarity under while lifted (shop drag).
 * Unders live in a separate layer — must be found and hidden or a faint
 * footprint stays behind (reads as “transparent”).
 */

import { placementBodyCells } from './collision.js';

/**
 * @param {HTMLElement} itemEl
 * @param {HTMLElement} underEl
 */
function sameCell(itemEl, underEl) {
  const il = parseFloat(itemEl.style.left);
  const it = parseFloat(itemEl.style.top);
  const ul = parseFloat(underEl.style.left);
  const ut = parseFloat(underEl.style.top);
  if (![il, it, ul, ut].every(Number.isFinite)) return false;
  return Math.abs(il - ul) < 0.001 && Math.abs(it - ut) < 0.001;
}

/**
 * @param {HTMLElement} itemEl
 */
export function markDragSource(itemEl) {
  itemEl.classList.add('is-drag-source');
  const id = itemEl.getAttribute('data-item-id');
  if (!id) return;
  const root = itemEl.closest('.bpb-bg');
  if (!root) return;

  /** @type {HTMLElement[]} */
  const candidates = [];
  root
    .querySelectorAll(
      `.bpb-bg__under-item[data-item-id="${CSS.escape(id)}"]:not(.bpb-bg__under-item--parked)`,
    )
    .forEach((u) => {
      if (u instanceof HTMLElement) candidates.push(u);
    });

  if (!candidates.length) return;

  const matched = candidates.filter((u) => sameCell(itemEl, u));
  if (matched.length) {
    matched.forEach((u) => u.classList.add('is-drag-source'));
    return;
  }

  // Itemiary: one live instance per id — hide it even if left/top strings differ.
  if (candidates.length === 1) {
    candidates[0].classList.add('is-drag-source');
    return;
  }

  // Board duplicates: pick nearest under by cell distance.
  let best = /** @type {HTMLElement | null} */ (null);
  let bestDist = Infinity;
  const il = parseFloat(itemEl.style.left) || 0;
  const it = parseFloat(itemEl.style.top) || 0;
  for (const u of candidates) {
    const d =
      Math.abs((parseFloat(u.style.left) || 0) - il) +
      Math.abs((parseFloat(u.style.top) || 0) - it);
    if (d < bestDist) {
      bestDist = d;
      best = u;
    }
  }
  best?.classList.add('is-drag-source');
}

/**
 * Hide only this bag’s FilledSlot fabric cells (leave other bags’ slots visible).
 * @param {HTMLElement} boardRoot
 * @param {object} bagItem
 * @param {{ x: number, y: number, r?: number }} bagP
 */
export function hideBagFabricCells(boardRoot, bagItem, bagP) {
  const fabric = boardRoot.querySelector('.bpb-bg__fabric');
  if (!(fabric instanceof HTMLElement)) return;
  const keys = new Set(
    placementBodyCells(bagItem, bagP).map((c) => `${c.x},${c.y}`),
  );
  if (!keys.size) return;
  fabric.querySelectorAll('.bpb-bg__cell--bag').forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const x = Math.floor(parseFloat(el.style.left) || 0);
    const y = Math.floor(parseFloat(el.style.top) || 0);
    if (keys.has(`${x},${y}`)) el.classList.add('is-drag-source');
  });
}

/**
 * @param {HTMLElement} boardRoot
 * @param {{ key: string }[]} cargo
 */
export function hideCargoSources(boardRoot, cargo) {
  if (!cargo?.length) return;
  for (const entry of cargo) {
    const el = boardRoot.querySelector(
      `.bpb-bg__item[data-placement-key="${CSS.escape(entry.key)}"]`,
    );
    if (el instanceof HTMLElement) markDragSource(el);
  }
}

/**
 * @param {HTMLElement} boardRoot
 * @param {string[]} keys
 */
export function hideGroupSources(boardRoot, keys) {
  if (!keys?.length) return;
  for (const key of keys) {
    if (!key) continue;
    const el = boardRoot.querySelector(
      `.bpb-bg__item[data-placement-key="${CSS.escape(key)}"]:not(.bpb-bg__item--parked)`,
    );
    if (el instanceof HTMLElement) markDragSource(el);
  }
}

export function clearDragSources() {
  document.querySelectorAll('.is-drag-source').forEach((el) => {
    el.classList.remove('is-drag-source');
  });
}

/**
 * Live drag lookup registered by the active drag session.
 * Lets passive listeners (board onboarding overlay) know what is being dragged
 * without the session wiring callbacks into each controller.
 * @type {(() => any) | null}
 */
let dragLookup = null;

/** @param {() => any} lookup */
export function registerDragLookup(lookup) {
  dragLookup = lookup;
}

/** @returns {any} */
export function getCurrentDrag() {
  return dragLookup ? dragLookup() : null;
}

/** @param {boolean} on */
export function setCreateDragging(on) {
  document.body.classList.toggle('is-bpb-dragging', on);
  if (on) {
    // Kill native text/image selection (RMB + drag outside board)
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      /* ignore */
    }
    document.dispatchEvent(new CustomEvent('bpb-create-drag', { detail: { drag: getCurrentDrag() } }));
    document.querySelectorAll('.bpb-tooltip-float').forEach((el) => {
      el.classList.remove('is-visible');
      el.setAttribute('aria-hidden', 'true');
    });
  } else {
    document.dispatchEvent(new CustomEvent('bpb-create-drag-end'));
  }
}
