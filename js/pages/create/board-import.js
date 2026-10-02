/**
 * Board stage drop / file picker for history.db + screenshot import.
 */

import { requirePremium } from '../../shared/premium-gate.js';
import { isTypingTarget } from '../../shared/is-typing-target.js';
import { SCREENSHOT_IMPORT_ENABLED } from '../../shared/feature-flags.js';
import { openHistoryDb } from './history-db.js';
import { openHistoryPicker } from './history-picker.js';

const HISTORY_NARROW_MQ = '(max-width: 1100px)';

function historyUploadEnabled() {
  return window.matchMedia(HISTORY_NARROW_MQ).matches !== true;
}

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
 * @param {File | Blob} file
 * @returns {boolean}
 */
function looksLikeImage(file) {
  if (String(file.type || '').startsWith('image/')) return true;
  if (file instanceof File) {
    return /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name || '');
  }
  return false;
}

/**
 * @param {HTMLElement} stageEl
 * @param {{
 *   state: ReturnType<import('./editor-state.js').createEditorState>,
 *   itemsById: Map<string, object>,
 *   getSpriteUrl: (item: object) => string,
 *   root: string,
 *   onHistoryPickerClose?: () => void,
 *   onScreenshotLoaded?: () => void,
 *   onScreenshotFile?: (file: File | Blob) => void,
 * }} opts
 */
