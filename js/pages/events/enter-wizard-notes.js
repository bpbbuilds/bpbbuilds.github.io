/**
 * Event build description — same chip notes as Create, limited to this board.
 */

import { boardMentionIds } from '../../shared/item-mentions.js';
import { createTooltipHover } from '../../shared/tooltip-hover.js';
import { mountNotesComposer } from '../create/notes-composer.js';

/**
 * @param {{
 *   overlay: HTMLElement,
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   getPlacements: () => { id?: string, gems?: string[] }[],
 *   getNotes: () => string,
 *   onChange: (notes: string) => void,
 *   tierAt?: (x: number, y: number) => { priority: 'needed' | 'nice' | 'optional', el: HTMLElement } | null,
 *   setTierHover?: (el: HTMLElement | null, ok: boolean) => void,
 *   onTierDrop?: (key: string, itemId: string, priority: 'needed' | 'nice' | 'optional') => boolean,
 * }} opts
 */
export function mountEnterBuildNotes(opts) {
  const el = opts.overlay.querySelector('[data-enter-notes]');
  const bag = opts.overlay.querySelector('[data-enter-bag]');
  if (!(el instanceof HTMLElement)) return { destroy() {} };

  const composer = mountNotesComposer(el, {
    items: [...opts.itemsById.values()],
    itemsById: opts.itemsById,
    getSpriteUrl: opts.getSpriteUrl,
    getAllowedIds: () => boardMentionIds(opts.getPlacements()),
    maxLength: 500,
    onChange: opts.onChange,
  });
  composer.setNotes(opts.getNotes());

  const tip = createTooltipHover();
  const unbindTip = tip.bind(el, {
    selector: '.bpb-mention[data-item-id]',
    getItem: (node) =>
      node instanceof HTMLElement
        ? opts.itemsById.get(node.dataset.itemId || '') || null
        : null,
    place: 'itemRight',
  });

  /** @type {{ id: string, boardId: string, key: string, x: number, y: number, active: boolean, pointerId: number, ghost: HTMLImageElement | null, source: HTMLElement } | null} */
  let drag = null;

  function clearGhost() {
    drag?.ghost?.remove();
    if (drag) drag.ghost = null;
    el.classList.remove('is-drop-valid', 'is-drop-reject');
  }

  /**
   * @param {PointerEvent} ev
   */
  function onPointerDown(ev) {
    if (ev.button !== 0 || drag) return;
    const t = ev.target instanceof Element ? ev.target : null;
    const boardItem = t?.closest('.bpb-bg__item[data-item-id]');
    const gemEl = t?.closest('.bpb-bg__mark--gem[data-item-id]');
    const itemEl = gemEl || boardItem;
    if (!(itemEl instanceof HTMLElement) || !(bag instanceof HTMLElement)) return;
    if (!(boardItem instanceof HTMLElement)) return;
    const itemId = itemEl.getAttribute('data-item-id') || '';
    const boardId = boardItem.getAttribute('data-item-id') || '';
    if (!itemId || !boardMentionIds(opts.getPlacements()).has(itemId)) return;
    drag = {
      id: itemId,
      boardId,
      key: boardItem.dataset.placementKey || '',
      x: ev.clientX,
      y: ev.clientY,
      active: false,
      pointerId: ev.pointerId,
      ghost: null,
      source: itemEl,
    };
    try {
      itemEl.setPointerCapture(ev.pointerId);
    } catch {
      /* document listeners still follow the pointer */
    }
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
  }

  /**
   * @param {PointerEvent} ev
   */
  function onPointerMove(ev) {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    const dx = ev.clientX - drag.x;
    const dy = ev.clientY - drag.y;
    if (!drag.active && dx * dx + dy * dy < 36) return;
    if (!drag.active) {
      drag.active = true;
      drag.ghost = boardSpriteGhost(drag.source);
    }
    if (drag.ghost) placeNoteGhost(drag.ghost, ev.clientX, ev.clientY);
    const tier = opts.tierAt?.(ev.clientX, ev.clientY) || null;
    const tierItem = opts.itemsById.get(drag.boardId);
    const tierOk = Boolean(tier) && String(tierItem?.type || '') !== 'Bag' && Boolean(drag.key);
    opts.setTierHover?.(tierOk || tier ? tier?.el || null : null, tierOk);
    el.classList.toggle('is-drop-valid', !tier && composer.isOver(ev.clientX, ev.clientY));
  }

  /**
   * @param {PointerEvent} ev
   */
  function onPointerUp(ev) {
    if (!drag || ev.pointerId !== drag.pointerId) return;
    const active = drag.active;
    const itemId = drag.id;
    const boardId = drag.boardId;
    const key = drag.key;
    const tier = opts.tierAt?.(ev.clientX, ev.clientY) || null;
    const over = !tier && composer.isOver(ev.clientX, ev.clientY);
    clearGhost();
    opts.setTierHover?.(null, false);
    drag = null;
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
    if (active && tier && opts.onTierDrop?.(key, boardId, tier.priority)) return;
    if (active && over) {
      composer.insertItem(itemId, { clientX: ev.clientX, clientY: ev.clientY });
    }
  }

  function onDragStart(ev) {
    ev.preventDefault();
  }

  bag?.addEventListener('dragstart', onDragStart);
  bag?.addEventListener('pointerdown', onPointerDown);

  return {
    destroy() {
      clearGhost();
      opts.setTierHover?.(null, false);
      drag = null;
      bag?.removeEventListener('dragstart', onDragStart);
      bag?.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
      unbindTip();
      tip.destroy();
      composer.destroy();
    },
  };
}

