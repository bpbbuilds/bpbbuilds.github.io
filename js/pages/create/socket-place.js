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

/** Gem face in 90° steps (Gem.quantizedRotation). */
export function gemFace(n) {
  const f = Math.round(Number(n));
  if (!Number.isFinite(f)) return 0;
  return ((f % 4) + 4) % 4;
}

/**
 * Faces aligned to gem slots. Missing entries are face 0.
 * @param {object | null | undefined} placement
 * @param {number} len
 * @returns {number[]}
 */
export function gemRFor(placement, len) {
  const src = Array.isArray(placement?.gemR) ? placement.gemR : [];
  const out = [];
  for (let i = 0; i < len; i += 1) out.push(gemFace(src[i]));
  return out;
}

/**
 * Copy socket ids and faces onto a new placement or cargo row.
 * @param {object | null | undefined} src
 */
export function gemCarry(src) {
  if (!src || !Array.isArray(src.gems)) return {};
  const gems = src.gems.map((g) => (g == null || g === '' ? '' : String(g)));
  if (!gems.length) return {};
  return { gems, gemR: gemRFor(src, gems.length) };
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
 * Write gem into host socket; returns previous gem id and face (hotswap).
 * @param {object} placement
 * @param {object} hostItem
 * @param {number} slot
 * @param {string} gemId
 * @param {number} [face]
 * @returns {{ gems: string[], gemR: number[], prevGemId: string, prevFace: number }}
 */
export function withGemInSocket(placement, hostItem, slot, gemId, face = 0) {
  const gems = gemsSlotsFor(placement, hostItem);
  const gemR = gemRFor(placement, gems.length);
  if (slot < 0 || slot >= gems.length) {
    return {
      gems: placement.gems ? placement.gems.slice() : [],
      gemR: gemRFor(placement, Array.isArray(placement.gems) ? placement.gems.length : 0),
      prevGemId: '',
      prevFace: 0,
    };
  }
  const prevGemId = gems[slot] || '';
  const prevFace = gemR[slot] || 0;
  gems[slot] = String(gemId);
  gemR[slot] = gemFace(face);
  return { gems, gemR, prevGemId, prevFace };
}

/**
 * Clear a socket slot (unsocket).
 * @param {object} placement
 * @param {object} hostItem
 * @param {number} slot
 * @returns {{ gems: string[], gemR: number[] }}
 */
export function withoutGemInSocket(placement, hostItem, slot) {
  const gems = gemsSlotsFor(placement, hostItem);
  const gemR = gemRFor(placement, gems.length);
  if (slot >= 0 && slot < gems.length) {
    gems[slot] = '';
    gemR[slot] = 0;
  }
  return { gems, gemR };
}

export { isGemItem };
