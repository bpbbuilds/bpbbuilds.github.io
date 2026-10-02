/**
 * Drag cursor sizing + bag slot overlay + cargo + silhouette shadow.
 * Position is transform-only (no left/top) so moves stay on the compositor.
 */

import { shapeForItem, bodyBounds } from '../../shared/backpack-grid/index.js';
import { isBagItem } from './collision.js';
import { createAngleTween } from '../../shared/backpack-grid/face-spin.js';
import { PICKUP_SCALE, PICKUP_MS, SHADOW_TWEEN_MS } from './drag-feel.js';
import { feedLiveDrag } from '../../shared/item-live-art/index.js';

function assetRoot() {
  const raw = document.body?.dataset?.root ?? './';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** Item.shadowOffset_dropped (5,5) / cellSize 80 */
const SHADOW_REST_CELLS = 5 / 80;
/** Item.shadowOffset_dragged (15,15) / cellSize 80 */
const SHADOW_DRAG_CELLS = 15 / 80;

/**
 * @param {object} item
 * @param {{ w: number, h: number }} body
 */
function spriteCells(item, body) {
  const sw = Number(item?.spriteW);
  const sh = Number(item?.spriteH);
  if (Number.isFinite(sw) && Number.isFinite(sh) && sw > 0 && sh > 0) {
    return { w: sw, h: sh };
  }
  if (isBagItem(item)) {
    return { w: body.w + 0.4, h: body.h + 0.4 };
  }
  const type = String(item?.type || '');
  if (type === 'Gem' || type.includes('Gemstone')) {
    return { w: 0.5, h: 0.5 };
  }
  return { w: Math.max(1, body.w), h: Math.max(1, body.h) };
}

/**
 * @param {HTMLElement} cursorEl
 * @param {HTMLElement} slotsEl
 * @param {HTMLElement} imgEl
 * @param {HTMLElement} cargoEl
 * @param {() => number} getCellPx
 * @param {HTMLImageElement} [shadowEl]
 * @param {HTMLElement} [gemsEl]
 */
export function createDragCursorView(
  cursorEl,
  slotsEl,
  imgEl,
  cargoEl,
  getCellPx,
  shadowEl = null,
  gemsEl = null,
) {
  /** BagTiles.Default — follower bags while dragged with parent (not CanAdd). */
  const filledSlotUrl = `${assetRoot()}assets/icons/FilledSlot.png`;
  const faceTween = createAngleTween(0);
  let visualFaceDeg = 0;
  let lastBag = false;
  let lastTilt = 0;
  let lastScale = 1;
  let posX = 0;
  let posY = 0;
  let lastW = NaN;
  let lastH = NaN;
  let lastSprW = NaN;
  let lastSprH = NaN;
  let lastSlotSig = '';
  let lastCargoSig = '';
  let lastGemsSig = '';
  let lastChromeSig = '';
  let shadowDrag = false;
  /** Cargo footprints in cursor-local px (for sell-hover group outline). */
  let groupParts = /** @type {{ x: number, y: number, w: number, h: number }[]} */ ([]);

  let outlineEl = cursorEl.querySelector('.create-board__cursor-group-outline');
  if (!(outlineEl instanceof HTMLElement)) {
    outlineEl = document.createElement('div');
    outlineEl.className = 'create-board__cursor-group-outline';
    outlineEl.hidden = true;
    outlineEl.setAttribute('aria-hidden', 'true');
    cursorEl.appendChild(outlineEl);
  }
  /** Face whose cargo/slots layout is on screen while the bag sprite tweens. */
  let spinCargoFromFace = /** @type {number | null} */ (null);
  /** @type {(() => void) | null} */
  let pendingCargoSettle = null;

  function shadowOffsetPx() {
    const cell = getCellPx();
    const cells = shadowDrag ? SHADOW_DRAG_CELLS : SHADOW_REST_CELLS;
    return cells * cell;
  }

  function clearLayerSpin() {
    cargoEl.style.transform = '';
    cargoEl.style.transformOrigin = '';
    slotsEl.style.transform = '';
    slotsEl.style.transformOrigin = '';
  }

  /**
   * Snap bag cargo/slots to the pending post-rotate layout (insideRotationNode settle).
   */
  function settleBagCargoSpin() {
    if (spinCargoFromFace == null && !pendingCargoSettle) return;
    spinCargoFromFace = null;
    clearLayerSpin();
    const settle = pendingCargoSettle;
    pendingCargoSettle = null;
    settle?.();
  }

  function paintSpriteTransforms() {
    const rot = `${visualFaceDeg + lastTilt}deg`;
    imgEl.style.transform = `translate(-50%, -50%) rotate(${rot})`;
    if (shadowEl) {
      const o = shadowOffsetPx();
      shadowEl.style.transform =
        `translate(calc(-50% + ${o}px), calc(-50% + ${o}px)) rotate(${rot})`;
    }
    if (gemsEl) {
      gemsEl.style.transform = `translate(-50%, -50%) rotate(${rot})`;
      // Gem face is world-space (same as holding the gem). The layer already
      // spins with the weapon, so take that turn back off the sprite.
      for (const img of gemsEl.querySelectorAll(':scope > img')) {
        if (!(img instanceof HTMLElement)) continue;
        const world = Number(img.dataset.gemDeg);
        if (!Number.isFinite(world)) continue;
        img.style.transform = `translate(-50%, -50%) rotate(${world - visualFaceDeg}deg)`;
      }
    }
    // Game insideRotationNode — cargo + bag tiles spin with the sprite
    if (spinCargoFromFace != null) {
      const delta = visualFaceDeg - spinCargoFromFace * 90;
      const t = `rotate(${delta}deg)`;
      cargoEl.style.transformOrigin = '50% 50%';
      cargoEl.style.transform = t;
      // Bag slots always ride the spin when tweening (don't gate on lastBag —
      // a stale flag would leave CanAddBag squares axis-locked).
      slotsEl.style.transformOrigin = '50% 50%';
      slotsEl.style.transform = t;
      for (const img of cargoEl.querySelectorAll('.create-board__cursor-gem')) {
        if (!(img instanceof HTMLElement)) continue;
        const world = Number(img.dataset.gemDeg);
        const host = Number(img.dataset.hostDeg);
        if (!Number.isFinite(world) || !Number.isFinite(host)) continue;
        img.style.transform = `translate(-50%, -50%) rotate(${world - host - delta}deg)`;
      }
    }
    // BottleOfBooze: liquid angle tracks -global_rotation (face + tilt on cursor).
    feedLiveDrag(imgEl, 0, 0, { tiltDeg: lastTilt, faceDeg: visualFaceDeg });
  }

  function paintTransform() {
    cursorEl.style.transform =
      `translate3d(${posX}px, ${posY}px, 0) translate(-50%, -50%) scale(${lastScale})`;
    paintSpriteTransforms();
  }

  /**
   * @param {object} item
   * @param {number} [r]
   */
  function sizeFor(item, r = 0) {
    const cell = getCellPx();
    const bag = isBagItem(item);
    const face = ((Number(r) || 0) % 4 + 4) % 4;
    const layoutShape = shapeForItem(item, bag ? face : 0);
    const layout = bodyBounds(layoutShape);
    const foot =
      !bag && face
        ? bodyBounds(shapeForItem(item, face))
        : layout;
    const spr = spriteCells(item, layout);
    return {
      w: Math.max(cell, layout.w * cell),
      h: Math.max(cell, layout.h * cell),
      footW: Math.max(cell, foot.w * cell),
      footH: Math.max(cell, foot.h * cell),
      bodyW: layout.w,
      bodyH: layout.h,
      sprW: spr.w * cell,
      sprH: spr.h * cell,
      cell,
    };
  }

  /** @param {number} x @param {number} y */
  function setPosition(x, y) {
    posX = Math.round(x);
    posY = Math.round(y);
    paintTransform();
  }

  /**
   * @param {number} [_face]
   * @param {number} [tiltDeg]
   * @param {number} [scale]
   * @param {boolean} [bag]
   */
  function setTransform(_face, tiltDeg = 0, scale = 1, bag = false) {
    lastBag = bag;
    lastTilt = tiltDeg;
    lastScale = scale;
    paintTransform();
  }

  /** @param {number} face 0–3 */
  function setFaceInstant(face) {
    settleBagCargoSpin();
    const f = ((Number(face) || 0) % 4 + 4) % 4;
    visualFaceDeg = f * 90;
    faceTween.setInstant(visualFaceDeg);
    paintTransform();
  }

  /**
   * @param {number} face 0–3
   * @param {{ spinCargoFromFace?: number, onDone?: () => void }} [opts]
   */
  function animateFaceTo(face, opts = {}) {
    const f = ((Number(face) || 0) % 4 + 4) % 4;
    cursorEl.style.transition = 'none';
    imgEl.style.transition = 'none';
    if (shadowEl) shadowEl.style.transition = 'none';

    const wantCargoSpin = Number.isFinite(opts.spinCargoFromFace);
    if (wantCargoSpin) {
      // Keep cargo/slots DOM at the layout face we started spinning from.
      // Mid-chain settle+repaint made multi-select look like it skipped / snapped
      // (single items have no cargo layer, so they stayed smooth).
      if (spinCargoFromFace == null) {
        spinCargoFromFace = ((Number(opts.spinCargoFromFace) % 4) + 4) % 4;
      }
      pendingCargoSettle = opts.onDone || null;
    } else if (spinCargoFromFace != null || pendingCargoSettle) {
      settleBagCargoSpin();
    }

    faceTween.tweenTo(
      f * 90,
      (deg) => {
        visualFaceDeg = deg;
        paintSpriteTransforms();
        cursorEl.style.transform =
          `translate3d(${posX}px, ${posY}px, 0) translate(-50%, -50%) scale(${lastScale})`;
      },
      () => {
        const settle = pendingCargoSettle;
        pendingCargoSettle = null;
        spinCargoFromFace = null;
        clearLayerSpin();
        paintSpriteTransforms();
        settle?.();
      },
    );
  }

  function cancelFaceTween() {
    faceTween.cancel();
    settleBagCargoSpin();
  }

  function isBagCargoSpinning() {
    return spinCargoFromFace != null || pendingCargoSettle != null;
  }

  /**
   * Item.pickup / drop — tween silhouette offset rest ↔ dragged.
   * @param {boolean} dragged
   * @param {{ animate?: boolean }} [opts]
   */
  function setShadowDragged(dragged, opts = {}) {
    shadowDrag = !!dragged;
    if (!shadowEl) return;
    const animate = opts.animate !== false;
    const o = shadowOffsetPx();
    const rot = `${visualFaceDeg + lastTilt}deg`;
    if (animate) {
      shadowEl.style.transition = `transform ${SHADOW_TWEEN_MS}ms ease-out`;
    } else {
      shadowEl.style.transition = 'none';
    }
    shadowEl.style.transform =
      `translate(calc(-50% + ${o}px), calc(-50% + ${o}px)) rotate(${rot})`;
  }

  function layoutGroupOutline() {
    if (!(outlineEl instanceof HTMLElement)) return;
    const mainW = Number.isFinite(lastW) ? lastW : 0;
    const mainH = Number.isFinite(lastH) ? lastH : 0;
    let minX = 0;
    let minY = 0;
    let maxX = mainW;
    let maxY = mainH;
    for (const p of groupParts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + p.w);
      maxY = Math.max(maxY, p.y + p.h);
    }
    const pad = 7;
    outlineEl.style.left = `${minX - pad}px`;
    outlineEl.style.top = `${minY - pad}px`;
    outlineEl.style.width = `${Math.max(0, maxX - minX) + pad * 2}px`;
    outlineEl.style.height = `${Math.max(0, maxY - minY) + pad * 2}px`;
  }

  /** @param {boolean} on */
  function setSellHover(on) {
    cursorEl.classList.toggle('is-sell-hover', on);
    if (outlineEl instanceof HTMLElement) {
      outlineEl.hidden = !on;
      if (on) layoutGroupOutline();
    }
  }

  /**
   * @param {ReturnType<typeof sizeFor>} size
   * @param {boolean} [_bag]
   */
  function applySize(size, _bag) {
    if (
      size.w === lastW &&
      size.h === lastH &&
      size.sprW === lastSprW &&
      size.sprH === lastSprH
    ) {
      return;
    }
    lastW = size.w;
    lastH = size.h;
    lastSprW = size.sprW;
    lastSprH = size.sprH;
    cursorEl.style.width = `${size.w}px`;
    cursorEl.style.height = `${size.h}px`;
    cursorEl.style.setProperty('--bpb-bg-cell', `${size.cell}px`);
    imgEl.style.width = `${size.sprW}px`;
    imgEl.style.height = `${size.sprH}px`;
    if (shadowEl) {
      shadowEl.style.width = `${size.sprW}px`;
      shadowEl.style.height = `${size.sprH}px`;
    }
    layoutGroupOutline();
  }

  /**
   * Bag validity green/red lives on the board inv-preview (same CanAdd as items).
   * Cursor TileMap slots stay off so they don’t stack a second dim stamp.
   * @param {object} item
   * @param {number} _r
   * @param {boolean | null} _ok
   */
  function syncBagSlots(item, _r, _ok) {
    if (!isBagItem(item)) {
      if (lastSlotSig !== '') {
        lastSlotSig = '';
        slotsEl.hidden = true;
        slotsEl.replaceChildren();
      }
      return;
    }
    if (lastSlotSig === 'board') return;
    lastSlotSig = 'board';
    slotsEl.hidden = true;
    slotsEl.replaceChildren();
    slotsEl.classList.remove('is-valid', 'is-invalid');
  }

  /**
   * Socketed gems on the held host (follow cursor with the sprite).
   * @param {object | null | undefined} item
   * @param {(string | null | undefined)[] | null | undefined} gemIds
   * @param {Map<string, object>} itemsById
   * @param {(item: object) => string} getSpriteUrl
   * @param {(number | null | undefined)[] | null | undefined} [gemR]
   */
  function syncHostGems(item, gemIds, itemsById, getSpriteUrl, gemR) {
    if (!gemsEl) return;
    const ids = Array.isArray(gemIds) ? gemIds : [];
    const faces = Array.isArray(gemR) ? gemR : [];
    const sig = `${item?.id || ''}|${ids.map((g, i) => `${g || ''}:${Number(faces[i]) || 0}`).join(',')}|${getCellPx()}`;
    if (sig === lastGemsSig) return;
    lastGemsSig = sig;
    gemsEl.replaceChildren();
    if (!item || !ids.some(Boolean)) {
      gemsEl.hidden = true;
      return;
    }
    const offsets = Array.isArray(item.socketOffsets) ? item.socketOffsets : [];
    const cell = getCellPx();
    gemsEl.hidden = false;
    gemsEl.style.left = '50%';
    gemsEl.style.top = '50%';
    gemsEl.style.width = '0';
    gemsEl.style.height = '0';
    for (let i = 0; i < ids.length; i += 1) {
      const gid = ids[i];
      if (!gid) continue;
      const gemItem = itemsById.get(String(gid));
      const src = gemItem ? getSpriteUrl(gemItem) : '';
      if (!src) continue;
      const ox = Number(offsets[i]?.x);
      const oy = Number(offsets[i]?.y);
      const x = Number.isFinite(ox) ? ox * cell : 0;
      const y = Number.isFinite(oy) ? oy * cell : 0;
      const sw = Number(gemItem?.spriteW);
      const sh = Number(gemItem?.spriteH);
      const gw = (Number.isFinite(sw) && sw > 0 ? sw : 0.72) * cell;
      const gh = (Number.isFinite(sh) && sh > 0 ? sh : 0.72) * cell;
      const img = document.createElement('img');
      img.className = 'create-board__cursor-gem';
      img.alt = '';
      img.draggable = false;
      img.src = src;
      const face = Math.round(Number(faces[i]));
      const gemRot = Number.isFinite(face) ? ((face % 4) + 4) % 4 : 0;
      img.dataset.gemDeg = String(gemRot * 90);
      img.style.left = `${x}px`;
      img.style.top = `${y}px`;
      img.style.width = `${gw}px`;
      img.style.height = `${gh}px`;
      img.style.transform = `translate(-50%, -50%) rotate(${gemRot * 90 - visualFaceDeg}deg)`;
      gemsEl.appendChild(img);
    }
    if (!gemsEl.childNodes.length) gemsEl.hidden = true;
  }

  /**
   * @param {{ ox: number, oy: number, id: string, r: number, gems?: (string | null | undefined)[] }[]} cargo
   * @param {number} bagFace
   * @param {Map<string, object>} itemsById
   * @param {(item: object) => string} getSpriteUrl
   */
  function syncBagCargo(cargo, bagFace, itemsById, getSpriteUrl) {
    const cell = getCellPx();
    const face = ((Number(bagFace) || 0) % 4 + 4) % 4;
    const sig = `${face}|${cell}|${(cargo || [])
      .map((e) => {
        const g = Array.isArray(e.gems) ? e.gems.map((x) => x || '').join(',') : '';
        const gr = Array.isArray(e.gemR) ? e.gemR.join(',') : '';
        return `${e.id}:${e.ox},${e.oy},${e.r}:${g}:${gr}`;
      })
      .join(';')}`;
    if (sig === lastCargoSig) return;
    lastCargoSig = sig;

    cargoEl.replaceChildren();
    groupParts = [];
    if (!cargo?.length) {
      cargoEl.hidden = true;
      layoutGroupOutline();
      return;
    }
    cargoEl.hidden = false;
    // Game getMultiSelectItems: bags first, then insides — insides paint above bag tiles.
    const ordered = [...cargo].sort((a, b) => {
      const aBag = isBagItem(itemsById.get(a.id)) ? 0 : 1;
      const bBag = isBagItem(itemsById.get(b.id)) ? 0 : 1;
      return aBag - bBag;
    });
    for (const entry of ordered) {
      const item = itemsById.get(entry.id);
      const src = item ? getSpriteUrl(item) : '';
      if (!item || !src) continue;
      const itemR = ((Number(entry.r) || 0) % 4 + 4) % 4;
      const size = sizeFor(item, itemR);
      const wrap = document.createElement('div');
      wrap.className = 'create-board__cursor-cargo';
      wrap.style.left = `${entry.ox * cell}px`;
      wrap.style.top = `${entry.oy * cell}px`;
      wrap.style.width = `${size.footW}px`;
      wrap.style.height = `${size.footH}px`;
      groupParts.push({
        x: entry.ox * cell,
        y: entry.oy * cell,
        w: size.footW,
        h: size.footH,
      });

      const img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      img.src = src;
      img.style.width = `${size.sprW}px`;
      img.style.height = `${size.sprH}px`;
      img.style.transform = `translate(-50%, -50%) rotate(${itemR * 90}deg)`;
      wrap.appendChild(img);

      // Follower bags: bagTilemap.show() + Default (FilledSlot), not CanAdd.
      // Tiles sit on Icon (over leather); cargo items are later siblings above.
      if (isBagItem(item)) {
        const shape = shapeForItem(item, itemR);
        const b = bodyBounds(shape);
        const slots = document.createElement('div');
        slots.className = 'create-board__cursor-cargo-slots';
        slots.setAttribute('aria-hidden', 'true');
        slots.style.width = `${b.w * cell}px`;
        slots.style.height = `${b.h * cell}px`;
        for (const c of shape.body) {
          const span = document.createElement('span');
          span.className = 'create-board__cursor-slot';
          span.style.left = `${(c.x - b.minX) * cell}px`;
          span.style.top = `${(c.y - b.minY) * cell}px`;
          span.style.width = `${cell}px`;
          span.style.height = `${cell}px`;
          span.style.backgroundImage = `url('${filledSlotUrl}')`;
          slots.appendChild(span);
        }
        wrap.appendChild(slots);
      }

      // Socketed gems ride with cargo (board gems are hidden as drag sources).
      // Same offsets as syncHostGems; rotate with the cargo sprite face.
          const gemIds = Array.isArray(entry.gems) ? entry.gems : [];
      const gemFaces = Array.isArray(entry.gemR) ? entry.gemR : [];
      if (gemIds.some(Boolean)) {
        const offsets = Array.isArray(item.socketOffsets) ? item.socketOffsets : [];
        const gemsLayer = document.createElement('div');
        gemsLayer.className = 'create-board__cursor-cargo-gems';
        gemsLayer.setAttribute('aria-hidden', 'true');
        gemsLayer.style.transform = `translate(-50%, -50%) rotate(${itemR * 90}deg)`;
        for (let i = 0; i < gemIds.length; i += 1) {
          const gid = gemIds[i];
          if (!gid) continue;
          const gemItem = itemsById.get(String(gid));
          const gemSrc = gemItem ? getSpriteUrl(gemItem) : '';
          if (!gemSrc) continue;
          const ox = Number(offsets[i]?.x);
          const oy = Number(offsets[i]?.y);
          const x = Number.isFinite(ox) ? ox * cell : 0;
          const y = Number.isFinite(oy) ? oy * cell : 0;
          const sw = Number(gemItem?.spriteW);
          const sh = Number(gemItem?.spriteH);
          const gw = (Number.isFinite(sw) && sw > 0 ? sw : 0.72) * cell;
          const gh = (Number.isFinite(sh) && sh > 0 ? sh : 0.72) * cell;
          const gemImg = document.createElement('img');
          gemImg.className = 'create-board__cursor-gem';
          gemImg.alt = '';
          gemImg.draggable = false;
          gemImg.src = gemSrc;
          const gf = Math.round(Number(gemFaces[i]));
          const gemRot = Number.isFinite(gf) ? ((gf % 4) + 4) % 4 : 0;
          gemImg.dataset.gemDeg = String(gemRot * 90);
          gemImg.dataset.hostDeg = String(itemR * 90);
          gemImg.style.left = `${x}px`;
          gemImg.style.top = `${y}px`;
          gemImg.style.width = `${gw}px`;
          gemImg.style.height = `${gh}px`;
          gemImg.style.transform = `translate(-50%, -50%) rotate(${gemRot * 90 - itemR * 90}deg)`;
          gemsLayer.appendChild(gemImg);
        }
        if (gemsLayer.childNodes.length) wrap.appendChild(gemsLayer);
      }

      cargoEl.appendChild(wrap);
    }
    layoutGroupOutline();
  }

  /**
   * Full chrome update only when face / placeOk / cell / bag mode change.
   * @returns {boolean} true if chrome was (re)applied
   */
  function needsChrome(itemId, r, placeOk, bag) {
    const cell = getCellPx();
    const face = ((Number(r) || 0) % 4 + 4) % 4;
    const sig = `${itemId}|${face}|${placeOk ? 1 : 0}|${cell}|${bag ? 1 : 0}`;
    if (sig === lastChromeSig) return false;
    lastChromeSig = sig;
    return true;
  }

  /** @param {object} item */
  function pickupScale(item) {
    return isBagItem(item) ? 1 : PICKUP_SCALE;
  }

  function clearSlots() {
    lastSlotSig = '';
    slotsEl.hidden = true;
    slotsEl.replaceChildren();
  }

  function clearCargo() {
    lastCargoSig = '';
    groupParts = [];
    cargoEl.hidden = true;
    cargoEl.replaceChildren();
    layoutGroupOutline();
  }

  function clearHostGems() {
    lastGemsSig = '';
    if (!gemsEl) return;
    gemsEl.hidden = true;
    gemsEl.replaceChildren();
  }

  function resetSizeCache() {
    lastW = lastH = lastSprW = lastSprH = NaN;
    lastChromeSig = '';
  }

  /** @returns {{ x: number, y: number }} */
  function getPosition() {
    return { x: posX, y: posY };
  }

  /** @returns {number} */
  function getVisualFaceDeg() {
    return visualFaceDeg;
  }

  function getFaceTweenRemainingMs() {
    return faceTween.remainingMs();
  }

  function isFaceTweening() {
    return faceTween.isRunning();
  }

  return {
    sizeFor,
    applySize,
    setPosition,
    getPosition,
    setTransform,
    setFaceInstant,
    animateFaceTo,
    cancelFaceTween,
    syncBagSlots,
    syncBagCargo,
    setSellHover,
    syncHostGems,
    pickupScale,
    clearSlots,
    clearCargo,
    clearHostGems,
    resetSizeCache,
    setShadowDragged,
    needsChrome,
    getVisualFaceDeg,
    getFaceTweenRemainingMs,
    isFaceTweening,
    isBagCargoSpinning,
    settleBagCargoSpin,
    PICKUP_MS,
  };
}