/**
 * Floating copy of the board sprite — same pixel size and facing.
 * @param {HTMLElement} source
 * @returns {HTMLImageElement | null}
 */
function boardSpriteGhost(source) {
  const gem = source.matches('.bpb-bg__mark--gem') ? source : null;
  const live = source.querySelector('.bpb-bg__sprite.bpb-live');
  const sprite =
    gem instanceof HTMLImageElement
      ? gem
      : live?.querySelector('img.bpb-live__base, img.bpb-live__flask') ||
        source.querySelector('img.bpb-bg__sprite:not(.bpb-bg__sprite--shadow)');
  if (!(sprite instanceof HTMLImageElement)) return null;
  const src = sprite.currentSrc || sprite.getAttribute('src') || sprite.getAttribute('data-src') || '';
  if (!src) return null;
  const sized = live instanceof HTMLElement ? live : sprite;
  const ghost = document.createElement('img');
  ghost.className = 'event-enter__note-ghost';
  ghost.src = src;
  ghost.alt = '';
  ghost.draggable = false;
  const box = getComputedStyle(sized);
  ghost.style.width = box.width;
  ghost.style.height = box.height;
  let angle = 0;
  let node = /** @type {HTMLElement | null} */ (sprite);
  while (node && node !== document.body) {
    const rot = getComputedStyle(node).rotate;
    const m = rot && rot !== 'none' ? rot.match(/(-?[\d.]+)deg/) : null;
    if (m) angle += Number(m[1]);
    if (node.classList.contains('bpb-bg__item')) break;
    node = node.parentElement;
  }
  if (angle) ghost.style.rotate = `${angle}deg`;
  ghost.style.margin = '0';
  ghost.style.transform = 'none';
  ghost.style.translate = 'none';
  ghost.style.transformOrigin = 'center center';
  document.body.append(ghost);
  return ghost;
}

/**
 * Board-sized sprite, centered on the pointer.
 * @param {HTMLImageElement} ghost
 * @param {number} x
 * @param {number} y
 */
function placeNoteGhost(ghost, x, y) {
  const w = ghost.offsetWidth || Number.parseFloat(ghost.style.width) || 0;
  const h = ghost.offsetHeight || Number.parseFloat(ghost.style.height) || 0;
  ghost.style.left = `${x - w / 2}px`;
  ghost.style.top = `${y - h / 2}px`;
}
