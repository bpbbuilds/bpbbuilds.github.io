/**
 * Centered dialog listing what’s required / recommended before Submit.
 */

const TITLE_ID = 'cr-submit-info-title';

/**
 * @returns {{
 *   open: (result: import('./submit-validate.js').DraftValidation) => void,
 *   destroy: () => void,
 * }}
 */
export function createSubmitInfoModal() {
  const root = document.createElement('div');
  root.className = 'cr-modal';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', TITLE_ID);
  root.hidden = true;
  root.innerHTML = `
    <div class="cr-modal__backdrop" data-submit-info-close tabindex="-1"></div>
    <div class="cr-modal__panel" role="document">
      <h2 class="cr-modal__title" id="${TITLE_ID}">Before you submit</h2>
      <div class="cr-modal__body" data-submit-info-body></div>
      <button type="button" class="cr-modal__close" data-submit-info-close>Got it</button>
    </div>
  `;

  document.body.appendChild(root);
  const body = root.querySelector('[data-submit-info-body]');

  /** @type {HTMLElement | null} */
  let lastFocus = null;

  /**
   * @param {import('./submit-validate.js').DraftValidation} result
   */
  function open(result) {
    if (!(body instanceof HTMLElement)) return;
    const required = result.errors || [];
    const recommended = result.warnings || [];

    let html = '';
    if (!required.length && !recommended.length) {
      html = `<p>You’re ready to submit. Nothing required or recommended is missing.</p>`;
    } else {
      if (required.length) {
        html += `
          <p><strong>Required</strong> — fix these before Submit unlocks:</p>
          <ul class="cr-modal__list cr-modal__list--error">
            ${required.map((c) => `<li>${escapeHtml(c.message)}</li>`).join('')}
          </ul>
        `;
      } else {
        html += `<p><strong>Required</strong> — all set. Submit is unlocked.</p>`;
      }
      if (recommended.length) {
        html += `
          <p><strong>Recommended</strong> — optional polish:</p>
          <ul class="cr-modal__list">
            ${recommended.map((c) => `<li>${escapeHtml(c.message)}</li>`).join('')}
          </ul>
        `;
      }
    }
    body.innerHTML = html;

    if (!root.hidden) return;
    lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.hidden = false;
    document.body.classList.add('cr-modal-open');
    const closeBtn = root.querySelector('.cr-modal__close');
    if (closeBtn instanceof HTMLElement) closeBtn.focus();
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    document.body.classList.remove('cr-modal-open');
    lastFocus?.focus?.();
    lastFocus = null;
  }

  /** @param {MouseEvent} e */
  function onClick(e) {
    const t = e.target;
    if (t instanceof Element && t.closest('[data-submit-info-close]')) close();
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (e.key === 'Escape' && !root.hidden) {
      e.preventDefault();
      close();
    }
  }

  root.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);

  return {
    open,
    destroy() {
      document.removeEventListener('keydown', onKey);
      root.removeEventListener('click', onClick);
      document.body.classList.remove('cr-modal-open');
      root.remove();
    },
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
