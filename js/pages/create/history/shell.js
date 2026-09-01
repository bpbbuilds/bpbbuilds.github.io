/**
 * History overlay shell — anchored to create board minus park strip.
 */

/**
 * Creator column height excluding the parked strip (toolbar + stage).
 * @param {HTMLElement} boardEl
 * @returns {DOMRect}
 */
export function boardAnchorRect(boardEl) {
  const board =
    boardEl.classList?.contains?.('create-board')
      ? boardEl
      : boardEl.closest?.('.create-board') instanceof HTMLElement
        ? /** @type {HTMLElement} */ (boardEl.closest('.create-board'))
        : boardEl;
  const park = board.querySelector?.('.create-board__park');
  const br = board.getBoundingClientRect();
  if (br.width > 1 && br.height > 1) {
    const parkTop =
      park instanceof HTMLElement
        ? park.getBoundingClientRect().top
        : br.bottom;
    return new DOMRect(
      br.left,
      br.top,
      br.width,
      Math.max(0, parkTop - br.top),
    );
  }
  const col = boardEl.closest('.create-col--board');
  if (col instanceof HTMLElement) return col.getBoundingClientRect();
  return br;
}

/**
 * @param {string} root
 * @returns {{ rootEl: HTMLElement, panelEl: HTMLElement }}
 */
export function createHistoryShell(root) {
  const base = root.endsWith('/') ? root : `${root}/`;
  const closeSrc = `${base}assets/icons/create/history-close.svg`;
  const rootEl = document.createElement('div');
  rootEl.className = 'create-history';
  rootEl.setAttribute('data-history-picker', '');
  rootEl.setAttribute('role', 'dialog');
  rootEl.setAttribute('aria-modal', 'true');
  rootEl.setAttribute('aria-labelledby', 'create-history-title');

  rootEl.innerHTML = `
    <div class="create-history__panel" data-history-panel>
      <header class="create-history__head">
        <h2 class="create-history__title" id="create-history-title">History</h2>
        <div class="create-history__filters" data-history-filters></div>
        <button type="button" class="create-history__close" data-history-close aria-label="Close history">
          <img src="${closeSrc}" alt="" width="18" height="18" draggable="false" />
        </button>
      </header>
      <div class="create-history__body">
        <section class="create-history__list-col" aria-label="Past runs">
          <div class="create-history__list" data-history-list role="listbox" aria-label="Runs"></div>
        </section>
        <section class="create-history__preview-col" aria-label="Run preview">
          <div class="create-history__preview" data-history-preview></div>
        </section>
      </div>
    </div>
  `;

  const panelEl = rootEl.querySelector('[data-history-panel]');
  if (!(panelEl instanceof HTMLElement)) {
    throw new Error('History shell missing panel');
  }
  return { rootEl, panelEl };
}

/**
 * @param {HTMLElement} rootEl
 * @param {HTMLElement} boardEl
 */
export function positionHistoryShell(rootEl, boardEl) {
  const rect = boardAnchorRect(boardEl);
  const top = Math.round(rect.top);
  const left = Math.round(rect.left);
  const width = Math.max(0, Math.round(rect.width));
  const height = Math.max(0, Math.round(rect.height));
  rootEl.style.cssText = [
    'position:fixed',
    `top:${top}px`,
    `left:${left}px`,
    `width:${width}px`,
    `height:${height}px`,
    'right:auto',
    'bottom:auto',
    'z-index:200010',
    'display:block',
    'box-sizing:border-box',
    'padding:0',
    'margin:0',
    'background:transparent',
    'pointer-events:auto',
    'transform:none',
    'overflow:visible',
  ].join(';');
}
