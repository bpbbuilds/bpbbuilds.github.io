/**
 * Create-board drag session — wires float + preview + commit + pointers.
 */

import { canPickItem, isBagItem } from './collision.js';
import { captureBagCargo } from './bag-cargo.js';
import { commitTryAdd as commitTryAddCore } from './drag-commit.js';
import {
  canParkDrag,
  commitDragToPark,
  pointerOverPark,
  mainOverStorage,
  mainOverCatalog,
  pointerOverCatalog,
} from './park-strip.js';
import { commitDragToSell, pointerOverSell } from './sell-bin.js';
import { pickOffsetPx } from './drag-feel.js';
import { createInventoryPreview } from './inventory-preview.js';
import { createMultiSelect } from './multi-select.js';
import { createSelectionBox } from './selection-box.js';
import { EDIT_MODE } from './editor-state.js';
import { newPlacementKey } from './draft-io.js';
import { gemCarry } from './socket-place.js';
import { createDragAffectPreview } from './drag-affect.js';
import { createDragCursorView } from './drag-cursor.js';
import { markDragSource, hideGroupSources, registerDragLookup } from './drag-source.js';
import { createDragMetrics } from './drag-metrics.js';
import { createGemDragHelpers } from './drag-gems.js';
import { createCursorDom, createFloatController } from './drag-float.js';
import { createPreviewController } from './drag-preview.js';
import { bindDragPointers } from './drag-pointers.js';
import {
  ROTATE_MS,
  animateSpinRotate,
  shortestAngleDeltaDeg,
} from '../../shared/backpack-grid/face-spin.js';

/** @deprecated use attachDragSession */
export function attachShopDrag(opts) {
  return attachDragSession(opts);
}

