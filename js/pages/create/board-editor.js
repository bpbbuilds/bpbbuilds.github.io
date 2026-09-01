/**
 * Create page — board mount, selection, toolbar, edit-mode layers.
 * Pointer drag lives in drag-session.js (game shop feel).
 */

import { mountPlacedGrid } from '../../shared/backpack-grid/index.js';
import {
  BOARD_COLS,
  BOARD_ROWS,
  canPlace,
  isBagItem,
  extractFloatingItems,
} from './collision.js';
import { EDIT_MODE } from './editor-state.js';
import { attachDragSession } from './drag-session.js';
import { mountParkStrip, parkedFromPlacement } from './park-strip.js';
import { mountSellBin } from './sell-bin.js';
import { economyReadoutHtml, paintEconomyReadout } from './economy-readout.js';
import { premiumCtaFxHtml } from '../../shared/premium-cta.js';
import { requirePremium, resumePremiumIntent } from '../../shared/premium-gate.js';
import { mountBoardOnboard } from './board-onboard.js';
import { mountBoardImport } from './board-import.js';
import { createHistoryScrubberController } from './history-scrubber.js';
import { mountHistoryEditGuard } from './history-edit-guard.js';

const CELL_PX = 96;

/**
 * @param {HTMLElement} host
 * @param {{
 *   state: ReturnType<import('./editor-state.js').createEditorState>,
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root?: string,
 * }} opts
 */
