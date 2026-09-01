/**
 * Board stage drop / file picker for history.db (+ screenshot coming-soon).
 */

import { openHistoryDb } from './history-db.js';
import { openHistoryPicker } from './history-picker.js';

/**
 * @param {string} msg
 * @param {number} [ms]
 */
function showToast(msg, ms = 3200) {
  let el = document.querySelector('.create-import-toast');
  if (!(el instanceof HTMLElement)) {
    el = document.createElement('div');
    el.className = 'create-import-toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.hidden = false;
  el.textContent = msg;
  window.clearTimeout(/** @type {any} */ (el.dataset.timer));
  const timer = window.setTimeout(() => {
    el.hidden = true;
  }, ms);
  el.dataset.timer = String(timer);
}

/**
 * @param {File} file
 * @returns {boolean}
 */
function looksLikeHistoryDb(file) {
  const name = String(file.name || '').toLowerCase();
  if (name.endsWith('.db') || name === 'history.db') return true;
  const type = String(file.type || '').toLowerCase();
  return type.includes('sqlite') || type === 'application/x-sqlite3';
}

/**
 * @param {File} file
 * @returns {boolean}
 */
function looksLikeImage(file) {
  if (String(file.type || '').startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name || '');
}

/**
 * @param {HTMLElement} stageEl
 * @param {{
 *   state: ReturnType<import('./editor-state.js').createEditorState>,
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root: string,
 *   onHistoryPickerClose?: () => void,
 * }} opts
 */
export function mountBoardImport(stageEl, opts) {
  const { state, itemsById, getSpriteUrl } = opts;
  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  const boardEl =
    stageEl.closest('.create-board') instanceof HTMLElement
      ? /** @type {HTMLElement} */ (stageEl.closest('.create-board'))
      : stageEl;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.db,application/x-sqlite3,application/octet-stream';
  input.hidden = true;
  input.setAttribute('data-history-file', '');
  document.body.appendChild(input);

  /** @type {{ destroy: () => void } | null} */
  let picker = null;
  let dragDepth = 0;

  function openFilePicker() {
    input.value = '';
    input.click();
  }

  /**
   * @param {File} file
   */
  async function handleFile(file) {
    if (looksLikeImage(file)) {
      showToast('Screenshot import coming soon — drop a history.db for now.');
      return;
    }
    if (!looksLikeHistoryDb(file) && !/\.db$/i.test(file.name || '')) {
      showToast('Drop a history.db file (or a screenshot — coming soon).');
      return;
    }

    showToast('Reading history.db…', 8000);
    try {
      const buffer = await file.arrayBuffer();
      const handle = await openHistoryDb(buffer, root);
      if (!handle.runs.length) {
        handle.close();
        showToast('No runs found in that history.db.');
        return;
      }
      picker?.destroy();
      const focusEl =
        document.querySelector('[data-onboard-history]') instanceof HTMLElement
          ? /** @type {HTMLElement} */ (
              document.querySelector('[data-onboard-history]')
            )
          : document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      picker = openHistoryPicker({
        boardEl,
        state,
        itemsById,
        getSpriteUrl,
        root,
        dbHandle: handle,
        returnFocusEl: focusEl,
        onLoaded: () => showToast('Run loaded onto the board.'),
        onError: (msg) => showToast(msg),
        onClose: () => opts.onHistoryPickerClose?.(),
      });
    } catch (err) {
      console.error(err);
      showToast(
        err instanceof Error
          ? err.message
          : 'Could not open that history.db.',
      );
    }
  }

  /** @param {DragEvent} e */
  function onDragEnter(e) {
    e.preventDefault();
    dragDepth += 1;
    stageEl.classList.add('is-import-hover');
  }

  /** @param {DragEvent} e */
  function onDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }

  /** @param {DragEvent} e */
  function onDragLeave(e) {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) stageEl.classList.remove('is-import-hover');
  }

  /** @param {DragEvent} e */
  function onDrop(e) {
    e.preventDefault();
    dragDepth = 0;
    stageEl.classList.remove('is-import-hover');
    const file = e.dataTransfer?.files?.[0];
    if (file) void handleFile(file);
  }

  /** @param {Event} e */
  function onInputChange(e) {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.files?.length) return;
    void handleFile(t.files[0]);
  }

  stageEl.addEventListener('dragenter', onDragEnter);
  stageEl.addEventListener('dragover', onDragOver);
  stageEl.addEventListener('dragleave', onDragLeave);
  stageEl.addEventListener('drop', onDrop);
  input.addEventListener('change', onInputChange);

  return {
    openFilePicker,
    notifyMediaSoon() {
      showToast('Screenshot import coming soon — drop a history.db for now.');
    },
    destroy() {
      picker?.destroy();
      picker = null;
      stageEl.removeEventListener('dragenter', onDragEnter);
      stageEl.removeEventListener('dragover', onDragOver);
      stageEl.removeEventListener('dragleave', onDragLeave);
      stageEl.removeEventListener('drop', onDrop);
      input.removeEventListener('change', onInputChange);
      input.remove();
      stageEl.classList.remove('is-import-hover');
    },
  };
}
