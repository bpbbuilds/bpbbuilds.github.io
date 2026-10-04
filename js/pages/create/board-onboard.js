/**
 * Empty-board onboarding overlay — class → starting bag → auto-place.
 *
 * Mounted on document.body (fixed) so backpack hit-pads cannot steal clicks.
 * Reappears whenever the board and park strip are both empty (unless Skip).
 */

import { HERO_CLASSES } from '../items/filter-logic.js';
import { startingBagIdsForClass } from '../../shared/starting-bags.js';
import { isBagItem } from './collision.js';
import { getCurrentDrag } from './drag-source.js';
import { tryAutoPlaceStartingBag } from './starting-bag-place.js';

/** Skip only — cleared again after the board/park have had content. */
const SKIP_KEY = 'bpb-create-onboard-skip:v3';

/** Windows Godot userdata parent — paste into Explorer address bar. */
const HISTORY_DB_DIR =
  '%APPDATA%\\Godot\\app_userdata\\Backpack Battles';

/**
 * @returns {boolean}
 */
export function isOnboardSkipped() {
  try {
    return sessionStorage.getItem(SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboardSkipped() {
  try {
    sessionStorage.setItem(SKIP_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function clearOnboardSkipped() {
  try {
    sessionStorage.removeItem(SKIP_KEY);
  } catch {
    /* private mode */
  }
}

/** @deprecated use isOnboardSkipped */
export const isOnboardDismissed = isOnboardSkipped;
/** @deprecated use markOnboardSkipped */
export const markOnboardDone = markOnboardSkipped;

/**
 * @param {import('./draft-io.js').Draft} draft
 * @returns {boolean}
 */
export function isBoardAndParkEmpty(draft) {
  return !draft.placements?.length && !draft.parked?.length;
}

/**
 * @param {import('./draft-io.js').Draft} draft
 * @returns {boolean}
 */
export function shouldShowOnboard(draft) {
  if (!isBoardAndParkEmpty(draft)) return false;
  if (isOnboardSkipped()) return false;
  return true;
}

/**
 * @param {HTMLElement} stageEl
 * @param {{
 *   state: ReturnType<import('./editor-state.js').createEditorState>,
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root: string,
 *   onRequestHistoryFile?: () => void,
 * }} opts
 */
export function mountBoardOnboard(stageEl, opts) {
  const { state, itemsById, getSpriteUrl } = opts;
  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;

  /** @type {'class' | 'bag'} */
  let step = 'class';
  /** @type {string | null} */
  let sessionHero = null;
  /** After the user had items, emptying board+park clears Skip and reopens. */
  let hadContent = !isBoardAndParkEmpty(state.getDraft());
  /** Catalog drag over an empty board — drop hint instead of the class picker. */
  let placingBack = false;
  /** Catalog drag is a bag (true), an item (false), or unknown (null). */
  let draggingBag = null;

  const overlay = document.createElement('div');
  overlay.className = 'create-onboard';
  overlay.hidden = true;
  overlay.setAttribute('data-board-onboard', '');
  overlay.setAttribute('data-step', 'class');
  overlay.innerHTML = `
    <div class="create-onboard__panel" data-onboard-panel>
      <div class="create-onboard__head">
        <button type="button" class="create-onboard__back" data-onboard-back hidden aria-label="Pick another class"></button>
        <h2 class="create-onboard__title build-info__ui-text" data-onboard-title>Pick a class to begin</h2>
      </div>
      <div class="create-onboard__grid create-onboard__grid--classes" data-onboard-classes role="group" aria-label="Hero class"></div>
      <div class="create-onboard__grid create-onboard__grid--bags" data-onboard-bags role="group" aria-label="Starting bag"></div>
      <div class="create-onboard__actions">
        <p class="create-onboard__or">or upload a build</p>
        <div class="create-onboard__upload">
          <div class="create-onboard__upload-col">
            <button type="button" class="create-onboard__btn create-onboard__btn--dashed create-onboard__btn--history" data-onboard-history>
              <span class="create-onboard__history-label">history.db</span>
              <code class="create-onboard__history-path" data-onboard-path>${HISTORY_DB_DIR}</code>
            </button>
            <button type="button" class="create-onboard__path-copy" data-onboard-copy-path>Copy path</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const titleEl = overlay.querySelector('[data-onboard-title]');
  const classesEl = overlay.querySelector('[data-onboard-classes]');
  const bagsEl = overlay.querySelector('[data-onboard-bags]');
  const copyPathBtn = overlay.querySelector('[data-onboard-copy-path]');
  const panelEl = overlay.querySelector('[data-onboard-panel]');

  /**
   * Stage only (toolbar + park excluded) — panel centers in the empty board area.
   * Falls back to board-minus-park if stage has no size yet.
   */
  function stageAnchorRect() {
    const stageRect = stageEl.getBoundingClientRect();
    if (stageRect.width > 1 && stageRect.height > 1) {
      return stageRect;
    }
    const board = stageEl.closest('.create-board');
    const park = board?.querySelector?.('.create-board__park');
    if (board instanceof HTMLElement) {
      const br = board.getBoundingClientRect();
      const parkTop =
        park instanceof HTMLElement
          ? park.getBoundingClientRect().top
          : br.bottom;
      return new DOMRect(br.left, br.top, br.width, Math.max(0, parkTop - br.top));
    }
    return stageRect;
  }

  /**
   * Cover the board stage and pin the panel to its geometric center.
   * Absolute + translate is more reliable than flex alone (height/display races).
   */
  function positionOverBoard() {
    if (overlay.hidden) return;
    const rect = stageAnchorRect();
    const top = Math.round(rect.top);
    const left = Math.round(rect.left);
    const width = Math.max(0, Math.round(rect.width));
    const height = Math.max(0, Math.round(rect.height));

    overlay.style.cssText = [
      'position:fixed',
      `top:${top}px`,
      `left:${left}px`,
      `width:${width}px`,
      `height:${height}px`,
      'right:auto',
      'bottom:auto',
      'z-index:200000',
      'display:block',
      'box-sizing:border-box',
      'padding:0',
      'margin:0',
      'background:transparent',
      `pointer-events:${placingBack ? 'none' : 'auto'}`,
      'transform:none',
    ].join(';');
    if (panelEl instanceof HTMLElement) {
      panelEl.style.pointerEvents = placingBack ? 'none' : '';
    }

    if (panelEl instanceof HTMLElement) {
      panelEl.style.position = 'absolute';
      panelEl.style.top = '50%';
      panelEl.style.left = '50%';
      panelEl.style.right = 'auto';
      panelEl.style.transform = 'translate(-50%, -50%)';
      panelEl.style.margin = '0';
    }
  }

  function paintClasses() {
    if (!(classesEl instanceof HTMLElement)) return;
    classesEl.replaceChildren();
    for (const c of HERO_CLASSES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'create-onboard__icon-btn';
      btn.title = c;
      btn.setAttribute('aria-label', c);
      btn.dataset.onboardClass = c;
      const img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      img.src = `${root}assets/icons/classes/${c}Icon.png`;
      btn.append(img);
      btn.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          pickClass(c);
        },
        true,
      );
      classesEl.append(btn);
    }
  }

  /** @param {string} hero */
  function paintBags(hero) {
    if (!(bagsEl instanceof HTMLElement)) return;
    bagsEl.replaceChildren();
    for (const id of startingBagIdsForClass(hero)) {
      const item = itemsById.get(id);
      const name = String(item?.name || id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'create-onboard__icon-btn create-onboard__icon-btn--bag';
      btn.title = name;
      btn.setAttribute('aria-label', name);
      btn.dataset.onboardBag = id;
      const img = document.createElement('img');
      img.alt = '';
      img.draggable = false;
      img.src = item ? getSpriteUrl(item) : '';
      btn.append(img);
      btn.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          pickBag(id);
        },
        true,
      );
      bagsEl.append(btn);
    }
  }

  function applyStepDom() {
    const showBags = step === 'bag' && Boolean(sessionHero);
    overlay.dataset.step = showBags ? 'bag' : 'class';
    if (classesEl instanceof HTMLElement) {
      classesEl.style.display = showBags ? 'none' : 'flex';
    }
    if (bagsEl instanceof HTMLElement) {
      bagsEl.style.display = showBags ? 'flex' : 'none';
    }
    if (titleEl instanceof HTMLElement && !placingBack) {
      titleEl.textContent = showBags
        ? 'Pick a starting bag'
        : 'Pick a class to begin';
    }
    const backBtn = overlay.querySelector('[data-onboard-back]');
    if (backBtn instanceof HTMLButtonElement) backBtn.hidden = !showBags;
    if (showBags && sessionHero) {
      paintBags(sessionHero);
    } else if (!showBags) {
      if (classesEl instanceof HTMLElement && !classesEl.childElementCount) {
        paintClasses();
      }
    }
  }

  /** Cleared board — always start over at class, not the bag step. */
  function resetStepForEmptyBoard() {
    sessionHero = null;
    step = 'class';
    const d = state.getDraft();
    if (d.hero_class || d.starting_bag_id) {
      state.patchMeta({ hero_class: null, starting_bag_id: null });
    }
  }

  function backToClass() {
    sessionHero = null;
    step = 'class';
    applyStepDom();
    const d = state.getDraft();
    if (d.hero_class || d.starting_bag_id) {
      queueMicrotask(() => {
        state.patchMeta({ hero_class: null, starting_bag_id: null });
      });
    }
  }

  /** @param {string} hero */
  function pickClass(hero) {
    if (!HERO_CLASSES.includes(hero)) return;
    sessionHero = hero;
    step = 'bag';
    applyStepDom();
    queueMicrotask(() => {
      state.patchMeta({ hero_class: hero, starting_bag_id: null });
    });
  }

  /** @param {string} bagId */
  function pickBag(bagId) {
    const hero = sessionHero || state.getDraft().hero_class || '';
    if (!bagId || !HERO_CLASSES.includes(hero)) return;
    if (!itemsById.has(bagId)) {
      console.warn('[create-onboard] missing bag in catalog', bagId);
      return;
    }
    const placed = tryAutoPlaceStartingBag({
      state,
      itemsById,
      itemId: bagId,
    });
    if (!placed) {
      console.warn('[create-onboard] could not auto-place', bagId);
      return;
    }
    state.patchMeta({
      hero_class: hero,
      starting_bag_id: bagId,
    });
    // Hide via non-empty board — do not Skip-lock
    syncVisibility();
  }

  function syncVisibility() {
    const draft = state.getDraft();
    const empty = isBoardAndParkEmpty(draft);

    if (!empty) {
      hadContent = true;
      placingBack = false;
      overlay.classList.remove('is-place-back');
      overlay.hidden = true;
      overlay.style.display = 'none';
      return;
    }

    // Cleared board + park after having items → allow dialog again
    if (hadContent) {
      clearOnboardSkipped();
      hadContent = false;
      resetStepForEmptyBoard();
    }

    if (isOnboardSkipped()) {
      overlay.hidden = true;
      overlay.style.display = 'none';
      return;
    }

    overlay.hidden = false;
    if (placingBack) {
      showPlaceBack();
    } else {
      applyStepDom();
    }
    positionOverBoard();
  }

  function showPlaceBack() {
    placingBack = true;
    overlay.classList.add('is-place-back');
    overlay.classList.toggle('is-item-warning', draggingBag === false);
    if (titleEl instanceof HTMLElement) {
      titleEl.textContent = draggingBag === false
        ? 'Please place a bag before placing an item'
        : 'Place Bag Here';
    }
  }

  function onCatalogDrag() {
    if (!isBoardAndParkEmpty(state.getDraft()) || isOnboardSkipped()) return;
    const drag = getCurrentDrag();
    const item = drag?.itemId ? itemsById.get(drag.itemId) : null;
    draggingBag = item ? isBagItem(item) : null;
    showPlaceBack();
    overlay.hidden = false;
    positionOverBoard();
  }

  function onCatalogDragEnd() {
    if (!placingBack) return;
    placingBack = false;
    draggingBag = null;
    overlay.classList.remove('is-place-back', 'is-item-warning');
    syncVisibility();
  }

  async function copyHistoryPath() {
    try {
      await navigator.clipboard.writeText(HISTORY_DB_DIR);
      if (copyPathBtn instanceof HTMLElement) {
        const prev = copyPathBtn.textContent;
        copyPathBtn.textContent = 'Copied!';
        window.setTimeout(() => {
          if (copyPathBtn.textContent === 'Copied!') {
            copyPathBtn.textContent = prev || 'Copy path';
          }
        }, 1600);
      }
    } catch {
      /* private mode / denied — leave label */
    }
  }

  /** @param {MouseEvent} e */
  function onActionClick(e) {
    const t = e.target instanceof Element ? e.target : null;
    if (!t || !overlay.contains(t)) return;
    if (t.closest('[data-onboard-back]')) {
      e.preventDefault();
      backToClass();
      return;
    }
    if (t.closest('[data-onboard-copy-path]')) {
      e.preventDefault();
      void copyHistoryPath();
      return;
    }
    if (t.closest('[data-onboard-history]')) {
      e.preventDefault();
      opts.onRequestHistoryFile?.();
      return;
    }
  }

  paintClasses();
  if (bagsEl instanceof HTMLElement) bagsEl.style.display = 'none';
  overlay.addEventListener('click', onActionClick);
  document.addEventListener('bpb-create-drag', onCatalogDrag);
  document.addEventListener('bpb-create-drag-end', onCatalogDragEnd);
  window.addEventListener('resize', positionOverBoard);
  window.addEventListener('scroll', positionOverBoard, true);

  const unsub = state.subscribe(() => {
    syncVisibility();
  });

  /** @type {ResizeObserver | null} */
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => positionOverBoard());
    ro.observe(stageEl);
    const board = stageEl.closest('.create-board');
    if (board instanceof HTMLElement) ro.observe(board);
  }

  // After layout settles (catalog/fonts), re-measure board box
  requestAnimationFrame(() => {
    requestAnimationFrame(() => positionOverBoard());
  });

  syncVisibility();

  return {
    sync: syncVisibility,
    destroy() {
      unsub();
      ro?.disconnect();
      overlay.removeEventListener('click', onActionClick);
      document.removeEventListener('bpb-create-drag', onCatalogDrag);
      document.removeEventListener('bpb-create-drag-end', onCatalogDragEnd);
      window.removeEventListener('resize', positionOverBoard);
      window.removeEventListener('scroll', positionOverBoard, true);
      overlay.remove();
    },
  };
}