export function mountBoardEditor(host, opts) {
  const { state, itemsById, getSpriteUrl } = opts;
  const rootBase = (opts.root || '../').endsWith('/')
    ? opts.root || '../'
    : `${opts.root || '..'}/`;

  host.innerHTML = `
    <div class="create-board">
      <div class="create-board__toolbar" role="toolbar" aria-label="Board tools">
        <div class="create-board__toolbar-spacer">
          <button
            type="button"
            class="build-round__toggle create-board__toggle create-board__unlock"
            data-act="unlock-history"
            hidden
            title="Unlock board — clears attached run history"
            aria-label="Unlock board for editing"
          >
            <svg
              class="create-board__unlock-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 32 32"
              width="36"
              height="36"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M11.5 14.5V11a4.5 4.5 0 0 1 8.7-1.6"
                fill="none"
                stroke="#3c261d"
                stroke-width="2.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M11.5 14.5V11a4.5 4.5 0 0 1 8.7-1.6"
                fill="none"
                stroke="#eac914"
                stroke-width="1.35"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <rect
                x="7.25"
                y="14.25"
                width="17.5"
                height="13.5"
                rx="2.4"
                fill="#ffecdc"
                stroke="#3c261d"
                stroke-width="2.4"
              />
              <rect
                x="8.6"
                y="15.5"
                width="14.8"
                height="10.9"
                rx="1.5"
                fill="none"
                stroke="#eac914"
                stroke-width="1.1"
                opacity="0.85"
              />
              <circle cx="16" cy="20.2" r="1.85" fill="#3c261d" />
              <path
                d="M16 22v3.1"
                fill="none"
                stroke="#3c261d"
                stroke-width="2.2"
                stroke-linecap="round"
              />
              <circle cx="16" cy="20.2" r="0.95" fill="#eac914" />
            </svg>
          </button>
        </div>
        <div class="create-board__toolbar-center">
          <div class="create-board__modes build-round__toggles" role="group" aria-label="Edit layer">
            <button
              type="button"
              class="build-round__toggle create-board__toggle create-board__toggle--bags"
              data-mode="bagLayer"
              title="Bags only (2 / X) · click again for all"
              aria-label="Bags only"
              aria-pressed="false"
            >
              <img src="${rootBase}assets/icons/history/BagToggle-v3.png" alt="" width="40" height="40" draggable="false" />
            </button>
            <button
              type="button"
              class="build-round__toggle create-board__toggle create-board__toggle--items"
              data-mode="itemLayer"
              title="Items only (3 / C) · click again for all"
              aria-label="Items only"
              aria-pressed="false"
            >
              <img src="${rootBase}assets/icons/history/Sword.png" alt="" width="40" height="40" draggable="false" />
            </button>
          </div>
          <button
            type="button"
            class="build-round__toggle create-board__toggle create-board__toggle--clear"
            data-act="clear"
            title="Clear board"
            aria-label="Clear board"
          >
            <img src="${rootBase}assets/icons/filters/ResetButton.png" alt="" width="36" height="36" draggable="false" />
          </button>
          <a
            class="bpb-premium-cta bpb-premium-cta--orb bpb-premium-cta--toolbar create-board__play"
            href="${rootBase}sim/"
            data-act="play-sim"
            aria-label="Play in combat sandbox (Premium)"
            title="Play in combat sandbox (Premium)"
            hidden
          >
            <span class="bpb-premium-cta__face" aria-hidden="true">
              ${premiumCtaFxHtml(rootBase)}
              <img
                class="bpb-premium-cta__icon"
                src="${rootBase}assets/icons/sim/PlayOrb.png"
                alt=""
                width="160"
                height="160"
                draggable="false"
              />
            </span>
          </a>
        </div>
        ${economyReadoutHtml(rootBase)}
      </div>
      <div class="create-board__stage" data-board-stage>
        <div class="build-bag create-board__bag" data-board-bag aria-label="Build backpack"></div>
        <div class="create-board__ghost" data-board-ghost hidden aria-hidden="true"></div>
      </div>
      <div
        class="create-board__round build-round-host"
        data-create-round
        hidden
        aria-label="Run history rounds"
      ></div>
      <section
        class="create-board__park is-empty"
        data-board-park
        aria-label="Parked bags and items, 0 of 27 unique"
      >
        <div class="create-board__park-head">
          <h3 class="create-board__park-label">Parked</h3>
          <div class="create-board__park-meta">
            <span class="create-board__park-count" data-park-count aria-live="polite">0/27</span>
            <button
              type="button"
              class="create-board__park-clear"
              data-act="clear-park"
              title="Clear parked"
              aria-label="Clear parked items"
              disabled
            >
              <img src="${rootBase}assets/icons/history/ParkTrash.png" alt="" width="28" height="28" draggable="false" />
            </button>
          </div>
        </div>
        <div class="create-board__park-tray" data-park-tray></div>
      </section>
    </div>
  `;

  const bagHost = host.querySelector('[data-board-bag]');
  const ghostEl = host.querySelector('[data-board-ghost]');
  const stageEl = host.querySelector('[data-board-stage]');
  const roundHost = host.querySelector('[data-create-round]');
  const parkEl = host.querySelector('[data-board-park]');
  const boardRoot = host.querySelector('.create-board');
  const unlockBtn = host.querySelector('[data-act="unlock-history"]');
  const playSimLink = host.querySelector('[data-act="play-sim"]');
  if (!(bagHost instanceof HTMLElement)) {
    return { destroy() {}, beginCatalogDrag() {}, isDragging: () => false };
  }

  const playSimUrl = `${rootBase}sim/`;

  function goPlaySim() {
    location.href = playSimUrl;
  }

  void resumePremiumIntent({
    'create-play-sim': goPlaySim,
  });

  function syncPlaySimChrome() {
    if (!(playSimLink instanceof HTMLAnchorElement)) return;
    const hasItems = (state.getDraft().placements || []).length > 0;
    playSimLink.hidden = !hasItems;
    if (hasItems) playSimLink.removeAttribute('aria-disabled');
    else playSimLink.setAttribute('aria-disabled', 'true');
  }

  /** @param {boolean} locked */
  function syncHistoryLockChrome(locked) {
    if (boardRoot instanceof HTMLElement) {
      boardRoot.classList.toggle('is-history-attached', locked);
      boardRoot.classList.toggle('is-history-locked', locked);
    }
    if (unlockBtn instanceof HTMLButtonElement) {
      unlockBtn.hidden = !locked;
    }
  }

  /** @type {{ openFilePicker: () => void, destroy: () => void } | null} */
  let boardImport = null;
  /** @type {{ sync: () => void, destroy: () => void } | null} */
  let onboard = null;
  if (stageEl instanceof HTMLElement) {
    boardImport = mountBoardImport(stageEl, {
      state,
      itemsById,
      getSpriteUrl,
      root: rootBase,
      onHistoryPickerClose: () => onboard?.sync(),
    });
    onboard = mountBoardOnboard(stageEl, {
      state,
      itemsById,
      getSpriteUrl,
      root: rootBase,
      onRequestHistoryFile: () => boardImport?.openFilePicker(),
      onRequestMedia: () => boardImport?.notifyMediaSoon(),
    });
  }

  const sellBin = mountSellBin(document.body);

  /** @type {Set<string> | null} */
  let pendingFaceAnimKeys = null;
  /** @type {{ key?: string, fromDeg: number, durationMs: number } | null} */
  let pendingFaceContinue = null;

  const grid = mountPlacedGrid(bagHost, {
    placements: state.getDraft().placements,
    itemsById,
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
    getSpriteUrl,
    fillWidth: true,
    exactBoard: true,
    reserveScrollGap: false,
    cellPx: CELL_PX,
  });

  function stampKeys() {
    const placements = state.getDraft().placements;
    const items = grid.el.querySelectorAll('.bpb-bg__item:not(.bpb-bg__item--parked)');
    for (const el of items) {
      if (!(el instanceof HTMLElement)) continue;
      const id = el.getAttribute('data-item-id');
      const left = parseFloat(el.style.left);
      const top = parseFloat(el.style.top);
      const hit = placements.find(
        (p) => p.id === id && Number(p.x) === left && Number(p.y) === top,
      );
      if (hit) el.dataset.placementKey = hit.key;
      else delete el.dataset.placementKey;
    }
    paintSelection();
    paintLayerDim();
  }

  function paintSelection() {
    /* Selection kept for Del/R shortcuts — no square highlight chrome */
    grid.el.querySelectorAll('.bpb-bg__item.is-selected').forEach((el) => {
      el.classList.remove('is-selected');
    });
  }

  function paintModeChrome() {
    const mode = state.getEditMode();
    if (boardRoot instanceof HTMLElement) {
      boardRoot.classList.toggle('is-edit-bags', mode === EDIT_MODE.BAG_LAYER);
      boardRoot.classList.toggle('is-edit-items', mode === EDIT_MODE.ITEM_LAYER);
    }
    host.querySelectorAll('[data-mode]').forEach((btn) => {
      if (!(btn instanceof HTMLElement)) return;
      const pressed = btn.dataset.mode === mode;
      btn.classList.toggle('is-on', pressed);
      btn.classList.toggle('is-pressed', pressed);
      btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    });
    paintLayerDim();
  }

  /** @type {object[] | null} placements shown by history scrubber (not written to draft) */
  let historyViewPlacements = null;

  function paintEconomy() {
    paintEconomyReadout(host, {
      placements: historyViewPlacements || state.getDraft().placements,
      itemsById,
      rootBase,
    });
  }

  /** @type {ReturnType<typeof createHistoryScrubberController> | null} */
  let historyScrubber =
    roundHost instanceof HTMLElement
      ? createHistoryScrubberController({
          host: roundHost,
          bagHost,
          grid,
          itemsById,
          root: rootBase,
          getPlacements: () => state.getDraft().placements,
          onFrame: (placements) => {
            historyViewPlacements = placements || null;
            paintEconomy();
            paintModeChrome();
          },
        })
      : null;

  function paintLayerDim() {
    const mode = state.getEditMode();
    const items = grid.el.querySelectorAll('.bpb-bg__item:not(.bpb-bg__item--parked)');
    for (const el of items) {
      if (!(el instanceof HTMLElement)) continue;
      const id = el.getAttribute('data-item-id');
      const item = id ? itemsById.get(id) : null;
      const bag = isBagItem(item);
      let dim = false;
      if (mode === EDIT_MODE.BAG_LAYER) dim = !bag;
      else if (mode === EDIT_MODE.ITEM_LAYER) dim = bag;
      el.classList.toggle('is-layer-dim', dim);
    }
  }

  function syncBoard() {
    // History scrubber owns the bag paint while attached (preview frames).
    if (historyScrubber?.active && historyViewPlacements) {
      stampKeys();
      paintModeChrome();
      paintEconomy();
      return;
    }
    const faceKeys = pendingFaceAnimKeys;
    pendingFaceAnimKeys = null;
    const cont = pendingFaceContinue;
    pendingFaceContinue = null;
    /** @type {Map<string, { fromDeg: number, durationMs?: number }> | undefined} */
    let faceContinue;
    if (cont && Number.isFinite(cont.fromDeg)) {
      const key = cont.key || state.getSelectedKey();
      if (key) {
        faceContinue = new Map([
          [key, { fromDeg: cont.fromDeg, durationMs: cont.durationMs }],
        ]);
      }
    }
    grid.update(state.getDraft().placements, itemsById, {
      animateFaceKeys: faceKeys || undefined,
      faceContinue,
    });
    stampKeys();
    paintModeChrome();
    paintEconomy();
    syncPlaySimChrome();
  }

  /**
   * Game setInventoryEditMode — Bags/Items toggle off → Default; cleanup on enter Default.
   * @param {import('./editor-state.js').EditMode} next
   */
  function applyEditMode(next) {
    if (session.isDragging()) return;
    const prev = state.getEditMode();
    if (prev === next) return;
    state.setEditMode(next);
    if (next === EDIT_MODE.DEFAULT) {
      const { kept, floating } = extractFloatingItems(
        state.getDraft().placements,
        itemsById,
      );
      if (floating.length) {
        state.setPlacements(kept);
        state.appendParked?.(floating.map((p) => parkedFromPlacement(p)));
      }
    }
    paintModeChrome();
  }

  /** @param {'default' | 'bagLayer' | 'itemLayer'} mode */
  function onModeButton(mode) {
    if (session.isDragging()) return;
    const cur = state.getEditMode();
    if (mode === EDIT_MODE.DEFAULT) {
      applyEditMode(EDIT_MODE.DEFAULT);
      return;
    }
    // Bags / Items toggle off → Default (EditModeButtons.gd)
    if (cur === mode) applyEditMode(EDIT_MODE.DEFAULT);
    else applyEditMode(mode);
  }

  async function rotateSelected() {
    if (state.isHistoryLocked?.() && !(await state.requestHistoryUnlock())) return;
    const key = state.getSelectedKey();
    if (!key) return;
    const p = state.getDraft().placements.find((x) => x.key === key);
    if (!p) return;
    const item = itemsById.get(p.id);
    if (!item) return;
    const nextR = (p.r + 1) % 4;
    if (
      !canPlace(
        item,
        { x: p.x, y: p.y, r: nextR },
        state.getDraft().placements,
        itemsById,
        key,
        state.getEditMode(),
      )
    ) {
      return;
    }
    pendingFaceAnimKeys = new Set([key]);
    state.updatePlacement(key, { r: nextR });
  }

  async function deleteSelected() {
    if (state.isHistoryLocked?.() && !(await state.requestHistoryUnlock())) return;
    const key = state.getSelectedKey();
    if (!key) return;
    // Del bag: remove bag only — cargo placements stay (may float until Default cleanup)
    state.removePlacement(key);
  }

  /** @param {MouseEvent} e */
  function onToolbarClick(e) {
    const t = e.target instanceof Element ? e.target : null;
    const modeBtn = t?.closest?.('[data-mode]');
    if (modeBtn instanceof HTMLElement && host.contains(modeBtn)) {
      const mode = modeBtn.dataset.mode;
      if (mode === EDIT_MODE.BAG_LAYER || mode === EDIT_MODE.ITEM_LAYER) {
        onModeButton(mode);
      }
      return;
    }
    const btn = t?.closest?.('[data-act]');
    if (!(btn instanceof HTMLElement) || !host.contains(btn)) return;
    const act = btn.dataset.act;
    if (act === 'unlock-history') {
      void state.requestHistoryUnlock?.();
      return;
    }
    if (act === 'clear') {
      void (async () => {
        if (state.isHistoryLocked?.() && !(await state.requestHistoryUnlock())) return;
        const hasBoard = state.getDraft().placements.length > 0;
        const hasPark = (state.getParked?.() ?? []).length > 0;
        if ((hasBoard || hasPark) && !confirm('Clear the board and parked items?')) return;
        state.clearBoard();
      })();
      return;
    }
    if (act === 'clear-park') {
      void (async () => {
        const hasPark = (state.getParked?.() ?? []).length > 0;
        if (!hasPark) return;
        if (state.isHistoryLocked?.() && !(await state.requestHistoryUnlock())) return;
        if (!confirm('Clear all parked items?')) return;
        state.setParked?.([]);
      })();
      return;
    }
    if (act === 'play-sim') {
      if (btn.getAttribute('aria-disabled') === 'true') {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      void requirePremium({
        reason: 'Play your build in the combat sandbox.',
        intentKey: 'create-play-sim',
        onGranted: goPlaySim,
      });
    }
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) {
      return;
    }
    if (session.isDragging()) return;
    if (e.key === '1' || e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      onModeButton(EDIT_MODE.DEFAULT);
      return;
    }
    if (e.key === '2' || e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      onModeButton(EDIT_MODE.BAG_LAYER);
      return;
    }
    if (e.key === '3' || e.key === 'c' || e.key === 'C') {
      e.preventDefault();
      onModeButton(EDIT_MODE.ITEM_LAYER);
      return;
    }
    // Leave Ctrl/Cmd(+Shift)+R to the browser (hard refresh, etc.)
    if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      rotateSelected();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
    } else if (e.key === 'Escape') {
      state.setSelectedKey(null);
      paintSelection();
    }
  }

  const session = attachDragSession({
    host,
    grid,
    ghostEl: ghostEl instanceof HTMLElement ? ghostEl : null,
    stageEl: stageEl instanceof HTMLElement ? stageEl : null,
    parkEl: parkEl instanceof HTMLElement ? parkEl : null,
    sellEl: sellBin.el,
    state,
    itemsById,
    getSpriteUrl,
    cellPx: CELL_PX,
    onSelectKey(key) {
      state.setSelectedKey(key);
      paintSelection();
    },
    /** Hand off mid-rotate float spin to the placed item (Item.rotationTween). */
    onFaceContinue(cont) {
      pendingFaceContinue = cont;
    },
  });

  const park = parkEl instanceof HTMLElement
    ? mountParkStrip(parkEl, {
      state,
      itemsById,
      getSpriteUrl,
      beginParkDrag: (itemId, x, y, pointerId, sourceEl) =>
        session.beginParkDrag?.(itemId, x, y, pointerId, sourceEl) ?? false,
    })
    : { sync() {}, destroy() {} };

  let prevPlacements = state.getDraft().placements;
  let prevParked = state.getParked?.() ?? state.getDraft().parked;
  let prevMode = state.getEditMode();
  let prevHistory = state.getDraft().history;
  const unsub = state.subscribe(() => {
    const draft = state.getDraft();
    const placements = draft.placements;
    const parked = state.getParked?.() ?? draft.parked;
    const mode = state.getEditMode();
    const history = draft.history;

    if (history !== prevHistory) {
      prevHistory = history;
      if (!history) historyViewPlacements = null;
      historyScrubber?.sync(history || null);
      syncHistoryLockChrome(Boolean(history));
    }

    // Selection-only emits must not re-paint the board (would fight drag-source hide)
    if (placements !== prevPlacements) {
      prevPlacements = placements;
      prevMode = mode;
      syncBoard();
    } else if (mode !== prevMode) {
      prevMode = mode;
      paintModeChrome();
    } else if (history === prevHistory) {
      paintSelection();
    }
    if (parked !== prevParked) {
      prevParked = parked;
      park.sync();
    }
  });

  // Initial attach (draft restored from localStorage with history)
  if (prevHistory) {
    historyScrubber?.sync(prevHistory);
  }
  syncHistoryLockChrome(Boolean(prevHistory));

  const historyLock =
    stageEl instanceof HTMLElement
      ? mountHistoryEditGuard({ stageEl, state })
      : null;

  host.addEventListener('click', onToolbarClick);
  window.addEventListener('keydown', onKey);
  stampKeys();
  paintModeChrome();
  paintEconomy();
  syncPlaySimChrome();
  park.sync();

  return {
    beginCatalogDrag: session.beginCatalogDrag,
    isDragging: () => session.isDragging(),
    setMetaDrop(next) {
      session.setMetaDrop?.(next);
    },
    destroy() {
      unsub();
      historyLock?.destroy();
      historyScrubber?.destroy();
      historyScrubber = null;
      onboard?.destroy();
      boardImport?.destroy();
      park.destroy();
      sellBin.destroy();
      session.destroy();
      host.removeEventListener('click', onToolbarClick);
      window.removeEventListener('keydown', onKey);
      try {
        grid.destroy?.({ keepHost: true });
      } catch {
        /* ignore */
      }
      host.replaceChildren();
    },
  };
}
