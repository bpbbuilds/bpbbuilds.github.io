/**
 * Centered dialog explaining the OP build tag.
 */

const TITLE_ID = 'cr-op-info-title';

/**
 * @returns {{ open: () => void, destroy: () => void }}
 */
export function createOpInfoModal() {
  const root = document.createElement('div');
  root.className = 'cr-modal';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', TITLE_ID);
  root.hidden = true;
  root.innerHTML = `
    <div class="cr-modal__backdrop" data-op-info-close tabindex="-1"></div>
    <div class="cr-modal__panel" role="document">
      <h2 class="cr-modal__title" id="${TITLE_ID}">Request OP review</h2>
      <div class="cr-modal__body">
        <p>
          <strong>Request OP</strong> asks for the public OP (overpowered) badge.
          Your build stays normal until an admin approves — you will see
          <strong>OP pending</strong> on the guide until then.
        </p>
        <p>
          OP is for builds that are clearly broken and also
          <strong>feasible</strong>, doable in a real run, and proved by the board
          you upload (unchanged from your upload). Don’t request OP on a Theory board.
        </p>
        <p>
          Before you submit for OP review, fill <strong>Needs</strong>,
          <strong>Wants</strong>, and <strong>Good to have</strong> (at least one
          item each), and write a <strong>“Why it works”</strong> note of at least
          30 characters.
        </p>
        <p>
          <strong>Videos are welcome</strong> (and optional). Add a YouTube link on
          the Build tab if you have a showcase or run footage.
        </p>
        <p>
          Requesting OP does not auto-feature the build. Submit still publishes the
          guide; only the OP badge waits on review.
        </p>
      </div>
      <button type="button" class="cr-modal__close" data-op-info-close>Got it</button>
    </div>
  `;

  document.body.appendChild(root);

  /** @type {HTMLElement | null} */
  let lastFocus = null;

  function open() {
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
    if (t instanceof Element && t.closest('[data-op-info-close]')) close();
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
