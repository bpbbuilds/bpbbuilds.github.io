/**
 * Site confirm dialog — parchment Patch3 panel (replaces window.confirm).
 * Promise resolves true on confirm, false on cancel / Escape / backdrop.
 */

/**
 * @typedef {{
 *   title?: string,
 *   body?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   danger?: boolean,
 * }} ConfirmDialogOpts
 */

let seq = 0;

/**
 * @param {ConfirmDialogOpts} [opts]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(opts = {}) {
  const title = String(opts.title || 'Are you sure?');
  const body = String(opts.body || '');
  const confirmLabel = String(opts.confirmLabel || 'Confirm');
  const cancelLabel = String(opts.cancelLabel || 'Cancel');
  const danger = Boolean(opts.danger);
  const titleId = `bpb-confirm-title-${++seq}`;
  const descId = `bpb-confirm-desc-${seq}`;

  const root = document.createElement('div');
  root.className = 'bpb-confirm';
  root.setAttribute('role', 'presentation');
  root.innerHTML = `
    <div class="bpb-confirm__backdrop" data-confirm-cancel tabindex="-1"></div>
    <div
      class="bpb-confirm__panel"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="${titleId}"
      ${body ? `aria-describedby="${descId}"` : ''}
    >
      <h2 class="bpb-confirm__title bpb-label-text" id="${titleId}">${escapeHtml(title)}</h2>
      ${
        body
          ? `<p class="bpb-confirm__body" id="${descId}">${escapeHtml(body)}</p>`
          : ''
      }
      <div class="bpb-confirm__actions">
        <button type="button" class="bpb-confirm__btn bpb-confirm__btn--cancel" data-confirm-cancel>
          ${escapeHtml(cancelLabel)}
        </button>
        <button
          type="button"
          class="bpb-confirm__btn bpb-confirm__btn--confirm${danger ? ' bpb-confirm__btn--danger' : ''}"
          data-confirm-ok
        >
          ${escapeHtml(confirmLabel)}
        </button>
      </div>
    </div>
  `;

  /** @type {((ok: boolean) => void) | null} */
  let resolveAsk = null;
  let settled = false;

  function finish(ok) {
    if (settled) return;
    settled = true;
    document.body.classList.remove('bpb-confirm-open');
    root.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey, true);
    root.remove();
    resolveAsk?.(ok);
    resolveAsk = null;
  }

  /** @param {MouseEvent} e */
  function onClick(e) {
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest?.('[data-confirm-ok]')) {
      e.preventDefault();
      finish(true);
      return;
    }
    if (t?.closest?.('[data-confirm-cancel]')) {
      e.preventDefault();
      finish(false);
    }
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    }
  }

  document.body.appendChild(root);
  document.body.classList.add('bpb-confirm-open');
  root.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey, true);

  const okBtn = root.querySelector('[data-confirm-ok]');
  if (okBtn instanceof HTMLElement) okBtn.focus();

  return new Promise((resolve) => {
    resolveAsk = resolve;
  });
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
