/**
 * Pointer / keyboard / wheel handlers for create drag session.
 */

import {
  accessVerdict,
  isHardIllegalAccess,
} from '../../shared/item-access.js';
import { canPickItem, canPlace, isBagItem, isGemItem } from './collision.js';
import { canShiftBoard, shiftDirFromKey, shiftPlacements } from './board-shift.js';
import { pickOffsetPx } from './drag-feel.js';
import { setCreateDragging } from './drag-source.js';
import { beginBoardMoveDrag, beginBoardCopyDrag, finishMarqueePickup } from './drag-marquee.js';
import { newPlacementKey } from './draft-io.js';
import { gemFace } from './socket-place.js';
import { EDIT_MODE } from './editor-state.js';
import { isTypingTarget } from '../../shared/is-typing-target.js';

/**
 * @param {{
 *   host: HTMLElement,
 *   grid: { el: HTMLElement },
 *   state: any,
 *   itemsById: Map<string, object>,
 *   onSelectKey: (key: string) => void,
 *   getDrag: () => any,
 *   setDrag: (d: any) => void,
 *   getFlyingBack: () => boolean,
 *   getMoved: () => boolean,
 *   setMoved: (v: boolean) => void,
 *   getDownPos: () => { x: number, y: number } | null,
 *   setDownPos: (p: { x: number, y: number } | null) => void,
 *   getLastPointer: () => { x: number, y: number } | null,
 *   setLastPointer: (p: { x: number, y: number } | null) => void,
 *   setLastMoveAt: (t: number) => void,
 *   getPickupAt: () => number,
 *   getMultiMoveKeys: () => string[] | null,
 *   setMultiMoveKeys: (k: string[] | null) => void,
 *   multi: {
 *     clear: () => void,
 *     select: (k: string, a?: boolean) => void,
 *     setKeys: (k: string[]) => void,
 *     isSelected: (k: string) => boolean,
 *     size: () => number,
 *     groupForDrag: (k: string) => string[],
 *   },
 *   editMode: () => string,
 *   metrics: { ensure: (force?: boolean) => unknown },
 *   float: { startPickupFrom: Function, rotateDrag: Function, cancelDragWithFlyback: Function, showOrphanPickup: Function },
 *   preview: { previewAt: Function },
 *   gems: { dropGemIntoSocket: Function, getHoveredSocket: Function, liftGemFromSocket: Function },
 *   view: { setPosition: Function },
 *   ensureLifted: (x?: number, y?: number) => void,
 *   endDragHard: () => void,
 *   commitTryAdd: (cur: any, tryAdd: any, x: number, y: number) => string,
 *   commitToPark: (cur: any) => string,
 *   commitToSell: (cur: any) => string,
 *   commitToMeta?: (cur: any, x: number, y: number) => 'done' | 'reject' | 'miss',
 *   isPointerOverPark: (x: number, y: number) => boolean,
 *   isPointerOverCatalog?: (x: number, y: number) => boolean,
 *   isPointerOverSell: (x: number, y: number) => boolean,
 *   isPointerOverMeta?: (x: number, y: number) => boolean,
 *   beginHotswapFromPlacement: (p: object, x: number, y: number) => boolean,
 *   syncPendingPointer: () => void,
 *   scheduleMove: (x: number, y: number) => void,
 *   getWheelReadyAt: () => number,
 *   setWheelReadyAt: (t: number) => void,
 *   getLastRotateAt: () => number,
 *   selectionBox: {
 *     start: (x: number, y: number, pid?: number) => void,
 *     move: (x: number, y: number) => void,
 *     end: (x: number, y: number) => { keys: string[], clientX: number, clientY: number, moved: boolean, pointerId: number } | null,
 *     cancel: () => void,
 *     isActive: () => boolean,
 *     closestKey: (keys: string[], x: number, y: number) => string | null,
 *   } | null,
 * }} ctx
 */
