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
import { bindCreateParkFly, queueAutoParkFly } from './create-park-fly.js';
import { mountSellBin } from './sell-bin.js';
import { economyReadoutHtml, paintEconomyReadout } from './economy-readout.js';
import { premiumCtaFxHtml } from '../../shared/premium-cta.js';
import { requirePremium, resumePremiumIntent } from '../../shared/premium-gate.js';
import { isBoardAndParkEmpty, mountBoardOnboard } from './board-onboard.js?v=place-back';
import { mountBoardImport } from './board-import.js?v=bags2u';
import { mountLabelTool, wantLabelTool } from './label-tool.js?v=shells1';
import { mountHistoryEditGuard } from './history-edit-guard.js';
import { exportBoardPng } from './export-board-png.js';
import { isTypingTarget } from '../../shared/is-typing-target.js';
import { confirmDialog } from '../../shared/confirm-dialog.js';
import { SCREENSHOT_IMPORT_ENABLED } from '../../shared/feature-flags.js';

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
          <div class="create-board__export" data-export-wrap hidden>
            <button
              type="button"
              class="bpb-premium-cta bpb-premium-cta--orb bpb-premium-cta--toolbar create-board__gallery"
              data-act="export-png"
              title="Export PNG (Premium)"
              aria-label="Export board as PNG (Premium)"
              aria-haspopup="true"
              aria-expanded="false"
            >
              <span class="bpb-premium-cta__face" aria-hidden="true">
                ${premiumCtaFxHtml(rootBase)}
                <img
                  class="bpb-premium-cta__icon"
                  src="${rootBase}assets/icons/create/GalleryOrb.png"
                  alt=""
                  width="160"
                  height="160"
                  draggable="false"
                />
              </span>
            </button>
            <div
              class="create-board__export-menu"
              role="menu"
              aria-label="Export PNG options"
            >
              <button
                type="button"
                class="create-board__export-opt"
                role="menuitem"
                data-export-mode="all"
                title="Export bags and items"
              >
                All
              </button>
              <button
                type="button"
                class="create-board__export-opt"
                role="menuitem"
                data-export-mode="items"
                title="Export items only (no bags)"
              >
                Items
              </button>
              <button
                type="button"
                class="create-board__export-opt"
                role="menuitem"
                data-export-mode="bags"
                title="Export bags only"
              >
                Bags
              </button>
            </div>
          </div>
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
      <section
        class="create-board__park is-empty"
        data-board-park
        aria-label="Parked bags and items, 0 of 18 unique"
      >
        <div class="create-board__park-head">
          <h3 class="create-board__park-label">Parked</h3>
          <div class="create-board__park-meta">
            <span class="create-board__park-count" data-park-count aria-live="polite">0/18</span>
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
  const parkEl = host.querySelector('[data-board-park]');
  const boardRoot = host.querySelector('.create-board');
  const unlockBtn = host.querySelector('[data-act="unlock-history"]');
  const playSimLink = host.querySelector('[data-act="play-sim"]');
  const exportWrap = host.querySelector('[data-export-wrap]');
  const exportPngBtn = host.querySelector('[data-act="export-png"]');
  if (!(bagHost instanceof HTMLElement)) {
    return { destroy() {}, beginCatalogDrag() {}, isDragging: () => false };
  }

  const playSimUrl = `${rootBase}sim/`;
  /** @type {'all' | 'items' | 'bags'} */
  let pendingExportMode = 'all';

  function goPlaySim() {
    location.href = playSimUrl;
  }

  /**
   * @param {'all' | 'items' | 'bags'} [mode]
   */
  async function doExportPng(mode = 'all') {
    const draft = state.getDraft();
    const placements = draft.placements || [];
    if (!placements.length) {
      window.alert('Place items before exporting.');
      return;
    }
    if (exportPngBtn instanceof HTMLButtonElement) {
      exportPngBtn.disabled = true;
    }
    exportWrap?.querySelectorAll('[data-export-mode]').forEach((el) => {
      if (el instanceof HTMLButtonElement) el.disabled = true;
    });
    try {
      await exportBoardPng({
        placements,
        itemsById,
        getSpriteUrl,
        title: draft.title || 'untitled',
        root: rootBase,
        mode,
      });
    } catch (err) {
      console.error(err);
      window.alert(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      if (exportPngBtn instanceof HTMLButtonElement) {
        exportPngBtn.disabled = false;
      }
      exportWrap?.querySelectorAll('[data-export-mode]').forEach((el) => {
        if (el instanceof HTMLButtonElement) el.disabled = false;
      });
      exportWrap?.classList.remove('is-open');
      if (exportPngBtn instanceof HTMLButtonElement) {
        exportPngBtn.setAttribute('aria-expanded', 'false');
      }
    }
  }

  /**
   * @param {'all' | 'items' | 'bags'} mode
   */
  function requestExportPng(mode) {
    pendingExportMode = mode;
    const placements = state.getDraft().placements || [];
    if (!placements.length) {
      window.alert('Place items before exporting.');
      return;
    }
    const reason =
      mode === 'items'
        ? 'Export a PNG of your items (no bags).'
        : mode === 'bags'
          ? 'Export a PNG of your bags.'
          : 'Export a PNG of your backpack board.';
    void requirePremium({
      reason,
      intentKey: `create-export-png-${mode}`,
      onGranted: () => doExportPng(mode),
    });
  }

  const premiumResume = {
    'create-play-sim': goPlaySim,
    'create-export-png': () => {
      void doExportPng(pendingExportMode);
    },
    'create-export-png-all': () => {
      void doExportPng('all');
    },
    'create-export-png-items': () => {
      void doExportPng('items');
    },
    'create-export-png-bags': () => {
      void doExportPng('bags');
    },
  };
  if (SCREENSHOT_IMPORT_ENABLED) {
    premiumResume['create-screenshot-import'] = () => {
      boardImport?.openMediaPicker?.();
    };
  }
  void resumePremiumIntent(premiumResume);

  function syncAwaitingBuildChrome() {
    if (!(boardRoot instanceof HTMLElement)) return;
    boardRoot.classList.toggle('is-awaiting-build', isBoardAndParkEmpty(state.getDraft()));
  }

  function syncPlaySimChrome() {
    const hasItems = (state.getDraft().placements || []).length > 0;
    if (playSimLink instanceof HTMLAnchorElement) {
      playSimLink.hidden = !hasItems;
      if (hasItems) playSimLink.removeAttribute('aria-disabled');
      else playSimLink.setAttribute('aria-disabled', 'true');
    }
    if (exportWrap instanceof HTMLElement) {
      exportWrap.hidden = !hasItems;
      exportWrap.classList.toggle('is-open', false);
    }
    if (exportPngBtn instanceof HTMLButtonElement) {
      exportPngBtn.disabled = false;
      exportPngBtn.setAttribute('aria-expanded', 'false');
    }
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

  /** @type {{ openFilePicker: () => void, openMediaPicker?: () => void, importScreenshot: (file: File | Blob) => Promise<void>, destroy: () => void } | null} */
  let boardImport = null;
  /** @type {{ sync: () => void, destroy: () => void } | null} */
  let onboard = null;
  const labelTool =
    SCREENSHOT_IMPORT_ENABLED && wantLabelTool()
      ? mountLabelTool({ state, itemsById })
      : null;
  if (stageEl instanceof HTMLElement) {
    boardImport = mountBoardImport(stageEl, {
      state,
      itemsById,
      getSpriteUrl,
      root: rootBase,
      onHistoryPickerClose: () => onboard?.sync(),
      onScreenshotLoaded: () => onboard?.sync(),
      onScreenshotFile: (file) => labelTool?.setScreenshot(file),
    });
    onboard = mountBoardOnboard(stageEl, {
      state,
      itemsById,
      getSpriteUrl,
      root: rootBase,
      onRequestHistoryFile: () => boardImport?.openFilePicker(),
    });
    if (labelTool) {
      // Inbox (?shot=) re-runs import. A label-check edit (?fix=real-NNN) loads the saved board.
      setTimeout(() => {
        void labelTool.queuedFix().then(async (fix) => {
          if (fix) {
            state.replaceDraft({
              placements: fix.placements,
              parked: [],
              history: null,
            });
            return;
          }
          const file = await labelTool.queuedShot();
          if (file) void boardImport?.importScreenshot(file);
        });
      }, 0);
    }
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

  /** Placements currently painted on the bag from the active draft. */
  function getVisiblePlacements() {
    return state.getDraft().placements || [];
  }

  function stampKeys() {
    // Match the painted board — draft alone is wrong while the history scrubber
    // owns the bag, and wiping keys here breaks live tip CD merges.
    const placements = getVisiblePlacements();
    const items = grid.el.querySelectorAll('.bpb-bg__item:not(.bpb-bg__item--parked)');
    for (const el of items) {
      if (!(el instanceof HTMLElement)) continue;
      const id = el.getAttribute('data-item-id');
      const left = parseFloat(el.style.left);
      const top = parseFloat(el.style.top);
      const hit = placements.find(
        (p) =>
          p.id === id &&
          Number(p.x) === left &&
          Number(p.y) === top &&
          p.key != null &&
          String(p.key) !== '',
      );
      if (hit) el.dataset.placementKey = String(hit.key);
      // else keep paint-time dataset.placementKey (item-pool already stamped it)
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

  function paintEconomy() {
    paintEconomyReadout(host, {
      placements: state.getDraft().placements,
      itemsById,
      rootBase,
    });
  }

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
        queueAutoParkFly(floating);
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
    const exportModeBtn = t?.closest?.('[data-export-mode]');
    if (exportModeBtn instanceof HTMLElement && host.contains(exportModeBtn)) {
      e.preventDefault();
      const mode = exportModeBtn.getAttribute('data-export-mode');
      if (mode === 'all' || mode === 'items' || mode === 'bags') {
        requestExportPng(mode);
      }
      return;
    }
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
        const hasBoard = state.getDraft().placements.length > 0;
        const hasPark = (state.getParked?.() ?? []).length > 0;
        if (!hasBoard && !hasPark) return;
        const locked = Boolean(state.isHistoryLocked?.());
        const ok = await confirmDialog({
          title: 'Clear board?',
          body: locked
            ? 'Removes everything on the board and in Parked. Attached run history is cleared too.'
            : 'Removes everything on the board and in Parked.',
          confirmLabel: 'Clear',
          cancelLabel: 'Cancel',
          danger: true,
        });
        if (!ok) return;
        state.clearBoard();
      })();
      return;
    }
    if (act === 'clear-park') {
      void (async () => {
        const hasPark = (state.getParked?.() ?? []).length > 0;
        if (!hasPark) return;
        const locked = Boolean(state.isHistoryLocked?.());
        const ok = await confirmDialog({
          title: 'Clear parked?',
          body: locked
            ? 'Removes all parked items. Attached run history is cleared too.'
            : 'Removes all parked items.',
          confirmLabel: 'Clear',
          cancelLabel: 'Cancel',
          danger: true,
        });
        if (!ok) return;
        state.clearParked?.();
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
      return;
    }
    if (act === 'export-png') {
      e.preventDefault();
      // Touch / keyboard: toggle menu; hover also reveals options via CSS
      if (exportWrap instanceof HTMLElement) {
        const open = !exportWrap.classList.contains('is-open');
        exportWrap.classList.toggle('is-open', open);
        if (exportPngBtn instanceof HTMLButtonElement) {
          exportPngBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
      }
      return;
    }
  }

  // Close export menu when clicking elsewhere
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!(exportWrap instanceof HTMLElement) || !exportWrap.classList.contains('is-open')) {
        return;
      }
      const t = e.target instanceof Node ? e.target : null;
      if (t && exportWrap.contains(t)) return;
      exportWrap.classList.remove('is-open');
      if (exportPngBtn instanceof HTMLButtonElement) {
        exportPngBtn.setAttribute('aria-expanded', 'false');
      }
    },
    true,
  );

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (isTypingTarget(e.target)) return;
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

  const unbindParkFly =
    parkEl instanceof HTMLElement && grid.el instanceof HTMLElement
      ? bindCreateParkFly({
          boardRoot: grid.el,
          parkEl,
          itemsById,
          getSpriteUrl,
        })
      : () => {};

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
    syncAwaitingBuildChrome();
    const draft = state.getDraft();
    const placements = draft.placements;
    const parked = state.getParked?.() ?? draft.parked;
    const mode = state.getEditMode();
    const history = draft.history;

    if (history !== prevHistory) {
      prevHistory = history;
      syncHistoryLockChrome(Boolean(history));
      // History attach keeps the selected preview round in the draft; refresh
      // the lock and toolbar without adding a second round picker below.
      syncPlaySimChrome();
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
  syncAwaitingBuildChrome();
  syncPlaySimChrome();
  park.sync();

  return {
    beginCatalogDrag: session.beginCatalogDrag,
    isDragging: () => session.isDragging(),
    getVisiblePlacements,
    setMetaDrop(next) {
      session.setMetaDrop?.(next);
    },
    destroy() {
      unsub();
      unbindParkFly();
      historyLock?.destroy();
      onboard?.destroy();
      boardImport?.destroy();
      labelTool?.destroy();
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
