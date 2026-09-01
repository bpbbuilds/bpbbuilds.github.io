/**
 * Gem → armor/weapon socket hit-test + placement helpers (Gem.gd / GemSocket.gd).
 */

import { isGemItem } from './collision.js';

/** Max distance from socket center (world px) — game Area2D ≈ fixed, not cell-scaled. */
const SOCKET_HIT_PX = 53;

/**
 * @param {object | null | undefined} item
 */
export function hostSocketCount(item) {
  if (!item || isGemItem(item)) return 0;
  return Math.max(
    Math.floor(Number(item.sockets) || 0),
    Array.isArray(item.socketOffsets) ? item.socketOffsets.length : 0,
  );
}

/**
 * @param {object} placement
 * @param {object} hostItem
 * @returns {string[]}
 */
export function gemsSlotsFor(placement, hostItem) {
  const n = hostSocketCount(hostItem);
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const g = placement?.gems?.[i];
    out.push(g ? String(g) : '');
  }
  return out;
}

/**
 * @param {HTMLElement | null | undefined} boardRoot .bpb-bg root
 * @param {boolean} on
 */
export function setShowSockets(boardRoot, on) {
  boardRoot?.classList.toggle('bpb-bg--show-sockets', on);
}

/**
 * Clear socket hover chrome.
 * @param {HTMLElement | null | undefined} boardRoot
 */
export function clearSocketHover(boardRoot) {
  boardRoot
    ?.querySelectorAll('.bpb-bg__mark--socket.is-socket-target')
    .forEach((el) => el.classList.remove('is-socket-target'));
}

/**
 * Closest available socket under the gem cursor (Gem._process).
 * @param {HTMLElement} boardRoot
 * @param {number} clientX
 * @param {number} clientY
 * @param {number} cellPx
 * @returns {{ hostKey: string, slot: number, mark: HTMLElement } | null}
 */
export function findHoveredSocket(boardRoot, clientX, clientY, cellPx) {
  const marks = boardRoot.querySelectorAll(
    '.bpb-bg__item:not(.bpb-bg__item--parked) .bpb-bg__sockets .bpb-bg__mark--socket[data-socket-slot]',
  );
  if (!marks.length) return null;

  const maxDist = SOCKET_HIT_PX;
  const maxDistSq = maxDist * maxDist;
  /** @type {{ hostKey: string, slot: number, mark: HTMLElement } | null} */
  let best = null;
  let bestDist = Infinity;

  for (const mark of marks) {
    if (!(mark instanceof HTMLElement)) continue;
    const itemEl = mark.closest('.bpb-bg__item');
    if (!(itemEl instanceof HTMLElement)) continue;
    const hostKey = itemEl.dataset.placementKey;
    if (!hostKey) continue;
    const slot = Number(mark.dataset.socketSlot);
    if (!Number.isFinite(slot) || slot < 0) continue;

    const rect = mark.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = cx - clientX;
    const dy = cy - clientY;
    const dist = dx * dx + dy * dy;
    if (dist > maxDistSq || dist >= bestDist) continue;
    bestDist = dist;
    best = { hostKey, slot, mark };
  }
  return best;
}

/**
 * Paint hovered socket (GemSocket.onHoverWithGem).
 * @param {HTMLElement | null | undefined} boardRoot
 * @param {{ mark: HTMLElement } | null} hovered
 */
export function paintSocketHover(boardRoot, hovered) {
  clearSocketHover(boardRoot);
  hovered?.mark?.classList.add('is-socket-target');
}

/**
 * Write gem into host socket; returns previous gem id in that slot (hotswap).
 * @param {object} placement
 * @param {object} hostItem
 * @param {number} slot
 * @param {string} gemId
 * @returns {{ gems: string[], prevGemId: string }}
 */
export function withGemInSocket(placement, hostItem, slot, gemId) {
  const gems = gemsSlotsFor(placement, hostItem);
  if (slot < 0 || slot >= gems.length) {
    return { gems: placement.gems ? placement.gems.slice() : [], prevGemId: '' };
  }
  const prevGemId = gems[slot] || '';
  gems[slot] = String(gemId);
  return { gems, prevGemId };
}

/**
 * Clear a socket slot (unsocket).
 * @param {object} placement
 * @param {object} hostItem
 * @param {number} slot
 * @returns {string[]}
 */
export function withoutGemInSocket(placement, hostItem, slot) {
  const gems = gemsSlotsFor(placement, hostItem);
  if (slot >= 0 && slot < gems.length) gems[slot] = '';
  return gems;
}

export { isGemItem };