export function bindDragPointers(ctx) {
  const {
    host,
    grid,
    state,
    itemsById,
    onSelectKey,
    getDrag,
    setDrag,
    getFlyingBack,
    getMoved,
    setMoved,
    getDownPos,
    setDownPos,
    getLastPointer,
    setLastPointer,
    setLastMoveAt,
    getPickupAt,
    getMultiMoveKeys,
    setMultiMoveKeys,
    multi,
    editMode,
    metrics,
    float,
    preview,
    gems,
    view,
    ensureLifted,
    endDragHard,
    commitTryAdd,
    commitToPark,
    commitToSell,
    commitToMeta,
    isPointerOverPark,
    isPointerOverCatalog,
    isPointerOverSell,
    isPointerOverMeta,
    beginHotswapFromPlacement,
    syncPendingPointer,
    scheduleMove,
    getWheelReadyAt,
    setWheelReadyAt,
    selectionBox,
  } = ctx;

  /**
   * Seat gem; free-follow any displaced socket gem (game gem.pickup).
   * @param {string} gemId
   * @param {{ hostKey: string, slot: number }} socket
   * @param {string | null} [removeKey]
   * @param {number} clientX
   * @param {number} clientY
   */
  function seatGemAndMaybeHotswap(gemId, socket, removeKey, clientX, clientY) {
    const result = gems.dropGemIntoSocket(gemId, socket, removeKey);
    if (!result?.ok) {
      endDragHard();
      return;
    }
    if (result.prevGemId) {
      endDragHard({ keepDragging: true });
      beginHotswapFromPlacement(
        {
          id: result.prevGemId,
          x: 0,
          y: 0,
          r: result.prevFace || 0,
          key: newPlacementKey(),
          priority: null,
        },
        clientX,
        clientY,
      );
    } else {
      endDragHard();
    }
  }

  /**
   * ~1 frame — game canBeDropped requires frameCounter > pickupFrame.
   * Also used to swallow synthetic primary-up when RMB goes down under LMB capture.
   */
  const SAME_FRAME_MS = 16;

  /**
   * RMB chord state:
   * - Rotate when RMB goes down (pointerdown / mousedown / buttons-bit edge).
   * - Drop on RMB-up only if this was an LMB-held grab (primaryReleased, or
   *   pointerId still armed). Free-follow after hotswap has no LMB — RMB is
   *   rotate-only until the user left-clicks again.
   * - suppressPlaceUntil only on RMB-down (fake primary-up), never on contextmenu.
   *
   * Note: while LMB has setPointerCapture, many browsers never fire pointerdown
   * for button 2 — so we also watch e.buttons on move and raw mousedown.
   */
  let suppressPlaceUntil = 0;
  let rmbRotatedThisPress = false;
  let rmbButtonsHeld = false;
  /**
   * Windows order: pointerdown(rotate) → pointerup (clears rmbRotatedThisPress)
   * → contextmenu. Without this, contextmenu’s last-resort rotate fires a second
   * 90° (looks like “first rotate jumps twice”).
   */
  let skipNextContextRotate = false;

  /** @param {{ armSuppress?: boolean }} [opts] */
  function rotateRmb(opts = {}) {
    if (rmbRotatedThisPress) return;
    if (opts.armSuppress) suppressPlaceUntil = performance.now() + SAME_FRAME_MS;
    rmbRotatedThisPress = true;
    skipNextContextRotate = true;
    float.rotateDrag(1);
  }

  /**
   * After hotswap the float free-follows with pointerId < 0 and no LMB.
   * RMB must not place there — that re-hotswaps and looks like “both rotate.”
   * @param {any} drag
   * @param {PointerEvent | MouseEvent} e
   */
  function rmbReleaseShouldDrop(drag, e) {
    if (!drag) return false;
    // Orphan / hotswap free-follow: rotate only until LMB re-arms the drag
    if (drag.pointerId < 0) return false;
    if (drag.primaryReleased) return true;
    // Chord end: RMB up and LMB also up
    return !(e.buttons & 1);
  }

  /**
   * Edge-detect RMB via buttons mask (works under primary pointer-capture).
   * @param {PointerEvent | MouseEvent} e
   */
  function syncRmbButtons(e) {
    const drag = getDrag();
    if (!drag || getFlyingBack()) {
      rmbButtonsHeld = false;
      return;
    }
    const held = (e.buttons & 2) !== 0;
    if (held && !rmbButtonsHeld) {
      rmbButtonsHeld = true;
      rotateRmb({ armSuppress: true });
    } else if (!held && rmbButtonsHeld) {
      rmbButtonsHeld = false;
      const shouldDrop = rmbReleaseShouldDrop(drag, e);
      rmbRotatedThisPress = false;
      if (shouldDrop) {
        const ev = e;
        queueMicrotask(() => {
          if (getDrag()) finishDrop(ev);
        });
      }
    }
  }

  const NARROW_CREATE_MQ = '(max-width: 1100px)';
  /** @type {{ pointerId: number, onMove: (e: PointerEvent) => void, onEnd: (e: PointerEvent) => void, onTouchMove: (e: TouchEvent) => void } | null} */
  let touchArm = null;

  function clearTouchArm() {
    if (!touchArm) return;
    window.removeEventListener('pointermove', touchArm.onMove);
    window.removeEventListener('pointerup', touchArm.onEnd);
    window.removeEventListener('pointercancel', touchArm.onEnd);
    window.removeEventListener('touchmove', touchArm.onTouchMove);
    touchArm = null;
  }

  /**
   * @param {string} itemId
   * @param {PointerEvent} e
   * @param {HTMLElement | null} src
   */
  function startCatalogDrag(itemId, e, src) {
    const item = itemsById.get(itemId);
    setDrag({
      mode: 'place',
      itemId,
      r: 0,
      pickupR: 0,
      pointerId: e.pointerId,
      sourceEl: src,
      sourceRect: src?.getBoundingClientRect() ?? null,
      pickupDone: false,
      isBag: isBagItem(item),
    });
    setDownPos({ x: e.clientX, y: e.clientY });
    setLastPointer({ x: e.clientX, y: e.clientY });
    setLastMoveAt(performance.now());
    setMoved(true);
    setCreateDragging(true);
    try {
      src?.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    if (src) float.startPickupFrom(src, itemId, 0, e.clientX, e.clientY);
    preview.previewAt(itemId, 0, e.clientX, e.clientY, null);
  }

  /**
   * On a narrow create page, a sideways touch scrolls the catalog.
   * A vertical touch lifts the item onto the board.
   * @param {string} itemId
   * @param {PointerEvent} e
   * @param {HTMLElement | null} src
   */
  function armTouchCatalogDrag(itemId, e, src) {
    clearTouchArm();
    const startX = e.clientX;
    const startY = e.clientY;
    const pointerId = e.pointerId;
    const scrollEl = src?.closest('.bpb-bg');
    let lastX = startX;
    let mode = /** @type {'pending' | 'scroll'} */ ('pending');
    const slop = 12;

    /** @param {PointerEvent} ev */
    function onMove(ev) {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (mode === 'pending' && dx * dx + dy * dy < slop * slop) return;
      // Up toward the board picks the item up, even with some sideways drift.
      if (dy < -10 && Math.abs(dy) > Math.abs(dx) * 0.5) {
        clearTouchArm();
        ev.preventDefault();
        startCatalogDrag(itemId, ev, src);
        return;
      }
      if (Math.abs(dx) > Math.abs(dy)) {
        mode = 'scroll';
        if (scrollEl instanceof HTMLElement) {
          scrollEl.scrollLeft -= ev.clientX - lastX;
        }
        lastX = ev.clientX;
        return;
      }
      clearTouchArm();
      ev.preventDefault();
      startCatalogDrag(itemId, ev, src);
    }

    /** @param {PointerEvent} ev */
    function onEnd(ev) {
      if (ev.pointerId !== pointerId) return;
      clearTouchArm();
    }

    /** @param {TouchEvent} ev */
    function onTouchMove(ev) {
      if (mode !== 'scroll') ev.preventDefault();
    }

    touchArm = { pointerId, onMove, onEnd, onTouchMove };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
  }

  function beginCatalogDrag(itemId, e) {
    // Game InputBlocker while draggedItem — shop/catalog cannot start a pick
    if (dropUnlockPending || getDrag() || getFlyingBack() || !itemsById.has(itemId)) return;
    // A History picker is a read-only preview. Do not let catalog items alter
    // the board until the user selects a saved run or closes the picker.
    if (host.querySelector('.create-board.is-history-open')) return;
    if (document.body.classList.contains('is-bpb-dragging')) return;
    // History lock: allow drag start; unlock only if drop changes board geometry.
    selectionBox?.cancel();
    const item = itemsById.get(itemId);
    if (!canPickItem(item, editMode())) return;
    const hero = String(state.getDraft()?.hero_class || '').trim();
    if (hero && isHardIllegalAccess(accessVerdict(hero, item))) return;
    const t = e.target instanceof Element ? e.target : null;
    const sourceEl = t?.closest?.('.bpb-bg__item[data-item-id]:not(.bpb-bg__item--parked)');
    const src = sourceEl instanceof HTMLElement ? sourceEl : null;
    if (
      e.pointerType === 'touch' &&
      window.matchMedia(NARROW_CREATE_MQ).matches
    ) {
      armTouchCatalogDrag(itemId, e, src);
      return;
    }
    startCatalogDrag(itemId, e, src);
  }

  /**
   * Free-follow re-arm (game: click anywhere while holding draggedItem).
   * Window capture so catalog InputBlocker pass-through still places / flybacks.
   * @param {any} drag
   * @param {PointerEvent} e
   */
  function rearmFreeFollow(drag, e) {
    drag.pointerId = e.pointerId;
    drag.primaryReleased = false;
    setMoved(true);
    setDownPos({ x: e.clientX, y: e.clientY });
    setLastPointer({ x: e.clientX, y: e.clientY });
    e.preventDefault();
    try {
      host.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  /** @param {PointerEvent} e */
  function onWindowFreeFollowDown(e) {
    if (getFlyingBack()) return;
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen' && e.button !== 0) return;
    const drag = getDrag();
    if (!drag || !(drag.hotswap || drag.pointerId < 0)) return;
    // Board host already handles via onPointerDown
    if (e.target instanceof Node && host.contains(e.target)) return;
    // Park strip has its own drop path on pointerup via isPointerOverPark
    rearmFreeFollow(drag, e);
  }

  /** @param {PointerEvent} e */
  function onPointerDown(e) {
    // RMB rotate is window-level (onRmbPointerDown) — host misses it under
    // pointer-capture / when the float is over the catalog.
    if (e.button === 2) return;
    if (getFlyingBack()) return;
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen' && e.button !== 0) return;

    const drag = getDrag();
    // Free-follow (hotswap or same-frame ignored LMB-up): re-arm primary for place
    if (drag && (drag.hotswap || drag.pointerId < 0)) {
      rearmFreeFollow(drag, e);
      return;
    }

    if (dropUnlockPending) return;
    if (drag) return;
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest?.('.create-board__toolbar')) return;
    if (t?.closest?.('.create-history-lock')) return;

    const gemMark = t?.closest?.('.bpb-bg__mark--gem[data-gem-slot]');
    if (gemMark instanceof HTMLElement && grid.el.contains(gemMark)) {
      const hostEl = gemMark.closest('.bpb-bg__item:not(.bpb-bg__item--parked)');
      const hostKey = hostEl instanceof HTMLElement ? hostEl.dataset.placementKey : '';
      const slot = Number(gemMark.dataset.gemSlot);
      const gemId = gemMark.dataset.itemId;
      if (!hostKey || !gemId || !Number.isFinite(slot)) return;
      const gemItem = itemsById.get(gemId);
      if (!canPickItem(gemItem, editMode())) return;
      if (hostEl instanceof HTMLElement) onSelectKey(hostKey);
      const hostRow = state.getDraft().placements.find((p) => p.key === hostKey);
      const face = gemFace(hostRow?.gemR?.[slot]);
    setDrag({
      mode: 'unsocket',
      itemId: gemId,
      hostKey,
      socketSlot: slot,
      r: face,
      pickupR: face,
      pointerId: e.pointerId,
      sourceEl: gemMark,
      sourceRect: gemMark.getBoundingClientRect(),
      pickupDone: false,
      isBag: false,
    });
      setDownPos({ x: e.clientX, y: e.clientY });
      setLastPointer({ x: e.clientX, y: e.clientY });
      setLastMoveAt(performance.now());
      setMoved(false);
      e.preventDefault();
      try {
        gemMark.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      metrics.ensure(true);
      ensureLifted(e.clientX, e.clientY);
      preview.previewAt(gemId, face, e.clientX, e.clientY, null);
      return;
    }

    const itemEl = t?.closest?.('.bpb-bg__item:not(.bpb-bg__item--parked)');
    if (!(itemEl instanceof HTMLElement) || !grid.el.contains(itemEl)) {
      // Empty board — SelectionBox rubber-band (not native text select)
      if (e.shiftKey || e.ctrlKey) return;
      const onStage =
        !!t?.closest?.('[data-board-stage]') ||
        !!t?.closest?.('.create-board__bag') ||
        (t != null && grid.el.contains(/** @type {Node} */ (t)));
      if (onStage && selectionBox) {
        e.preventDefault();
        selectionBox.start(e.clientX, e.clientY, e.pointerId);
        setDownPos({ x: e.clientX, y: e.clientY });
        setLastPointer({ x: e.clientX, y: e.clientY });
        setLastMoveAt(performance.now());
        try {
          host.setPointerCapture?.(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }
      multi.clear();
      return;
    }
    selectionBox?.cancel();
    const key = itemEl.dataset.placementKey;
    if (!key) return;
    let p = state.getDraft().placements.find((x) => x.key === key);
    if (!p) {
      // History scrubber paints rounds without draft keys. Match the cell,
      // then keep a view-only row so a tier drop can still resolve the draft.
      const id = itemEl.getAttribute('data-item-id') || '';
      const x = parseFloat(itemEl.style.left);
      const y = parseFloat(itemEl.style.top);
      if (!id || !Number.isFinite(x) || !Number.isFinite(y)) return;
      const face = Number(itemEl.getAttribute('data-face'));
      const at = state.getDraft().placements.find(
        (row) => row.id === id && Number(row.x) === x && Number(row.y) === y,
      );
      p = at || {
        id,
        x,
        y,
        r: Number.isFinite(face) ? ((face % 4) + 4) % 4 : 0,
        key,
      };
    }
    const item = itemsById.get(p.id);
    if (!canPickItem(item, editMode())) return;

    if (e.shiftKey || e.ctrlKey) {
      multi.select(key, true);
      onSelectKey(key);
      e.preventDefault();
      return;
    }

    beginMoveDrag(key, p, itemEl, e);
  }

  /**
   * @param {string} key
   * @param {object} p
   * @param {HTMLElement} itemEl
   * @param {PointerEvent} e
   */
  function beginMoveDrag(key, p, itemEl, e) {
    if (e.altKey) {
      beginBoardCopyDrag({
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
      });
      return;
    }
    beginBoardMoveDrag({
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
    });
  }

  /**
   * @param {{ keys: string[], clientX: number, clientY: number, moved: boolean, pointerId: number }} result
   */
  function finishMarquee(result) {
    finishMarqueePickup({
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
    });
  }

  /** @param {TouchEvent} e */
  function onTouchMoveWhileDragging(e) {
    if (!getDrag() || getFlyingBack()) return;
    e.preventDefault();
  }

  /** @param {PointerEvent} e */
  function onPointerMove(e) {
    if (selectionBox?.isActive()) {
      selectionBox.move(e.clientX, e.clientY);
      setLastPointer({ x: e.clientX, y: e.clientY });
      return;
    }
    const drag = getDrag();
    if (!drag || getFlyingBack()) return;
    const freeFollow = drag.hotswap || drag.pointerId < 0;
    if (!freeFollow && e.pointerId !== drag.pointerId) return;
    syncRmbButtons(e);
    const down = getDownPos();
    if (down) {
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (dx * dx + dy * dy > 16) setMoved(true);
    }
    if (drag.pickupDone) {
      view.setPosition(e.clientX, e.clientY - pickOffsetPx());
    }
    scheduleMove(e.clientX, e.clientY);
  }

  /** @param {PointerEvent} e */
  function onPointerUp(e) {
    if (selectionBox?.isActive() && (e.button === 0 || e.pointerType === 'touch' || e.pointerType === 'pen')) {
      const result = selectionBox.end(e.clientX, e.clientY);
      if (result) finishMarquee(result);
      return;
    }

    const drag = getDrag();
    if (!drag || getFlyingBack()) return;

    syncRmbButtons(e);

    if (e.button === 2) {
      const shouldDrop = rmbReleaseShouldDrop(drag, e);
      if (shouldDrop) {
        const ev = e;
        queueMicrotask(() => {
          rmbRotatedThisPress = false;
          rmbButtonsHeld = false;
          if (getDrag()) finishDrop(ev);
        });
      } else {
        rmbRotatedThisPress = false;
        rmbButtonsHeld = false;
      }
      return;
    }
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen' && e.button !== 0) return;

    // Synthetic primary-up as RMB goes down
    if (performance.now() < suppressPlaceUntil) {
      drag.primaryReleased = true;
      return;
    }

    // Still holding RMB — wait for RMB-up to drop (pick → rotate → release both)
    if (e.buttons & 2) {
      drag.primaryReleased = true;
      return;
    }

    finishDrop(e);
  }

  /** @type {boolean} */
  let dropUnlockPending = false;

  /**
   * @param {any} cur
   */
  function cloneDrag(cur) {
    if (!cur) return null;
    return {
      ...cur,
      cargo: Array.isArray(cur.cargo) ? cur.cargo.map((c) => ({ ...c })) : cur.cargo,
      gems: Array.isArray(cur.gems) ? cur.gems.slice() : cur.gems,
      gemR: Array.isArray(cur.gemR) ? cur.gemR.slice() : cur.gemR,
      unsocketRestore: cur.unsocketRestore ? { ...cur.unsocketRestore } : null,
      restoreParked: cur.restoreParked ? { ...cur.restoreParked } : null,
      restorePlacement: cur.restorePlacement ? { ...cur.restorePlacement } : null,
    };
  }

  /**
   * After flyback the item is home again — lift it once more before replay.
   * @param {any} snap
   */
  function reliftForReplay(snap) {
    if (snap.mode === 'unsocket' && snap.unsocketRestore) {
      const { hostKey, slot, gemId } = snap.unsocketRestore;
      gems.liftGemFromSocket(hostKey, slot, gemId);
      return;
    }
    if (snap.fromPark && snap.restoreParked) {
      const key = snap.restoreParked.key;
      if (key) state.removeParked?.(key);
      else state.takeParkedById?.(snap.itemId, { borrow: true });
    }
  }

  /**
   * Return the item to the board/socket/park, then ask. Replay only on Edit board.
   * @param {(snap: any, keys: string[] | null) => void} replay
   * @param {any} [cur]
   * @returns {Promise<boolean>}
   */
  async function unlockThenReplay(replay, cur = getDrag()) {
    if (!state.isHistoryLocked?.()) return false;
    if (dropUnlockPending || !cur) return false;
    const snap = cloneDrag(cur);
    const keys = getMultiMoveKeys()?.slice() || null;
    dropUnlockPending = true;
    try {
      await float.cancelDragWithFlyback('cancel');
      const ok = Boolean(await state.requestHistoryUnlock?.());
      if (!ok) return false;
      replay(snap, keys);
      return true;
    } finally {
      dropUnlockPending = false;
      setMultiMoveKeys(null);
    }
  }

  /**
   * @param {any} snap
   * @param {any} tryAdd
   * @param {{ hostKey: string, slot: number } | null} socketHit
   * @param {number} cx
   * @param {number} cy
   */
  function replayBoardDrop(snap, tryAdd, socketHit, cx, cy) {
    const item = itemsById.get(snap.itemId);
    const removeKey = snap.mode === 'move' ? snap.moveKey : null;
    if (socketHit && isGemItem(item)) {
      seatGemAndMaybeHotswap(snap.itemId, socketHit, removeKey, cx, cy);
      return;
    }
    if (tryAdd && !tryAdd.socket && item) {
      const placeCur =
        snap.mode === 'unsocket' ? { ...snap, mode: 'place', moveKey: null } : snap;
      const result = commitTryAdd(placeCur, tryAdd, cx, cy);
      if (result === 'failed' && snap.mode === 'unsocket' && snap.unsocketRestore) {
        const r = snap.unsocketRestore;
        gems.dropGemIntoSocket(r.gemId, { hostKey: r.hostKey, slot: r.slot });
      }
    }
  }

  /**
   * Commit / cancel the current drag from a pointer release.
   * Meta (Needs/Wants/R3/R10) commits without unlock; board/park/sell await unlock.
   * @param {PointerEvent} e
   */
  function finishDrop(e) {
    void finishDropAsync(e);
  }

  /**
   * @param {PointerEvent} e
   */
  async function finishDropAsync(e) {
    const drag = getDrag();
    if (!drag || getFlyingBack() || dropUnlockPending) return;

    // Mouse shares one pointerId across buttons; after RMB rotate / same-frame
    // ignore, free-follow uses pointerId < 0 until LMB re-arms.
    if (drag.pointerId < 0) {
      drag.pointerId = e.pointerId;
      setMoved(true);
    } else if (
      drag.pointerId >= 0 &&
      e.pointerId !== drag.pointerId &&
      e.pointerType !== 'mouse'
    ) {
      return;
    }

    // Rotate-in-place counts as a real edit even if the cursor never moved
    if (
      drag.pickupR != null &&
      ((Number(drag.r) || 0) % 4 + 4) % 4 !==
        ((Number(drag.pickupR) || 0) % 4 + 4) % 4
    ) {
      setMoved(true);
    }

    // Game canBeDropped: same frame as pickup → ignore release, stay dragged
    // (do not cancel). Next LMB re-arms via pointerId < 0 free-follow.
    if (
      getPickupAt() &&
      performance.now() - getPickupAt() < SAME_FRAME_MS &&
      !getMoved()
    ) {
      drag.pointerId = -1;
      drag.primaryReleased = true;
      return;
    }

    syncPendingPointer();
    setLastPointer({ x: e.clientX, y: e.clientY });
    const cur = drag;
    const cx = e.clientX;
    const cy = e.clientY;

    // Build tab: skill slots + essentials tiers (no history unlock)
    if (getMoved() && isPointerOverMeta?.(cx, cy)) {
      const result = commitToMeta?.(cur, cx, cy);
      if (result === 'done') {
        setMultiMoveKeys(null);
        // Catalog place: consume float. Board move: snap item home (still on board).
        if (cur.mode === 'move' || cur.mode === 'unsocket') {
          void float.cancelDragWithFlyback('cancel');
        } else {
          endDragHard();
        }
        return;
      }
      if (result === 'reject') {
        setMultiMoveKeys(null);
        void float.cancelDragWithFlyback('failed');
        return;
      }
    }

    // Sell when the mouse is on the Chestnut (geometry — may unlock)
    if (getMoved() && isPointerOverSell?.(cx, cy)) {
      if (state.isHistoryLocked?.()) {
        await unlockThenReplay((snap, keys) => {
          if (keys?.length) setMultiMoveKeys(keys);
          reliftForReplay(snap);
          commitToSell?.(snap);
        }, cur);
        return;
      }
      const result = commitToSell?.(cur);
      if (result === 'done') {
        setMultiMoveKeys(null);
        return;
      }
    }
    // Catalog column — delete (same as sell), never park
    if (getMoved() && isPointerOverCatalog?.(cx, cy)) {
      if (state.isHistoryLocked?.()) {
        await unlockThenReplay((snap, keys) => {
          if (keys?.length) setMultiMoveKeys(keys);
          reliftForReplay(snap);
          commitToSell?.(snap);
        }, cur);
        return;
      }
      const result = commitToSell?.(cur);
      if (result === 'done') {
        setMultiMoveKeys(null);
        return;
      }
    }
    // Soft park — Storagebox.isHovered (main bag over Park strip only)
    if (getMoved() && isPointerOverPark?.(cx, cy)) {
      if (state.isHistoryLocked?.()) {
        await unlockThenReplay((snap, keys) => {
          // Flyback already restored a park lift — don't park a second copy.
          if (snap.fromPark && snap.mode !== 'unsocket') return;
          if (keys?.length) setMultiMoveKeys(keys);
          reliftForReplay(snap);
          commitToPark?.(snap);
        }, cur);
        return;
      }
      const result = commitToPark?.(cur);
      if (result === 'done') {
        setMultiMoveKeys(null);
        return;
      }
    }

    let tryAdd = preview.previewAt(
      cur.itemId,
      cur.r,
      cx,
      cy,
      cur.mode === 'move' ? cur.moveKey || null : null,
    );
    // Fast rotate+drop can miss a valid snap for one frame — reuse last good
    // board snap for *items* only, and only while the pointer is still on the
    // bag. Off-board (Needs / Wants / the gap) must not replay a stale cell.
    if (!tryAdd) {
      const board = grid.el?.querySelector?.('.bpb-bg__board') || grid.el;
      const box = board instanceof HTMLElement ? board.getBoundingClientRect() : null;
      const onBoard = !!box
        && cx >= box.left && cx <= box.right
        && cy >= box.top && cy <= box.bottom;
      const cached = onBoard ? preview.getLastTryAdd?.() : null;
      if (cached && !cached.socket) {
        const held = itemsById.get(cur.itemId);
        if (held && !isBagItem(held)) tryAdd = cached;
      }
    }
    const item = itemsById.get(cur.itemId);
    const socketHit = gems.getHoveredSocket() && isGemItem(item)
      ? gems.getHoveredSocket()
      : null;

    if (cur.mode === 'place') {
      if (socketHit || (tryAdd && !tryAdd.socket)) {
        if (state.isHistoryLocked?.()) {
          const add = tryAdd
            ? {
                ...tryAdd,
                origin: tryAdd.origin ? { ...tryAdd.origin } : tryAdd.origin,
                collisions: (tryAdd.collisions || []).slice(),
              }
            : null;
          const sock = socketHit
            ? { hostKey: socketHit.hostKey, slot: socketHit.slot }
            : null;
          await unlockThenReplay((snap, keys) => {
            if (keys?.length) setMultiMoveKeys(keys);
            reliftForReplay(snap);
            replayBoardDrop(snap, add, sock, cx, cy);
          }, cur);
          return;
        }
      }
      if (socketHit) {
        seatGemAndMaybeHotswap(cur.itemId, socketHit, null, cx, cy);
      } else if (tryAdd && !tryAdd.socket) {
        const result = commitTryAdd(cur, tryAdd, cx, cy);
        if (result === 'failed') void float.cancelDragWithFlyback('failed');
        else if (result === 'done') endDragHard();
      } else {
        // Catalog / park place OOB — flyback (shop OutsideInventory), not storage
        void float.cancelDragWithFlyback('failed');
      }
      return;
    }

    if (cur.mode === 'unsocket' && cur.hostKey != null && cur.socketSlot != null) {
      if (!getMoved()) {
        void float.cancelDragWithFlyback('cancel');
        return;
      }
      if (socketHit || (tryAdd && !tryAdd.socket)) {
        if (state.isHistoryLocked?.()) {
          const add = tryAdd
            ? {
                ...tryAdd,
                origin: tryAdd.origin ? { ...tryAdd.origin } : tryAdd.origin,
                collisions: (tryAdd.collisions || []).slice(),
              }
            : null;
          const sock = socketHit
            ? { hostKey: socketHit.hostKey, slot: socketHit.slot }
            : null;
          await unlockThenReplay((snap, keys) => {
            if (keys?.length) setMultiMoveKeys(keys);
            reliftForReplay(snap);
            replayBoardDrop(snap, add, sock, cx, cy);
          }, cur);
          return;
        }
      }
      cur.unsocketRestore = null;
      if (socketHit) {
        seatGemAndMaybeHotswap(cur.itemId, socketHit, null, cx, cy);
      } else if (tryAdd && !tryAdd.socket) {
        const result = commitTryAdd(
          { ...cur, mode: 'place', moveKey: null },
          tryAdd,
          cx,
          cy,
        );
        if (result === 'failed') {
          cur.unsocketRestore = {
            hostKey: cur.hostKey,
            slot: cur.socketSlot,
            gemId: cur.itemId,
          };
          void float.cancelDragWithFlyback('failed');
        } else if (result === 'done') endDragHard();
      } else {
        cur.unsocketRestore = {
          hostKey: cur.hostKey,
          slot: cur.socketSlot,
          gemId: cur.itemId,
        };
        void float.cancelDragWithFlyback('failed');
      }
      return;
    }

    if (cur.mode === 'move' && cur.moveKey) {
      const home = state.getDraft().placements.find((p) => p.key === cur.moveKey);
      const origin = tryAdd && !tryAdd.socket ? tryAdd.origin : null;
      const sameHome = Boolean(
        home && origin
        && Math.round(Number(origin.x)) === Math.round(Number(home.x))
        && Math.round(Number(origin.y)) === Math.round(Number(home.y))
        && ((Number(cur.r) || 0) % 4 + 4) % 4 === ((Number(home.r) || 0) % 4 + 4) % 4,
      );
      // Putting it back does not edit the run. Tier drops already returned above.
      if (
        state.isHistoryLocked?.()
        && getMoved()
        && sameHome
        && !(socketHit && isGemItem(item))
      ) {
        void float.cancelDragWithFlyback('cancel');
        return;
      }
      const geometryDrop =
        getMoved() &&
        ((socketHit && isGemItem(item)) || (tryAdd && !tryAdd.socket && item));
      if (geometryDrop && state.isHistoryLocked?.()) {
        const add = tryAdd
          ? {
              ...tryAdd,
              origin: tryAdd.origin ? { ...tryAdd.origin } : tryAdd.origin,
              collisions: (tryAdd.collisions || []).slice(),
            }
          : null;
        const sock = socketHit
          ? { hostKey: socketHit.hostKey, slot: socketHit.slot }
          : null;
        await unlockThenReplay((snap, keys) => {
          if (keys?.length) setMultiMoveKeys(keys);
          reliftForReplay(snap);
          replayBoardDrop(snap, add, sock, cx, cy);
        }, cur);
        return;
      }
      if (getMoved() && socketHit && isGemItem(item)) {
        seatGemAndMaybeHotswap(cur.itemId, socketHit, cur.moveKey, cx, cy);
      } else if (getMoved() && tryAdd && !tryAdd.socket && item) {
        const result = commitTryAdd(cur, tryAdd, cx, cy);
        if (result === 'failed') {
          // Only park when home cells are no longer free (game PotentialSpace check)
          if (await resolveFailedBagDrop(cur, item)) {
            setMultiMoveKeys(null);
            return;
          }
          void float.cancelDragWithFlyback('failed');
        } else if (result === 'done') endDragHard();
      } else if (getMoved() && !tryAdd && !socketHit) {
        // Main held bag OOB / invalid — flyback unless it cannot return home.
        // (Storage hover = park strip, already handled above.)
        if (await resolveFailedBagDrop(cur, item)) {
          setMultiMoveKeys(null);
          return;
        }
        void float.cancelDragWithFlyback('failed');
      } else {
        endDragHard();
      }
      setMultiMoveKeys(null);
      return;
    }
    endDragHard();
  }

  /** @param {PointerEvent} e */
  function onPointerCancel(e) {
    if (selectionBox?.isActive()) {
      selectionBox.cancel();
      multi.clear();
      return;
    }
    if (getDrag() && (e.buttons & 1)) return;
    void float.cancelDragWithFlyback('cancel');
  }

  function onKey(e) {
    if (isTypingTarget(e.target)) return;

    if (selectionBox?.isActive() && e.key === 'Escape') {
      e.preventDefault();
      selectionBox.cancel();
      multi.clear();
      return;
    }

    const drag = getDrag();
    const dir = shiftDirFromKey(e);
    if (dir) {
      if (canShiftBoard(editMode(), dir, state.getDraft().placements, itemsById)) {
        e.preventDefault();
        state.setPlacements(
          shiftPlacements(dir, state.getDraft().placements, itemsById, editMode()),
        );
        const lp = getLastPointer();
        if (drag && lp) {
          preview.previewAt(
            drag.itemId,
            drag.r,
            lp.x,
            lp.y,
            drag.mode === 'move' ? drag.moveKey || null : null,
          );
        }
      }
      return;
    }

    if (!drag) {
      if (e.key === 'Escape') multi.clear();
      return;
    }
    // Leave Ctrl/Cmd(+Shift)+R to the browser (hard refresh, etc.)
    if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return; // game just_pressed — no hold auto-spin
      float.rotateDrag(1);
      return;
    }
    if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      float.rotateDrag(-1);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      void float.cancelDragWithFlyback('cancel');
    }
  }

  function onWheel(e) {
    if (!getDrag() || getFlyingBack()) return;
    e.preventDefault();
    const now = performance.now();
    // Item.mouseWheelRotationReadyTime — 0.1s between wheel steps
    if (now < getWheelReadyAt()) return;
    setWheelReadyAt(now + 100);
    float.rotateDrag(e.deltaY > 0 ? 1 : -1);
  }

  /** Capture phase — often missing while LMB has pointer capture. */
  function onRmbPointerDown(e) {
    if (e.button !== 2) return;
    if (!getDrag() || getFlyingBack()) return;
    e.preventDefault();
    rmbButtonsHeld = true;
    rotateRmb({ armSuppress: true });
  }

  /** Raw mouse fallback — fires for button 2 even under primary capture on Windows. */
  function onRmbMouseDown(e) {
    if (e.button !== 2) return;
    if (!getDrag() || getFlyingBack()) return;
    // Block native menu as early as possible (some browsers key off mousedown)
    e.preventDefault();
    rmbButtonsHeld = true;
    rotateRmb({ armSuppress: true });
  }

  function onContextMenu(e) {
    const dragging =
      !!getDrag() ||
      getFlyingBack() ||
      rmbButtonsHeld ||
      rmbRotatedThisPress ||
      skipNextContextRotate ||
      document.body.classList.contains('is-bpb-dragging') ||
      performance.now() < suppressPlaceUntil + 200;
    const onBoard = host.contains(/** @type {Node} */ (e.target));
    if (!dragging && !onBoard) return;
    e.preventDefault();
    e.stopPropagation();
    // Down-path already rotated this click — do not rotate again after pointerup.
    if (skipNextContextRotate) {
      skipNextContextRotate = false;
      return;
    }
    // Last-resort rotate if down events were swallowed; never arm suppress.
    if (getDrag() && !getFlyingBack()) rotateRmb({ armSuppress: false });
  }

  function onSelectStart(e) {
    if (
      getDrag() ||
      getFlyingBack() ||
      selectionBox?.isActive() ||
      document.body.classList.contains('is-bpb-dragging') ||
      document.body.classList.contains('is-bpb-selecting') ||
      host.contains(/** @type {Node} */ (e.target))
    ) {
      e.preventDefault();
    }
  }

  host.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerdown', onWindowFreeFollowDown, true);
  window.addEventListener('pointerdown', onRmbPointerDown, true);
  window.addEventListener('mousedown', onRmbMouseDown, true);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('touchmove', onTouchMoveWhileDragging, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('contextmenu', onContextMenu, true);
  window.addEventListener('selectstart', onSelectStart, true);

  /**
   * Item.drop after failed tryAdd: bag → storage only when pickup cells are no
   * longer PotentialSpace (cannot move back). Otherwise flyback.
   * Multi: only the held main is tested for tryAdd; followers ride as cargo.
   * @param {any} cur
   * @param {object | null | undefined} item
   */
  function bagShouldParkInsteadOfFlyback(cur, item) {
    if (!isBagItem(item) || cur?.mode !== 'move' || !cur.moveKey) return false;
    const placements = state.getDraft().placements;
    const home = placements.find((p) => p.key === cur.moveKey);
    if (!home) return true;
    /** @type {Set<string>} */
    const skip = new Set([cur.moveKey]);
    const multiKeys = typeof getMultiMoveKeys === 'function'
      ? getMultiMoveKeys()
      : null;
    if (multiKeys) for (const k of multiKeys) if (k) skip.add(k);
    for (const c of Array.isArray(cur.cargo) ? cur.cargo : []) {
      if (c?.key) skip.add(c.key);
    }
    const face = ((Number(cur.pickupR ?? cur.r) || 0) % 4 + 4) % 4;
    // Mirror Inventory.allCellsPotentialSpace(occupiedCells) after remove:
    // home footprint must still be free of other bags.
    return !canPlace(
      item,
      { x: home.x, y: home.y, r: face },
      placements,
      itemsById,
      skip,
      editMode() === EDIT_MODE.ITEM_LAYER
        ? EDIT_MODE.DEFAULT
        : editMode(),
    );
  }

  /**
   * Failed board drop for a held bag: park (game storage) only when it cannot
   * return home; otherwise flyback. Park strip hover is handled earlier.
   * @param {any} cur
   * @param {object | null | undefined} item
   */
  /**
   * @param {any} cur
   * @param {object} item
   * @returns {Promise<boolean>}
   */
  async function resolveFailedBagDrop(cur, item) {
    if (!bagShouldParkInsteadOfFlyback(cur, item)) return false;
    if (state.isHistoryLocked?.()) {
      return unlockThenReplay((snap, keys) => {
        if (keys?.length) setMultiMoveKeys(keys);
        reliftForReplay(snap);
        commitToPark?.(snap);
      }, cur);
    }
    if (!getDrag()) return false;
    return commitToPark?.(cur) === 'done';
  }

  return {
    beginCatalogDrag,
    destroy() {
      clearTouchArm();
      host.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerdown', onWindowFreeFollowDown, true);
      window.removeEventListener('pointerdown', onRmbPointerDown, true);
      window.removeEventListener('mousedown', onRmbMouseDown, true);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('touchmove', onTouchMoveWhileDragging);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('selectstart', onSelectStart, true);
    },
  };
}
