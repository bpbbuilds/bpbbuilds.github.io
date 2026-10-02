/**
 * Game-like History overlay in the create board column.
 */

import { applyHistoryRunToDraft } from '../history-apply.js';
import { createHistoryShell, positionHistoryShell } from './shell.js';
import { mountHistoryRunList } from './run-list.js';
import { mountHistoryPreview } from './preview-pane.js';

/**
 * @param {{
 *   boardEl: HTMLElement,
 *   state: ReturnType<import('../editor-state.js').createEditorState>,
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root: string,
 *   dbHandle: { db: any, runs: import('../history-db.js').HistoryRunSummary[], close: () => void },
 *   onLoaded?: () => void,
 *   onError?: (msg: string) => void,
 *   onClose?: () => void,
 *   returnFocusEl?: HTMLElement | null,
 * }} opts
 * @returns {{ destroy: () => void }}
 */
export function openHistoryPicker(opts) {
  const { boardEl, state, itemsById, getSpriteUrl, dbHandle } = opts;
  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  const returnFocusEl =
    opts.returnFocusEl instanceof HTMLElement
      ? opts.returnFocusEl
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

  const onboard = document.querySelector('[data-board-onboard]');
  if (onboard instanceof HTMLElement && !onboard.hidden) {
    onboard.hidden = true;
    onboard.style.display = 'none';
  }

  /* Toolbar (economy / layer toggles) shows through transparent History shell */
  boardEl.classList.add('is-history-open');

  const { rootEl } = createHistoryShell(root);
  document.body.appendChild(rootEl);

  const listEl = rootEl.querySelector('[data-history-list]');
  const filtersEl = rootEl.querySelector('[data-history-filters]');
  const previewHost = rootEl.querySelector('[data-history-preview]');
  if (
    !(listEl instanceof HTMLElement) ||
    !(filtersEl instanceof HTMLElement) ||
    !(previewHost instanceof HTMLElement)
  ) {
    throw new Error('History shell incomplete');
  }

  let closed = false;

  function position() {
    if (closed) return;
    positionHistoryShell(rootEl, boardEl);
  }

  /** @type {ReturnType<typeof mountHistoryRunList> | null} */
  let list = null;
  /** @type {ReturnType<typeof mountHistoryPreview> | null} */
  let preview = null;

  function destroy() {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', position, true);
    ro?.disconnect();
    list?.destroy();
    preview?.destroy();
    rootEl.remove();
    boardEl.classList.remove('is-history-open');
    dbHandle.close();
    opts.onClose?.();
    if (returnFocusEl?.isConnected) {
      try {
        returnFocusEl.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
  }

  preview = mountHistoryPreview({
    host: previewHost,
    db: dbHandle.db,
    itemsById,
    getSpriteUrl,
    root,
    onCancel: () => destroy(),
    onLoad: async ({ run, placements, roundIndex }) => {
      try {
        await applyHistoryRunToDraft({
          state,
          itemsById,
          run,
          root,
          placements,
          roundIndex,
        });
        // Close UI before success toast so a destroy error cannot look like a failed load.
        destroy();
        opts.onLoaded?.();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Could not load that board.';
        opts.onError?.(msg);
      }
    },
  });

  list = mountHistoryRunList({
    listEl,
    filtersEl,
    db: dbHandle.db,
    summaries: dbHandle.runs,
    itemsById,
    getSpriteUrl,
    root,
    onSelect: (runId, roundIndex) => {
      const summary = dbHandle.runs.find((r) => r.runId === runId);
      if (!summary) return;
      void preview?.showSummary(summary, roundIndex);
    },
    onActivate: () => {
      preview?.requestLoad();
    },
  });

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (e.key !== 'Escape') return;
    const openMenu = rootEl.querySelector('.create-history__dd-menu:not([hidden])');
    if (openMenu) return;
    e.preventDefault();
    destroy();
  }

  rootEl.querySelector('.create-history__close')?.addEventListener('click', () => {
    destroy();
  });

  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);

  /** @type {ResizeObserver | null} */
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => position());
    ro.observe(boardEl);
    const park = boardEl.querySelector?.('.create-board__park');
    if (park instanceof HTMLElement) ro.observe(park);
  }

  position();
  requestAnimationFrame(() => {
    position();
    void list?.ready();
  });

  const closeBtn = rootEl.querySelector('.create-history__close');
  if (closeBtn instanceof HTMLElement) closeBtn.focus();

  return { destroy };
}
