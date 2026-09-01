/**
 * Gem socket helpers during create-board drag.
 */

import { isGemItem } from './collision.js';
import {
  clearSocketHover,
  setShowSockets,
  withGemInSocket,
  withoutGemInSocket,
} from './socket-place.js';

/**
 * @param {{
 *   grid: { el: HTMLElement },
 *   state: any,
 *   itemsById: Map<string, object>,
 *   getEditMode: () => string,
 *   getLastPointer: () => { x: number, y: number } | null,
 *   getDrag: () => any,
 * }} opts
 */
export function createGemDragHelpers(opts) {
  const { grid, state, itemsById, getDrag } = opts;

  /** @type {{ hostKey: string, slot: number, mark?: HTMLElement } | null} */
  let hoveredSocket = null;

  function boardRoot() {
    return grid.el instanceof HTMLElement ? grid.el : null;
  }

  /** @param {boolean} on */
  function setGemSocketsVisible(on) {
    const root = boardRoot();
    if (!root) return;
    if (on) setShowSockets(root, true);
    else {
      setShowSockets(root, false);
      clearSocketHover(root);
      hoveredSocket = null;
    }
  }

  /**
   * Seat gem; previous socket occupant is returned for free-follow pickup.
   * @param {string} gemId
   * @param {{ hostKey: string, slot: number }} socket
   * @param {string | null} [removeKey]
   * @returns {{ ok: boolean, prevGemId: string }}
   */
  function dropGemIntoSocket(gemId, socket, removeKey = null) {
    const placements = state.getDraft().placements;
    const host = placements.find((p) => p.key === socket.hostKey);
    if (!host) return { ok: false, prevGemId: '' };
    const hostItem = itemsById.get(host.id);
    if (!hostItem) return { ok: false, prevGemId: '' };
    const { gems, prevGemId } = withGemInSocket(host, hostItem, socket.slot, gemId);

    /** @type {object[]} */
    let next = placements.map((p) => {
      if (p.key === host.key) return { ...p, gems };
      return p;
    });
    if (removeKey) next = next.filter((p) => p.key !== removeKey);

    state.setPlacements(next);
    return {
      ok: true,
      prevGemId: prevGemId && prevGemId !== gemId ? prevGemId : '',
    };
  }

  /**
   * @param {string} hostKey
   * @param {number} slot
   * @param {string} gemId
   */
  function liftGemFromSocket(hostKey, slot, gemId) {
    const host = state.getDraft().placements.find((p) => p.key === hostKey);
    const hostItem = host ? itemsById.get(host.id) : null;
    if (!host || !hostItem) return;
    const gems = withoutGemInSocket(host, hostItem, slot);
    // borrow: lift while history attached; unlock only on geometry commit
    state.updatePlacement(hostKey, { gems }, { borrow: true });
    const drag = getDrag();
    if (drag) {
      drag.unsocketRestore = { hostKey, slot, gemId };
    }
  }

  function getHoveredSocket() {
    return hoveredSocket;
  }

  /** @param {{ hostKey: string, slot: number, mark?: HTMLElement } | null} s */
  function setHoveredSocket(s) {
    hoveredSocket = s;
  }

  return {
    setGemSocketsVisible,
    dropGemIntoSocket,
    liftGemFromSocket,
    getHoveredSocket,
    setHoveredSocket,
    isGemItem,
  };
}
