/**
 * Item float controller — pickup, cursor follow, rotate, flyback (Item.gd).
 */

import { isBagItem, isGemItem } from './collision.js';
import { EDIT_MODE } from './editor-state.js';
import { captureBagCargo, captureMultiDraggedInside, reprojectCargoForFace } from './bag-cargo.js';
import {
  clearDragSources,
  hideBagFabricCells,
  hideCargoSources,
  hideGroupSources,
  markDragSource,
  setCreateDragging,
} from './drag-source.js';
import {
  pickOffsetPx,
  PICKUP_MS,
  createTiltState,
} from './drag-feel.js';
import { playGrab, warmSfx } from './create-sfx.js';
import { gemCarry, withGemInSocket } from './socket-place.js';
import {
  fillCursorSprite,
  clearCursorSprite,
  sloshCursorPotion,
} from './drag-live-sprite.js';

/**
 * Build fixed cursor DOM (body-appended).
 */
export function createCursorDom() {
  const cursorEl = document.createElement('div');
  cursorEl.className = 'create-board__cursor';
  cursorEl.hidden = true;
  cursorEl.setAttribute('aria-hidden', 'true');
  const slotsEl = document.createElement('div');
  slotsEl.className = 'create-board__cursor-slots';
  slotsEl.hidden = true;
  const cargoEl = document.createElement('div');
  cargoEl.className = 'create-board__cursor-cargoes';
  cargoEl.hidden = true;
  const gemsEl = document.createElement('div');
  gemsEl.className = 'create-board__cursor-gems';
  gemsEl.hidden = true;
  gemsEl.setAttribute('aria-hidden', 'true');
  const cursorShadow = document.createElement('img');
  cursorShadow.className = 'create-board__cursor-shadow';
  cursorShadow.alt = '';
  cursorShadow.draggable = false;
  cursorShadow.setAttribute('aria-hidden', 'true');
  const cursorImg = document.createElement('span');
  cursorImg.className = 'create-board__cursor-sprite';
  cursorImg.setAttribute('aria-hidden', 'true');
  cursorEl.append(cursorShadow, slotsEl, cursorImg, gemsEl, cargoEl);
  document.body.appendChild(cursorEl);
  return { cursorEl, slotsEl, cargoEl, gemsEl, cursorShadow, cursorImg };
}

/**
 * @param {{
 *   host: HTMLElement,
 *   grid: { el: HTMLElement },
 *   stageEl: HTMLElement | null,
 *   state: any,
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   cursorEl: HTMLElement,
 *   slotsEl: HTMLElement,
 *   cargoEl: HTMLElement,
 *   cursorImg: HTMLElement,
 *   cursorShadow: HTMLImageElement,
 *   view: ReturnType<import('./drag-cursor.js').createDragCursorView>,
 *   getDrag: () => any,
 *   setDrag: (d: any) => void,
 *   getEditMode: () => string,
 *   getLastPointer: () => { x: number, y: number } | null,
 *   getDownPos: () => { x: number, y: number } | null,
 *   setPickupAt: (t: number) => void,
 *   getPickupAt: () => number,
 *   setFlyingBack: (v: boolean) => void,
 *   getFlyingBack: () => boolean,
 *   setLastPlaceOk: (v: boolean) => void,
 *   getLastPlaceOk: () => boolean,
 *   setLastRotateAt: (t: number) => void,
 *   setMoved: (v: boolean) => void,
 *   clearMetrics: () => void,
 *   setGemSocketsVisible: (on: boolean) => void,
 *   hidePreview: () => void,
 *   onAfterRotate: () => void,
 *   endDragHard: () => void,
 *   getMultiMoveKeys: () => string[] | null,
 * }} deps
 */