/** Pointer drag onto the create board (Inventory + Item). */
export function attachDragSession(opts) {
  const {
    host,
    grid,
    ghostEl,
    stageEl,
    parkEl = null,
    sellEl = null,
    state,
    itemsById,
    getSpriteUrl,
    cellPx,
    onSelectKey,
    onFaceContinue,
  } = opts;

  /** @type {ReturnType<import('./meta-pane.js').mountMetaPane> | null} */
  let metaDrop = opts.metaDrop ?? null;

  const { cursorEl, slotsEl, cargoEl, gemsEl, cursorShadow, cursorImg } = createCursorDom();

  /** @type {any} */
  let drag = null;
  registerDragLookup(() => drag);
  /** @type {string[] | null} */
  let multiMoveKeys = null;
  let downPos = /** @type {{ x: number, y: number } | null} */ (null);
  let moved = false;
  let lastPointer = /** @type {{ x: number, y: number } | null} */ (null);
  let lastMoveAt = 0;
  let flyingBack = false;
  let moveRaf = 0;
  /** @type {{ x: number, y: number, t: number } | null} */
  let pendingMove = null;
  let wheelRotateReadyAt = 0;
  let lastRotateAt = 0;
  let lastPlaceOk = false;
  let pickupAt = 0;

  function editMode() {
    return state.getEditMode?.() ?? EDIT_MODE.DEFAULT;
  }

  const metrics = createDragMetrics({
    grid,
    stageEl: stageEl instanceof HTMLElement ? stageEl : null,
    cellPx,
    isActive: () => !!drag,
  });

  const view = createDragCursorView(
    cursorEl,
    slotsEl,
    cursorImg,
    cargoEl,
    () => metrics.currentCellPx(),
    cursorShadow,
    gemsEl,
  );
  const affect = stageEl
    ? createDragAffectPreview(stageEl, () => metrics.boardEl())
    : null;
  const invPreview = stageEl instanceof HTMLElement
    ? createInventoryPreview(stageEl, () => metrics.boardEl())
    : null;

  const gems = createGemDragHelpers({
    grid,
    state,
    itemsById,
    getEditMode: editMode,
    getLastPointer: () => lastPointer,
    getDrag: () => drag,
  });

  const multi = createMultiSelect({
    getPlacements: () => state.getDraft().placements,
    canPick: (p) => canPickItem(itemsById.get(p.id), editMode()),
    itemsById,
    getEditMode: editMode,
    onChange() {
      multi.paint(grid.el);
    },
  });

  const selectionBox =
    stageEl instanceof HTMLElement
      ? createSelectionBox({
          stageEl,
          grid,
          itemsById,
          getEditMode: editMode,
          onHitsChange(keys) {
            multi.setKeys(keys);
          },
        })
      : null;

  /** @type {ReturnType<typeof createPreviewController>} */
  let preview;

  function hidePreview() {
    preview?.hidePreview();
  }

  function endDragHard(opts = {}) {
    if (moveRaf) {
      cancelAnimationFrame(moveRaf);
      moveRaf = 0;
    }
    pendingMove = null;
    hidePreview();
    if (parkEl instanceof HTMLElement) {
      parkEl.classList.remove('is-drop-hover', 'is-drop-valid', 'is-drop-reject');
    }
    if (sellEl instanceof HTMLElement) {
      sellEl.classList.remove('is-drop-hover');
    }
    view.setSellHover?.(false);
    metaDrop?.clearDropHover?.();
    gems.setGemSocketsVisible(false);
    view.cancelFaceTween();
    float.resetCursorChrome({ keepDragging: !!opts.keepDragging });
    drag = null;
    multiMoveKeys = null;
    downPos = null;
    moved = false;
    lastPointer = null;
    flyingBack = false;
    pickupAt = 0;
    if (!opts.keepDragging) multi.clear();
  }

  function hideMultiGroupSources() {
    if (!multiMoveKeys || multiMoveKeys.length < 2) return;
    hideGroupSources(grid.el, multiMoveKeys);
  }

  const float = createFloatController({
    host,
    grid,
    stageEl: stageEl instanceof HTMLElement ? stageEl : null,
    state,
    itemsById,
    getSpriteUrl,
    cursorEl,
    slotsEl,
    cargoEl,
    cursorImg,
    cursorShadow,
    view,
    getDrag: () => drag,
    setDrag: (d) => { drag = d; },
    getEditMode: editMode,
    getLastPointer: () => lastPointer,
    getDownPos: () => downPos,
    setPickupAt: (t) => { pickupAt = t; },
    getPickupAt: () => pickupAt,
    setFlyingBack: (v) => { flyingBack = v; },
    getFlyingBack: () => flyingBack,
    setLastPlaceOk: (v) => { lastPlaceOk = v; },
    getLastPlaceOk: () => lastPlaceOk,
    getLastRotateAt: () => lastRotateAt,
    setLastRotateAt: (t) => { lastRotateAt = t; },
    setMoved: (v) => { moved = v; },
    clearMetrics: () => metrics.clear(),
    setGemSocketsVisible: gems.setGemSocketsVisible,
    hidePreview,
    onAfterRotate() {
      const pt = lastPointer || downPos;
      if (!pt || !drag) return;
      pendingMove = { x: pt.x, y: pt.y, t: performance.now() };
      if (!moveRaf) moveRaf = requestAnimationFrame(flushPendingMove);
    },
    endDragHard,
    getMultiMoveKeys: () => multiMoveKeys,
  });

  preview = createPreviewController({
    grid,
    stageEl: stageEl instanceof HTMLElement ? stageEl : null,
    ghostEl: ghostEl instanceof HTMLElement ? ghostEl : null,
    state,
    itemsById,
    metrics,
    affect,
    invPreview,
    getEditMode: editMode,
    updateDragCursor: float.updateDragCursor,
    setGemSocketsVisible: gems.setGemSocketsVisible,
    getHoveredSocket: gems.getHoveredSocket,
    setHoveredSocket: gems.setHoveredSocket,
    setLastPlaceOk: (v) => { lastPlaceOk = v; },
    getHeldSkipKeys() {
      /** @type {string[]} */
      const keys = [];
      if (drag?.moveKey) keys.push(drag.moveKey);
      if (multiMoveKeys?.length) {
        for (const k of multiMoveKeys) if (k) keys.push(k);
      }
      if (drag?.cargo?.length) {
        for (const c of drag.cargo) if (c?.key) keys.push(c.key);
      }
      return keys;
    },
    getCanSnap() {
      // Item.canSnap — empty draggedInsideItems only
      if (drag?.cargo?.length) return false;
      if (multiMoveKeys && multiMoveKeys.length > 1) return false;
      return true;
    },
  });

  function resolveSourceEl() {
    if (!drag) return null;
    // Orphan hotswap (place) has no board source; marquee free-follow is move + hotswap
    if (drag.hotswap && drag.mode !== 'move') return null;
    if (drag.mode === 'move' && drag.moveKey) {
      const live = grid.el.querySelector(
        `.bpb-bg__item[data-placement-key="${CSS.escape(drag.moveKey)}"]:not(.bpb-bg__item--parked)`,
      );
      if (live instanceof HTMLElement) return live;
    }
    if (
      drag.sourceEl instanceof HTMLElement &&
      drag.sourceEl.isConnected &&
      !drag.sourceEl.classList.contains('bpb-bg__item--parked')
    ) {
      return drag.sourceEl;
    }
    return null;
  }

  function hideArmedSource() {
    const el = resolveSourceEl();
    if (!el || !drag) return;
    drag.sourceEl = el;
    drag.sourceRect = el.getBoundingClientRect();
    markDragSource(el);
  }

  function ensureLifted(clientX, clientY) {
    if (!drag || flyingBack || drag.pickupDone) return;
    if (drag.mode !== 'move' && drag.mode !== 'unsocket') return;
    const sourceEl = resolveSourceEl();
    if (!sourceEl) return;
    const x = clientX ?? lastPointer?.x ?? downPos?.x ?? 0;
    const y = clientY ?? lastPointer?.y ?? downPos?.y ?? 0;
    float.startPickupFrom(sourceEl, drag.itemId, drag.r, x, y);
    hideMultiGroupSources();
    if (
      drag.mode === 'unsocket' &&
      drag.hostKey != null &&
      drag.socketSlot != null
    ) {
      gems.liftGemFromSocket(drag.hostKey, drag.socketSlot, drag.itemId);
    }
  }

  function flushPendingMove() {
    moveRaf = 0;
    const p = pendingMove;
    pendingMove = null;
    if (!p || !drag || flyingBack) return;
    const now = p.t;
    const dt = Math.min(0.05, Math.max(0.008, (now - lastMoveAt) / 1000));
    lastMoveAt = now;
    ensureLifted(p.x, p.y);
    // Storagebox.isHovered — main bag position, not pointer
    const overStorage = mainOverStorage(cursorEl, parkEl);
    // Catalog column — delete (sell), not park
    const overCatalog = mainOverCatalog(cursorEl);
    // Sellbox.isHovered — mouse in sell rect
    const overSell = pointerOverSell(sellEl, p.x, p.y);
    const overMeta = !!metaDrop?.engagesMeta?.(p.x, p.y, heldItemRect());
    // Park: unique-id cap (27); stacking an existing id still allowed when “full”
    const capacityOk = canParkDrag({
      cur: drag,
      state,
      itemsById,
      multiMoveKeys,
    });
    const parkValid = !overSell && !overMeta && !overCatalog && capacityOk;
    if (parkEl instanceof HTMLElement) {
      parkEl.classList.toggle('is-drop-valid', parkValid);
      parkEl.classList.toggle(
        'is-drop-hover',
        overStorage && parkValid,
      );
      parkEl.classList.toggle(
        'is-drop-reject',
        overStorage && !overSell && !overMeta && !capacityOk,
      );
    }
    if (sellEl instanceof HTMLElement) {
      sellEl.classList.toggle('is-drop-hover', overSell);
    }
    view.setSellHover?.(overSell);
    metaDrop?.updateDropHover?.(drag, p.x, p.y, heldItemRect());
    if (overStorage || overSell || overMeta || overCatalog) {
      preview.hidePreview?.();
    } else {
      preview.previewAt(
        drag.itemId,
        drag.r,
        p.x,
        p.y,
        drag.mode === 'move' ? drag.moveKey || null : null,
        dt,
      );
    }
    lastPointer = { x: p.x, y: p.y };
  }

  function syncPendingPointer() {
    if (moveRaf) {
      cancelAnimationFrame(moveRaf);
      moveRaf = 0;
    }
    if (pendingMove) flushPendingMove();
  }

  function beginHotswapFromPlacement(placement, clientX, clientY, opts = {}) {
    const item = itemsById.get(placement.id);
    if (!item || !canPickItem(item, editMode())) return false;
    // Stay in drag mode so board :hover stars never flash mid-swap
    endDragHard({ keepDragging: true });
    onFaceContinue?.(null);
    view.cancelFaceTween();
    snapBoardSpinsToDataFace();
    forgetParkedPlacementKey(placement.key);

    // When commit passes `cargo` (even []), trust it — do not re-scan the board.
    // After bag-on-bag, A's re-added insides can sit on B's old footprint; a
    // re-capture would steal them onto the free-followed bag (half-leather bug).
    /** @type {ReturnType<typeof captureBagCargo>} */
    let cargo;
    if ('cargo' in opts) {
      cargo = Array.isArray(opts.cargo) ? opts.cargo.slice() : [];
    } else if (isBagItem(item) && editMode() === EDIT_MODE.DEFAULT) {
      cargo = captureBagCargo(
        item,
        placement,
        state.getDraft().placements,
        itemsById,
      );
    } else {
      cargo = [];
    }
    if (cargo.length) {
      const cargoKeys = new Set(cargo.map((c) => c.key).filter(Boolean));
      state.setPlacements(
        state.getDraft().placements.filter((p) => !cargoKeys.has(p.key)),
      );
    }

    const restoreKey = placement.key || newPlacementKey();
    drag = {
      mode: 'place',
      itemId: placement.id,
      r: placement.r || 0,
      pickupR: placement.r || 0,
      pointerId: -1,
      sourceEl: null,
      sourceRect: {
        left: clientX - 24,
        top: clientY - 24,
        width: 48,
        height: 48,
        right: clientX + 24,
        bottom: clientY + 24,
        x: clientX - 24,
        y: clientY - 24,
        toJSON() {},
      },
      pickupDone: false,
      isBag: isBagItem(item),
      hotswap: true,
      cargo,
      ...gemCarry(placement),
      restorePlacement: {
        id: placement.id,
        x: Number(placement.x) || 0,
        y: Number(placement.y) || 0,
        r: placement.r || 0,
        key: restoreKey,
        priority: placement.priority ?? null,
        ...gemCarry(placement),
      },
    };
    downPos = { x: clientX, y: clientY };
    lastPointer = { x: clientX, y: clientY };
    lastMoveAt = performance.now();
    moved = true;
    float.showOrphanPickup(item, drag.r, clientX, clientY);
    view.setFaceInstant(drag.r);
    preview.previewAt(placement.id, drag.r, clientX, clientY, null);
    return true;
  }

  /**
   * Lift one stacked parked item (by catalog id) onto the cursor.
   * @param {string} itemId
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} pointerId
   * @param {HTMLElement | null} sourceEl
   */
  function beginParkDrag(itemId, clientX, clientY, pointerId, sourceEl) {
    if (drag || flyingBack) return false;
    if (host.closest('.create-board')?.classList.contains('is-history-lock-open')) {
      return false;
    }
    // History lock: borrow from park for the drag; unlock only on geometry drop.
    const entry = state.takeParkedById?.(itemId, { borrow: true });
    if (!entry) return false;
    const item = itemsById.get(entry.id);
    if (!item || !canPickItem(item, editMode())) {
      state.appendParked?.([entry], { borrow: true });
      return false;
    }

    onFaceContinue?.(null);
    view.cancelFaceTween();
    snapBoardSpinsToDataFace();

    const placeKey = entry.key || newPlacementKey();
    drag = {
      mode: 'place',
      itemId: entry.id,
      r: entry.r || 0,
      pickupR: entry.r || 0,
      pointerId,
      sourceEl: null,
      sourceRect: sourceEl?.getBoundingClientRect?.()
        ? sourceEl.getBoundingClientRect()
        : {
          left: clientX - 24,
          top: clientY - 24,
          width: 48,
          height: 48,
          right: clientX + 24,
          bottom: clientY + 24,
          x: clientX - 24,
          y: clientY - 24,
          toJSON() {},
        },
      pickupDone: false,
      isBag: isBagItem(item),
      hotswap: false,
      fromPark: true,
      placeKey,
      cargo: [],
      ...gemCarry(entry),
      restoreParked: {
        id: entry.id,
        r: entry.r || 0,
        key: placeKey,
        priority: entry.priority ?? null,
        ...gemCarry(entry),
      },
    };
    downPos = { x: clientX, y: clientY };
    lastPointer = { x: clientX, y: clientY };
    lastMoveAt = performance.now();
    moved = true;
    float.showOrphanPickup(item, drag.r, clientX, clientY);
    view.setFaceInstant(drag.r);
    preview.previewAt(entry.id, drag.r, clientX, clientY, null);
    try {
      host.setPointerCapture?.(pointerId);
    } catch {
      /* ignore */
    }
    return true;
  }

  /** Dropped item’s parked pool node must not keep the old placement key. */
  function forgetParkedPlacementKey(key) {
    if (!key) return;
    const root = grid.el;
    if (!(root instanceof HTMLElement)) return;
    root
      .querySelectorAll(
        `.bpb-bg__item[data-placement-key="${CSS.escape(key)}"]`,
      )
      .forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        delete el.dataset.placementKey;
        el.classList.remove('is-drag-source');
      });
  }

  /**
   * Finish any in-flight board face tweens (Item.Util.finishTween) so a hotswap
   * handoff doesn't leave the boarded sprite spinning under the new hold.
   */
  function snapBoardSpinsToDataFace() {
    const root = grid.el;
    if (!(root instanceof HTMLElement)) return;
    for (const itemEl of root.querySelectorAll('.bpb-bg__item')) {
      if (!(itemEl instanceof HTMLElement)) continue;
      const face = ((Number(itemEl.getAttribute('data-face')) || 0) % 4 + 4) % 4;
      const target = face * 90;
      for (const spin of itemEl.querySelectorAll('.bpb-bg__spin')) {
        if (spin instanceof HTMLElement) {
          animateSpinRotate(spin, target, { animate: false });
        }
      }
    }
  }

  function commitTryAdd(cur, tryAdd, clientX, clientY) {
    // Mid-rotate handoff only for a clean place — collision hotswap must snap
    // so the boarded sprite doesn't keep spinning under the new hold.
    const collisions = tryAdd?.collisions || [];
    if (collisions.length === 0) armFaceContinue(cur);
    else onFaceContinue?.(null);

    const keys = multiMoveKeys;
    const result = commitTryAddCore({
      cur,
      tryAdd,
      clientX,
      clientY,
      state,
      itemsById,
      editMode: editMode(),
      multiMoveKeys: keys,
      endDragHard,
      beginHotswapFromPlacement,
    });
    multiMoveKeys = null;
    if (result === 'failed' || result === 'hotswap') onFaceContinue?.(null);
    return result;
  }

  function commitToPark(cur) {
    onFaceContinue?.(null);
    return commitDragToPark({
      cur,
      state,
      itemsById,
      multiMoveKeys,
      endDragHard,
    });
  }

  function commitToSell(cur) {
    onFaceContinue?.(null);
    return commitDragToSell({
      cur,
      state,
      itemsById,
      multiMoveKeys,
      endDragHard,
    });
  }

  function isPointerOverPark(clientX, clientY) {
    // Sellbox overlaps catalog — never park over sell.
    if (pointerOverSell(sellEl, clientX, clientY)) return false;
    // Catalog deletes; do not treat it as storage.
    if (mainOverCatalog(cursorEl) || pointerOverCatalog(clientX, clientY)) {
      return false;
    }
    // Build meta panel wins over park (zones + gaps between them).
    if (metaDrop?.engagesMeta?.(clientX, clientY, heldItemRect())) return false;
    if (metaDrop?.getDropTarget?.(clientX, clientY, heldItemRect())) return false;
    // Prefer main-bag storage hover (game); fall back to pointer for pre-lift.
    if (mainOverStorage(cursorEl, parkEl)) return true;
    return pointerOverPark(parkEl, clientX, clientY);
  }

  /** Catalog column drop → delete (same commit as sell chest). */
  function isPointerOverCatalog(clientX, clientY) {
    if (pointerOverSell(sellEl, clientX, clientY)) return false;
    if (metaDrop?.engagesMeta?.(clientX, clientY, heldItemRect())) return false;
    if (metaDrop?.getDropTarget?.(clientX, clientY, heldItemRect())) return false;
    if (mainOverCatalog(cursorEl)) return true;
    // The held item is lifted above a coarse pointer. The finger stays in the
    // catalog strip while that item is already over the board.
    if (pickOffsetPx() > 0) return false;
    return pointerOverCatalog(clientX, clientY);
  }

  function isPointerOverSell(clientX, clientY) {
    return pointerOverSell(sellEl, clientX, clientY);
  }

  function heldItemRect() {
    if (!(cursorImg instanceof HTMLElement) || cursorEl.hidden) return null;
    const r = cursorImg.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return null;
    return r;
  }

  /**
   * @param {any} cur
   * @param {number} clientX
   * @param {number} clientY
   * @returns {'done' | 'reject' | 'miss'}
   */
  function commitToMeta(cur, clientX, clientY) {
    if (!metaDrop?.tryCommitDrop) return 'miss';
    onFaceContinue?.(null);
    return metaDrop.tryCommitDrop(cur, clientX, clientY, heldItemRect());
  }

  /**
   * Before place: if the float is mid-spin, hand the angle off to the board item
   * so placement snaps while the rotate ease finishes (Item keeps rotationTween).
   * @param {any} cur
   */
  function armFaceContinue(cur) {
    if (!onFaceContinue || !cur) return;
    const fromDeg = view.getVisualFaceDeg();
    const targetDeg = (((Number(cur.r) || 0) % 4) + 4) % 4 * 90;
    const delta = Math.abs(shortestAngleDeltaDeg(fromDeg, targetDeg));
    if (delta < 1) return;
    let durationMs = view.getFaceTweenRemainingMs?.() || 0;
    if (durationMs < 1) {
      // Tween finished or cancelled mid-angle — finish the remaining arc quickly
      durationMs = Math.max(40, Math.round(ROTATE_MS * (delta / 90)));
    }
    let key = cur.mode === 'move' && cur.moveKey ? cur.moveKey : cur.placeKey;
    if (!key) {
      // Stable key so syncBoard can find the new placement (incl. hotswap paths)
      key = newPlacementKey();
      cur.placeKey = key;
    }
    onFaceContinue({ key, fromDeg, durationMs });
  }

  function rotateDrag(delta) {
    if (!drag || flyingBack) return;
    // Hotswap holds a synthetic float only — never re-arm a board/parked source
    if (!drag.hotswap) {
      hideArmedSource();
      ensureLifted();
    } else {
      // Kill any board face tween that might still be running on the placed item
      snapBoardSpinsToDataFace();
    }
    float.rotateDrag(delta);
  }

  const pointers = bindDragPointers({
    host,
    grid,
    state,
    itemsById,
    onSelectKey,
    getDrag: () => drag,
    setDrag: (d) => { drag = d; },
    getFlyingBack: () => flyingBack,
    getMoved: () => moved,
    setMoved: (v) => { moved = v; },
    getDownPos: () => downPos,
    setDownPos: (p) => { downPos = p; },
    getLastPointer: () => lastPointer,
    setLastPointer: (p) => { lastPointer = p; },
    setLastMoveAt: (t) => { lastMoveAt = t; },
    getPickupAt: () => pickupAt,
    getMultiMoveKeys: () => multiMoveKeys,
    setMultiMoveKeys: (k) => { multiMoveKeys = k; },
    multi,
    editMode,
    metrics,
    float: {
      startPickupFrom: float.startPickupFrom,
      rotateDrag,
      cancelDragWithFlyback: float.cancelDragWithFlyback,
      showOrphanPickup: float.showOrphanPickup,
    },
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
    beginHotswapFromPlacement,
    syncPendingPointer,
    scheduleMove(x, y) {
      pendingMove = { x, y, t: performance.now() };
      if (!moveRaf) moveRaf = requestAnimationFrame(flushPendingMove);
    },
    getWheelReadyAt: () => wheelRotateReadyAt,
    setWheelReadyAt: (t) => { wheelRotateReadyAt = t; },
    getLastRotateAt: () => lastRotateAt,
    selectionBox,
  });

  return {
    beginCatalogDrag: pointers.beginCatalogDrag,
    beginParkDrag,
    isDragging: () => !!drag || flyingBack || !!selectionBox?.isActive(),
    setMetaDrop(next) {
      metaDrop = next;
    },
    destroy() {
      if (moveRaf) cancelAnimationFrame(moveRaf);
      selectionBox?.destroy();
      pointers.destroy();
      metrics.destroy();
      invPreview?.destroy?.();
      affect?.destroy?.();
      endDragHard();
      cursorEl.remove();
    },
  };
}
