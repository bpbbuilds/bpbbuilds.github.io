/**
 * Confirm overlay when editing a board with attached run history.
 * Anchored over the create board stage (bag viewer) only — not Parked / scrubber.
 */

/**
 * @param {{
 *   stageEl: HTMLElement,
 *   state: {
 *     getDraft: () => import('./draft-io.js').Draft,
 *     clearHistory: () => boolean,
 *     setHistoryUnlockAsker: (fn: null | (() => Promise<boolean>)) => void,
 *   },
 * }} opts
 */
export function mountHistoryEditGuard(opts) {
  const { stageEl, state } = opts;

  const root = document.createElement('div');
  root.className = 'create-history-lock';
  root.hidden = true;
  root.setAttribute('role', 'presentation');
  root.innerHTML = `
    <div class="create-history-lock__backdrop" data-lock-cancel tabindex="-1"></div>
    <div
      class="create-history-lock__panel"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="create-history-lock-title"
      aria-describedby="create-history-lock-desc"
    >
      <h2 class="create-history-lock__title bpb-label-text" id="create-history-lock-title">Clear run history?</h2>
      <p class="create-history-lock__body" id="create-history-lock-desc">
        Unlocking clears the attached run history so you can edit the board. A Real tag becomes Feasible. You can load the run again later if you still want to publish with history.
      </p>
      <div class="create-history-lock__actions">
        <button type="button" class="create-history-lock__btn create-history-lock__btn--cancel" data-lock-cancel>
          Cancel
        </button>
        <button type="button" class="create-history-lock__btn create-history-lock__btn--confirm" data-lock-confirm>
          Edit board
        </button>
      </div>
    </div>
  `;
  stageEl.appendChild(root);

  /** @type {((ok: boolean) => void) | null} */
  let resolveAsk = null;

  function finish(ok) {
    root.hidden = true;
    stageEl.classList.remove('is-history-lock-open');
    const resolve = resolveAsk;
    resolveAsk = null;
    if (ok) state.clearHistory();
    resolve?.(ok);
  }

  function ask() {
    if (!state.getDraft().history) return Promise.resolve(true);
    if (resolveAsk) {
      // Already open — join the in-flight prompt
      return new Promise((resolve) => {
        const prev = resolveAsk;
        resolveAsk = (ok) => {
          prev?.(ok);
          resolve(ok);
        };
      });
    }
    root.hidden = false;
    stageEl.classList.add('is-history-lock-open');
    const confirmBtn = root.querySelector('[data-lock-confirm]');
    if (confirmBtn instanceof HTMLElement) confirmBtn.focus();
    return new Promise((resolve) => {
      resolveAsk = resolve;
    });
  }

  /** @param {MouseEvent} e */
  function onClick(e) {
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest?.('[data-lock-confirm]')) {
      e.preventDefault();
      finish(true);
      return;
    }
    if (t?.closest?.('[data-lock-cancel]')) {
      e.preventDefault();
      finish(false);
    }
  }

  /** @param {KeyboardEvent} e */
  function onKey(e) {
    if (root.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  }

  root.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey);
  state.setHistoryUnlockAsker(ask);

  return {
    ask,
    destroy() {
      state.setHistoryUnlockAsker(null);
      if (resolveAsk) finish(false);
      root.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
      root.remove();
      stageEl.classList.remove('is-history-lock-open');
    },
  };
}