export function createFloatController(deps) {
  const {
    host,
    grid,
    stageEl,
    state,
    itemsById,
    getSpriteUrl,
    cursorEl,
    slotsEl,
    cargoEl,
    cursorImg,
    cursorShadow,
    view,
    getDrag,
    setDrag,
    getEditMode,
    getLastPointer,
    getDownPos,
    setPickupAt,
    getPickupAt,
    setFlyingBack,
    getFlyingBack,
    setLastPlaceOk,
    getLastPlaceOk,
    setLastRotateAt,
    setMoved,
    clearMetrics,
    setGemSocketsVisible,
    hidePreview,
    onAfterRotate,
    endDragHard,
    getMultiMoveKeys,
  } = deps;

  const tilt = createTiltState();

  function setDraggingBagChrome(on) {
    host.classList.toggle('is-dragging-bag', on);
    host.querySelector('.create-board')?.classList.toggle('is-dragging-bag', on);
    stageEl?.classList.toggle('is-dragging-bag', on);
  }

  function paintCargo(bagFace) {
    const drag = getDrag();
    if (view.isBagCargoSpinning?.()) return;
    if (!drag?.cargo?.length) view.clearCargo();
    else view.syncBagCargo(drag.cargo, bagFace, itemsById, getSpriteUrl);
  }

  function paintHostGems() {
    const drag = getDrag();
    const item = drag ? itemsById.get(drag.itemId) : null;
    const gems =
      drag?.gems ||
      drag?.restorePlacement?.gems ||
      null;
    const gemR = drag?.gemR || drag?.restorePlacement?.gemR || null;
    if (!item || !gems?.some(Boolean)) view.clearHostGems?.();
    else view.syncHostGems?.(item, gems, itemsById, getSpriteUrl, gemR);
  }

  /**
   * @param {object | null} item
   * @param {string} src
   * @param {HTMLElement | null} [sourceEl]
   */
  function setCursorSprite(item, src, _sourceEl = null) {
    fillCursorSprite(cursorImg, item, src);
    if ((cursorShadow.getAttribute('src') || '') !== src) {
      cursorShadow.src = src;
    }
  }

  /**
   * @param {HTMLElement} sourceEl
   * @param {string} itemId
   * @param {number} r
   * @param {number} clientX
   * @param {number} clientY
   */
  function startPickupFrom(sourceEl, itemId, r, clientX, clientY) {
    const item = itemsById.get(itemId);
    const src = item ? getSpriteUrl(item) : '';
    if (!item || !src) return;

    const bag = isBagItem(item);
    const drag = getDrag();
    if (drag) {
      drag.sourceEl = sourceEl;
      drag.sourceRect = sourceEl.getBoundingClientRect();
      drag.pickupDone = true;
      drag.isBag = bag;
      const multiKeys = getMultiMoveKeys?.() || null;
      const placements = state.getDraft().placements;

      // MultiSelect: main holds; followers → draggedInsideItems (reparent to cursor)
      if (
        drag.mode === 'move' &&
        drag.moveKey &&
        multiKeys &&
        multiKeys.length > 1
      ) {
        drag.cargo = captureMultiDraggedInside(
          drag.moveKey,
          multiKeys,
          placements,
          itemsById,
        );
        hideGroupSources(grid.el, multiKeys);
        for (const key of multiKeys) {
          const row = placements.find((p) => p.key === key);
          if (!row) continue;
          const rowItem = itemsById.get(row.id);
          if (isBagItem(rowItem)) hideBagFabricCells(grid.el, rowItem, row);
        }
      } else if (
        bag &&
        drag.mode === 'move' &&
        drag.moveKey &&
        getEditMode() === EDIT_MODE.DEFAULT
      ) {
        const bagP = placements.find((p) => p.key === drag.moveKey);
        if (bagP) {
          drag.cargo = captureBagCargo(item, bagP, placements, itemsById);
          hideCargoSources(grid.el, drag.cargo);
          hideBagFabricCells(grid.el, item, bagP);
        }
      } else {
        drag.cargo = [];
        if (bag && drag.mode === 'move' && drag.moveKey) {
          const bagP = placements.find((p) => p.key === drag.moveKey);
          if (bagP) hideBagFabricCells(grid.el, item, bagP);
        }
      }
      if (drag.mode === 'move' && drag.moveKey) {
        const row = placements.find((p) => p.key === drag.moveKey);
        if (row && Array.isArray(row.gems)) {
          drag.gems = row.gems.slice();
          drag.gemR = Array.isArray(row.gemR) ? row.gemR.slice() : undefined;
        }
      } else if (Array.isArray(drag.restorePlacement?.gems)) {
        drag.gems = drag.restorePlacement.gems.slice();
        drag.gemR = Array.isArray(drag.restorePlacement.gemR)
          ? drag.restorePlacement.gemR.slice()
          : undefined;
      }
    }
    tilt.setEnabled(!(drag?.cargo?.length > 0));
    tilt.reset();
    setCreateDragging(true);
    setLastRotateAt(0);
    setGemSocketsVisible(isGemItem(item));
    setPickupAt(performance.now());
    warmSfx();
    playGrab();

    const liftY = clientY - pickOffsetPx();
    const size = view.sizeFor(item, r);
    const face = ((r % 4) + 4) % 4;
    const scaleTarget = view.pickupScale(item);
    setDraggingBagChrome(bag);
    cursorEl.classList.add('is-held');
    cursorEl.classList.toggle('is-bag', bag);
    cursorEl.hidden = false;

    setCursorSprite(item, src, sourceEl);
    cursorEl.style.transition = 'none';
    view.applySize(size, bag);
    view.setPosition(clientX, liftY);
    view.setFaceInstant(face);
    view.setTransform(face, 0, 1, bag);
    view.setShadowDragged(false, { animate: false });
    view.syncBagSlots(item, r, null);
    paintCargo(face);
    paintHostGems();

    markDragSource(sourceEl);

    requestAnimationFrame(() => {
      if (!getDrag()?.pickupDone) return;
      view.setShadowDragged(true, { animate: true });
      if (!bag) {
        cursorEl.style.transition = `transform ${PICKUP_MS}ms ease-out`;
        view.setTransform(face, 0, scaleTarget, false);
      }
    });
  }

  /**
   * @param {string} itemId
   * @param {number} r
   * @param {number} clientX
   * @param {number} clientY
   * @param {number} [dt]
   * @param {boolean} [placeOk]
   */
  function updateDragCursor(itemId, r, clientX, clientY, dt = 1 / 60, placeOk = false) {
    const drag = getDrag();
    if (
      drag &&
      (drag.mode === 'move' || drag.mode === 'unsocket') &&
      !drag.pickupDone
    ) {
      cursorEl.hidden = true;
      return;
    }
    const item = itemsById.get(itemId);
    const src = item ? getSpriteUrl(item) : '';
    if (!item || !src) {
      cursorEl.hidden = true;
      return;
    }
    const bag = isBagItem(item);
    const face = ((r % 4) + 4) % 4;
    cursorEl.hidden = false;
    cursorEl.classList.add('is-held');
    cursorEl.classList.toggle('is-bag', bag);

    const prev = getLastPointer();
    let tiltDeg = tilt.angle();
    const dx = prev ? clientX - prev.x : 0;
    const dy = prev ? clientY - prev.y : 0;
    if (prev) tiltDeg = tilt.step(dx, dy, dt);

    const liftY = clientY - pickOffsetPx();
    cursorEl.style.transition = 'none';
    view.setPosition(clientX, liftY);
    view.setTransform(face, tiltDeg, view.pickupScale(item), bag);
    sloshCursorPotion(cursorImg, dx, dy, {
      tiltDeg,
      faceDeg: view.getVisualFaceDeg?.() ?? face * 90,
    });

    if (
      !view.isBagCargoSpinning?.() &&
      view.needsChrome(itemId, r, placeOk, bag)
    ) {
      setCursorSprite(item, src, drag?.sourceEl || null);
      view.applySize(view.sizeFor(item, r), bag);
      view.syncBagSlots(item, r, placeOk);
      if (drag?.cargo?.length) paintCargo(face);
      else view.clearCargo();
      paintHostGems();
    }
  }

  function resetCursorChrome(opts = {}) {
    cursorEl.style.transition = 'none';
    cursorEl.hidden = true;
    cursorEl.classList.remove('is-held', 'is-bag', 'is-sell-hover');
    cursorEl.style.transform = 'translate3d(0, 0, 0) translate(-50%, -50%)';
    cursorImg.style.width = '';
    cursorImg.style.height = '';
    cursorImg.style.transform = '';
    cursorImg.style.opacity = '';
    cursorImg.style.transition = 'none';
    clearCursorSprite(cursorImg);
    cursorShadow.style.width = '';
    cursorShadow.style.height = '';
    cursorShadow.style.transform = '';
    cursorShadow.style.transition = 'none';
    cursorShadow.removeAttribute('src');
    view.setShadowDragged(false, { animate: false });
    view.clearSlots();
    view.clearCargo();
    view.setSellHover?.(false);
    view.clearHostGems?.();
    view.resetSizeCache();
    clearDragSources();
    if (!opts.keepDragging) setCreateDragging(false);
    clearMetrics();
    setDraggingBagChrome(false);
    tilt.setEnabled(true);
    tilt.reset();
  }

  /**
   * @param {'cancel' | 'failed'} [kind]
   */
  async function cancelDragWithFlyback(kind = 'cancel') {
    const drag = getDrag();
    if (!drag || getFlyingBack()) {
      endDragHard();
      return;
    }
    const restore = drag.unsocketRestore ? { ...drag.unsocketRestore } : null;
    const parkRestore = drag.fromPark && drag.restoreParked
      ? { ...drag.restoreParked }
      : null;
    const boardRestore = drag.hotswap && drag.restorePlacement
      ? { ...drag.restorePlacement }
      : null;
    const cargoRestore = Array.isArray(drag.cargo) ? drag.cargo.slice() : [];
    hidePreview();
    void kind;
    if (restore) {
      const hostRow = state.getDraft().placements.find((p) => p.key === restore.hostKey);
      const hostItem = hostRow ? itemsById.get(hostRow.id) : null;
      if (hostRow && hostItem) {
        const occupied = hostRow.gems?.[restore.slot];
        if (!occupied || occupied === restore.gemId) {
          const { gems, gemR } = withGemInSocket(
            hostRow, hostItem, restore.slot, restore.gemId, restore.face,
          );
          state.updatePlacement(restore.hostKey, { gems, gemR }, { borrow: true });
          endDragHard();
          return;
        }
      }
      // Origin slot taken (or host gone) — keep gem free-follow (A3)
      drag.unsocketRestore = null;
      drag.mode = 'place';
      drag.hotswap = true;
      drag.hostKey = null;
      drag.socketSlot = null;
      return;
    }
    if (parkRestore) {
      state.appendParked?.(
        [
          {
            id: parkRestore.id,
            r: parkRestore.r || 0,
            key: parkRestore.key,
            priority: parkRestore.priority ?? null,
            ...gemCarry(parkRestore),
          },
        ],
        { borrow: true },
      );
      endDragHard();
      return;
    }
    if (boardRestore) {
      /** @type {object[]} */
      const next = [
        ...state.getDraft().placements.filter((p) => p.key !== boardRestore.key),
        {
          id: boardRestore.id,
          x: boardRestore.x,
          y: boardRestore.y,
          r: boardRestore.r,
          key: boardRestore.key,
          priority: boardRestore.priority ?? null,
          ...gemCarry(boardRestore),
        },
      ];
      for (const c of cargoRestore) {
        if (!c?.key) continue;
        next.push({
          id: c.id,
          x: Math.round(Number(boardRestore.x) + (Number(c.ox) || 0)),
          y: Math.round(Number(boardRestore.y) + (Number(c.oy) || 0)),
          r: ((Number(c.r) || 0) % 4 + 4) % 4,
          key: c.key,
          priority: null,
          ...gemCarry(c),
        });
      }
      state.setPlacements(next);
      endDragHard();
      return;
    }
    // Move flyback: cargo may have been pulled off the board (hotswap) or only
    // hidden — ensure every cargo key is back at home cells (never void).
    if (drag.mode === 'move' && cargoRestore.length) {
      const placements = state.getDraft().placements;
      const have = new Set(placements.map((p) => p.key).filter(Boolean));
      /** @type {object[]} */
      const missing = [];
      for (const c of cargoRestore) {
        if (!c?.key || !c.id || have.has(c.key)) continue;
        const x = Number.isFinite(Number(c.x))
          ? Math.round(Number(c.x))
          : null;
        const y = Number.isFinite(Number(c.y))
          ? Math.round(Number(c.y))
          : null;
        if (x == null || y == null) continue;
        missing.push({
          id: c.id,
          x,
          y,
          r: ((Number(c.r) || 0) % 4 + 4) % 4,
          key: c.key,
          priority: null,
          ...gemCarry(c),
        });
      }
      if (missing.length) {
        state.setPlacements([...placements, ...missing]);
      }
    }
    endDragHard();
  }

  /** @param {number} delta */
  function rotateDrag(delta) {
    const drag = getDrag();
    if (!drag || getFlyingBack()) return;
    // No universal time gate — game only paces wheel (0.1s). RMB/keys are
    // just_pressed; browser double-fires are handled in drag-pointers.
    setMoved(true);
    setLastRotateAt(performance.now());
    const fromFace = drag.r;
    drag.r = (drag.r + delta + 4) % 4;

    const item = itemsById.get(drag.itemId);
    if (item) {
      const bag = isBagItem(item);
      const hasCargo = drag.cargo?.length > 0;
      if (hasCargo) {
        drag.cargo = reprojectCargoForFace(
          drag.cargo, item, fromFace, drag.r, itemsById,
        );
      }
      if (hasCargo && bag) {
        // Keep cargo/slots at fromFace layout and spin them with the bag sprite
        // (Item.insideRotationNode). Snap footprint after the tween.
        view.animateFaceTo(drag.r, {
          spinCargoFromFace: fromFace,
          onDone: () => {
            if (!getDrag()) return;
            const size = view.sizeFor(item, drag.r);
            view.applySize(size, true);
            view.syncBagSlots(item, drag.r, getLastPlaceOk());
            paintCargo(drag.r);
          },
        });
      } else if (hasCargo) {
        // Multi-select main — cargo spins with sprite, then snaps layout
        view.animateFaceTo(drag.r, {
          spinCargoFromFace: fromFace,
          onDone: () => {
            if (!getDrag()) return;
            paintCargo(drag.r);
          },
        });
      } else if (bag) {
        // Empty bag — slots spin with sprite (insideRotationNode)
        view.animateFaceTo(drag.r, {
          spinCargoFromFace: fromFace,
          onDone: () => {
            if (!getDrag()) return;
            const size = view.sizeFor(item, drag.r);
            view.applySize(size, true);
            view.syncBagSlots(item, drag.r, getLastPlaceOk());
          },
        });
      } else {
        const size = view.sizeFor(item, drag.r);
        view.applySize(size, bag);
        view.syncBagSlots(item, drag.r, getLastPlaceOk());
        view.animateFaceTo(drag.r);
      }
    } else {
      view.animateFaceTo(drag.r);
    }
    // sparks/sfx off for now — keep rotate snappy under spam input
    onAfterRotate();
  }

  /**
   * Orphan hotswap cursor (item already removed from board).
   * @param {object} item
   * @param {number} r
   * @param {number} clientX
   * @param {number} clientY
   */
  function showOrphanPickup(item, r, clientX, clientY) {
    const src = getSpriteUrl(item);
    if (!src) return;
    const drag = getDrag();
    if (drag) {
      drag.pickupDone = true;
      drag.sourceEl = null;
    }
    setCreateDragging(true);
    setLastRotateAt(0);
    setPickupAt(performance.now());
    warmSfx();
    playGrab();
    tilt.setEnabled(!(drag?.cargo?.length > 0));
    tilt.reset();
    const bag = isBagItem(item);
    setDraggingBagChrome(bag);
    cursorEl.classList.add('is-held');
    cursorEl.classList.toggle('is-bag', bag);
    cursorEl.hidden = false;
    setCursorSprite(item, src, null);
    const size = view.sizeFor(item, r);
    view.applySize(size, bag);
    view.setPosition(clientX, clientY - pickOffsetPx());
    view.setFaceInstant(r);
    view.setTransform(r, 0, view.pickupScale(item), bag);
    view.setShadowDragged(true, { animate: true });
    view.syncBagSlots(item, r, null);
    paintCargo(r);
    paintHostGems();
  }

  return {
    tilt,
    setDraggingBagChrome,
    paintCargo,
    setCursorSprite,
    startPickupFrom,
    updateDragCursor,
    resetCursorChrome,
    cancelDragWithFlyback,
    rotateDrag,
    showOrphanPickup,
    slotsEl,
  };
}