export function mountBoardImport(stageEl, opts) {
  const { state, itemsById, getSpriteUrl } = opts;
  const root = opts.root.endsWith('/') ? opts.root : `${opts.root}/`;
  const boardEl =
    stageEl.closest('.create-board') instanceof HTMLElement
      ? /** @type {HTMLElement} */ (stageEl.closest('.create-board'))
      : stageEl;

  const historyInput = document.createElement('input');
  historyInput.type = 'file';
  historyInput.accept = '.db,application/x-sqlite3,application/octet-stream';
  historyInput.hidden = true;
  historyInput.setAttribute('data-history-file', '');
  document.body.appendChild(historyInput);

  const imageInput = document.createElement('input');
  imageInput.type = 'file';
  imageInput.accept = 'image/png,image/jpeg,image/webp,image/*';
  imageInput.hidden = true;
  imageInput.setAttribute('data-screenshot-file', '');
  document.body.appendChild(imageInput);

  /** @type {{ destroy: () => void } | null} */
  let picker = null;
  let dragDepth = 0;
  let importing = false;

  function openFilePicker() {
    if (!historyUploadEnabled()) return;
    historyInput.value = '';
    historyInput.click();
  }

  /**
   * Premium-gated image picker (Media button / resume intent).
   */
  function openMediaPicker() {
    if (!SCREENSHOT_IMPORT_ENABLED) return;
    void requirePremium({
      reason: 'Import a backpack screenshot onto the create board.',
      intentKey: 'create-screenshot-import',
      onGranted: () => {
        imageInput.value = '';
        imageInput.click();
      },
    });
  }

  /**
   * @param {File | Blob} file
   */
  async function handleScreenshot(file) {
    if (!SCREENSHOT_IMPORT_ENABLED) {
      showToast('Image import is not available at launch.');
      return;
    }
    if (importing) return;
    importing = true;
    opts.onScreenshotFile?.(file);
    showToast('Reading screenshot…', 120000);
    try {
      const { importScreenshotFile } = await import('./screenshot-apply.js?v=grid97');
      const result = await importScreenshotFile({
        state,
        itemsById,
        getSpriteUrl,
        root,
        file,
      });
      if (result.cancelled) {
        showToast('Import cancelled.');
        return;
      }
      const rejected = Number(result.rejected) || 0;
      const unrec = Number(result.unrecognized) || 0;
      const unrecNote = unrec
        ? ` ${unrec} unrecognized — replace or delete before publish.`
        : '';
      if (rejected > 0) {
        showToast(
          `Loaded ${result.placed} item${result.placed === 1 ? '' : 's'} (${rejected} vision guess${rejected === 1 ? '' : 'es'} rejected).${unrecNote}`,
          unrec ? 5600 : 3200,
        );
      } else {
        showToast(
          `Loaded ${result.placed} item${result.placed === 1 ? '' : 's'}.${unrecNote}`,
          unrec ? 5600 : 3200,
        );
      }
      opts.onScreenshotLoaded?.();
    } catch (err) {
      console.error(err);
      const code = /** @type {any} */ (err)?.code;
      if (code === 'premium_required') {
        void requirePremium({
          reason: 'Import a backpack screenshot onto the create board.',
          intentKey: 'create-screenshot-import',
          onGranted: () => {
            void handleScreenshot(file);
          },
        });
        return;
      }
      const offsize = code === 'offsize_grid';
      showToast(
        err instanceof Error ? err.message : "Couldn't read this image.",
        offsize ? 7000 : 3200,
      );
    } finally {
      importing = false;
    }
  }

  /**
   * @param {File} file
   */
  async function handleHistoryFile(file) {
    if (!historyUploadEnabled()) return;
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

  /**
   * @param {File} file
   */
  async function handleFile(file) {
    if (looksLikeImage(file)) {
      if (!SCREENSHOT_IMPORT_ENABLED) {
        showToast('Drop a history.db file to load a saved build.');
        return;
      }
      void requirePremium({
        reason: 'Import a backpack screenshot onto the create board.',
        intentKey: 'create-screenshot-import',
        onGranted: () => {
          void handleScreenshot(file);
        },
      });
      return;
    }
    if (!looksLikeHistoryDb(file) && !/\.db$/i.test(file.name || '')) {
      showToast(
        SCREENSHOT_IMPORT_ENABLED
          ? 'Drop a history.db or a backpack screenshot (PNG/JPEG/WebP).'
          : 'Drop a history.db file to load a saved build.',
      );
      return;
    }
    await handleHistoryFile(file);
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
  function onHistoryChange(e) {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.files?.length) return;
    void handleFile(t.files[0]);
  }

  /** @param {Event} e */
  function onImageChange(e) {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || !t.files?.length) return;
    // Picker already premium-gated via openMediaPicker
    void handleScreenshot(t.files[0]);
  }

  /**
   * @param {ClipboardEvent} e
   */
  function onPaste(e) {
    if (!SCREENSHOT_IMPORT_ENABLED) return;
    if (isTypingTarget(e.target)) return;
    const items = e.clipboardData?.items;
    if (!items?.length) return;
    for (const item of items) {
      if (!String(item.type || '').startsWith('image/')) continue;
      const blob = item.getAsFile();
      if (!blob) continue;
      e.preventDefault();
      void requirePremium({
        reason: 'Import a backpack screenshot onto the create board.',
        intentKey: 'create-screenshot-import',
        onGranted: () => {
          void handleScreenshot(blob);
        },
      });
      return;
    }
  }

  stageEl.addEventListener('dragenter', onDragEnter);
  stageEl.addEventListener('dragover', onDragOver);
  stageEl.addEventListener('dragleave', onDragLeave);
  stageEl.addEventListener('drop', onDrop);
  historyInput.addEventListener('change', onHistoryChange);
  imageInput.addEventListener('change', onImageChange);
  document.addEventListener('paste', onPaste);

  return {
    openFilePicker,
    openMediaPicker,
    /** @param {File | Blob} file */
    importScreenshot: (file) => handleScreenshot(file),
    /** @deprecated use openMediaPicker */
    notifyMediaSoon() {
      openMediaPicker();
    },
    destroy() {
      picker?.destroy();
      picker = null;
      stageEl.removeEventListener('dragenter', onDragEnter);
      stageEl.removeEventListener('dragover', onDragOver);
      stageEl.removeEventListener('dragleave', onDragLeave);
      stageEl.removeEventListener('drop', onDrop);
      historyInput.removeEventListener('change', onHistoryChange);
      imageInput.removeEventListener('change', onImageChange);
      document.removeEventListener('paste', onPaste);
      historyInput.remove();
      imageInput.remove();
      stageEl.classList.remove('is-import-hover');
    },
  };
}
