/**
 * Board move / marquee pickup helpers (Inventory.startMultiSelect handoff).
 */

import { canPickItem, isBagItem } from './collision.js';
import { newPlacementKey } from './draft-io.js';
import { gemCarry } from './socket-place.js';

/**
 * @param {{
 *   key: string,
 *   p: object,
 *   itemEl: HTMLElement,
 *   e: PointerEvent,
 *   grid: { el: HTMLElement },
 *   itemsById: Map<string, object>,
 *   onSelectKey: (key: string) => void,
 *   multi: { select: Function, isSelected: Function, size: Function, groupForDrag: Function, clear?: Function },
 *   setMultiMoveKeys: (k: string[] | null) => void,
 *   setDrag: (d: any) => void,
 *   setDownPos: Function,
 *   setLastPointer: Function,
 *   setLastMoveAt: Function,
 *   setMoved: Function,
 *   metrics: { ensure: Function },
 *   ensureLifted: Function,
 *   preview: { previewAt: Function },
 * }} args
 */
export function beginBoardMoveDrag(args) {
  const {
    key,
    p,
    itemEl,
    e,
    grid,
    itemsById,
    onSelectKey,
    multi,
    setMultiMoveKeys,
    setDrag,
    setDownPos,
    setLastPointer,
    setLastMoveAt,
    setMoved,
    metrics,
    ensureLifted,
    preview,
  } = args;

  onSelectKey(key);
  if (!multi.isSelected(key)) multi.select(key, false);
  setMultiMoveKeys(multi.size() > 1 ? multi.groupForDrag(key) : null);

  const liveEl =
    grid.el.querySelector(
      `.bpb-bg__item[data-placement-key="${CSS.escape(key)}"]`,
    ) || itemEl;
  if (!(liveEl instanceof HTMLElement)) return;
  setDrag({
    mode: 'move',
    itemId: p.id,
    moveKey: key,
    homeX: Number(p.x),
    homeY: Number(p.y),
    r: p.r,
    pickupR: p.r,
    pointerId: e.pointerId,
    sourceEl: liveEl,
    sourceRect: liveEl.getBoundingClientRect(),
    pickupDone: false,
    isBag: isBagItem(itemsById.get(p.id)),
  });
  setDownPos({ x: e.clientX, y: e.clientY });
  setLastPointer({ x: e.clientX, y: e.clientY });
  setLastMoveAt(performance.now());
  setMoved(false);
  e.preventDefault();
  try {
    liveEl.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  metrics.ensure(true);
  ensureLifted(e.clientX, e.clientY);
  preview.previewAt(p.id, p.r, e.clientX, e.clientY, key);
}

/**
 * Alt+drag from board — Photoshop-style duplicate: leave original, place a copy.
 * Bags copy empty (contents stay); socket gems are copied onto the new item.
 * @param {{
 *   key: string,
 *   p: object,
 *   itemEl: HTMLElement,
 *   e: PointerEvent,
 *   grid: { el: HTMLElement },
 *   itemsById: Map<string, object>,
 *   onSelectKey: (key: string) => void,
 *   multi: { clear?: Function },
 *   setMultiMoveKeys: (k: string[] | null) => void,
 *   setDrag: (d: any) => void,
 *   setDownPos: Function,
 *   setLastPointer: Function,
 *   setLastMoveAt: Function,
 *   setMoved: Function,
 *   metrics: { ensure: Function },
 *   float: { showOrphanPickup: Function },
 *   preview: { previewAt: Function },
 *   editMode: () => string,
 * }} args
 */
export function beginBoardCopyDrag(args) {
  const {
    key,
    p,
    itemEl,
    e,
    grid,
    itemsById,
    onSelectKey,
    multi,
    setMultiMoveKeys,
    setDrag,
    setDownPos,
    setLastPointer,
    setLastMoveAt,
    setMoved,
    metrics,
    float,
    preview,
    editMode,
  } = args;

  const item = itemsById.get(p.id);
  if (!item || !canPickItem(item, editMode())) return;

  multi.clear?.();
  setMultiMoveKeys(null);
  onSelectKey(key);

  const liveEl =
    grid.el.querySelector(
      `.bpb-bg__item[data-placement-key="${CSS.escape(key)}"]:not(.bpb-bg__item--parked)`,
    ) || itemEl;
  if (!(liveEl instanceof HTMLElement)) return;

  setDrag({
    mode: 'place',
    itemId: p.id,
    placeKey: newPlacementKey(),
    r: p.r || 0,
    pickupR: p.r || 0,
    pointerId: e.pointerId,
    sourceEl: null,
    sourceRect: liveEl.getBoundingClientRect(),
    pickupDone: false,
    isBag: isBagItem(item),
    altCopy: true,
    cargo: [],
    ...gemCarry(p),
  });
  setDownPos({ x: e.clientX, y: e.clientY });
  setLastPointer({ x: e.clientX, y: e.clientY });
  setLastMoveAt(performance.now());
  setMoved(true);
  e.preventDefault();
  try {
    liveEl.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  metrics.ensure(true);
  float.showOrphanPickup(item, p.r || 0, e.clientX, e.clientY);
  // No skipKey — original stays on the board and still occupies cells.
  preview.previewAt(p.id, p.r || 0, e.clientX, e.clientY, null);
}

/**
 * Marquee release → closest = main; free-follow until next click (hotswap-style).
 * @param {{
 *   result: { keys: string[], clientX: number, clientY: number, moved: boolean },
 *   selectionBox: { closestKey: Function } | null,
 *   state: any,
 *   itemsById: Map<string, object>,
 *   editMode: () => string,
 *   grid: { el: HTMLElement },
 *   multi: { clear: Function, setKeys: Function, groupForDrag: Function },
 *   onSelectKey: (key: string) => void,
 *   setMultiMoveKeys: (k: string[] | null) => void,
 *   setDrag: (d: any) => void,
 *   setDownPos: Function,
 *   setLastPointer: Function,
 *   setLastMoveAt: Function,
 *   setMoved: Function,
 *   metrics: { ensure: Function },
 *   ensureLifted: Function,
 *   preview: { previewAt: Function },
 * }} args
 */
export function finishMarqueePickup(args) {
  const {
    result,
    selectionBox,
    state,
    itemsById,
    editMode,
    grid,
    multi,
    onSelectKey,
    setMultiMoveKeys,
    setDrag,
    setDownPos,
    setLastPointer,
    setLastMoveAt,
    setMoved,
    metrics,
    ensureLifted,
    preview,
  } = args;

  const { keys, clientX, clientY, moved } = result;
  // Too-short drag (game: ≤2 frames) — clear brightness, do not pick up
  if (!moved || !keys.length) {
    multi.clear();
    return;
  }
  const mainKey = selectionBox?.closestKey(keys, clientX, clientY) || keys[0];
  if (!mainKey) {
    multi.clear();
    return;
  }
  multi.setKeys(keys);
  const p = state.getDraft().placements.find((x) => x.key === mainKey);
  if (!p) {
    multi.clear();
    return;
  }
  const item = itemsById.get(p.id);
  if (!canPickItem(item, editMode())) {
    multi.clear();
    return;
  }
  const liveEl = grid.el.querySelector(
    `.bpb-bg__item[data-placement-key="${CSS.escape(mainKey)}"]:not(.bpb-bg__item--parked)`,
  );
  if (!(liveEl instanceof HTMLElement)) return;

  onSelectKey(mainKey);
  setMultiMoveKeys(keys.length > 1 ? multi.groupForDrag(mainKey) : null);
  setDrag({
    mode: 'move',
    itemId: p.id,
    moveKey: mainKey,
    r: p.r,
    pickupR: p.r,
    pointerId: -1,
    sourceEl: liveEl,
    sourceRect: liveEl.getBoundingClientRect(),
    pickupDone: false,
    isBag: isBagItem(item),
    hotswap: true,
  });
  setDownPos({ x: clientX, y: clientY });
  setLastPointer({ x: clientX, y: clientY });
  setLastMoveAt(performance.now());
  setMoved(true);
  metrics.ensure(true);
  ensureLifted(clientX, clientY);
  preview.previewAt(p.id, p.r, clientX, clientY, mainKey);
}
