/**
 * Narrow-window filter rail — right-hand panel. Desktop keeps the rail in the row.
 */

const NARROW_MQ = '(max-width: 1240px)';

/**
 * Toggle + backdrop for a `bpb-filter-drawer` layout. The rail is the panel.
 * @param {string} panelId
 * @param {string} [label='Filters']
 */
export function filterDrawerChromeHtml(panelId, label = 'Filters') {
  const id = String(panelId || '').replace(/"/g, '');
  const toggleLabel = String(label || 'Filters');
  return `<button type="button" class="bpb-filter-drawer__backdrop" data-bpb-filter-backdrop hidden aria-label="Close filters"></button>
    <button type="button" class="bpb-filter-drawer__toggle" data-bpb-filter-open aria-expanded="false" aria-controls="${id}">${toggleLabel}</button>`;
}

/**
 * @param {Element | null} layout Row that contains the content and `.bpb-filter-drawer__panel`
 * @param {string} [narrowMq] Viewport where the rail becomes the panel
 * @returns {() => void}
 */
export function bindFilterDrawer(layout, narrowMq = NARROW_MQ) {
  const toggle = layout?.querySelector('[data-bpb-filter-open]');
  const rail = layout?.querySelector('.bpb-filter-drawer__panel');
  const closeBtn = rail?.querySelector('[data-bpb-filter-close]');
  const backdrop = layout?.querySelector('[data-bpb-filter-backdrop]');
  if (
    !(layout instanceof HTMLElement) ||
    !(toggle instanceof HTMLButtonElement) ||
    !(rail instanceof HTMLElement)
  ) {
    return () => {};
  }

  const mq = window.matchMedia(narrowMq);

  function isOpen() {
    return layout.classList.contains('is-filters-open');
  }

  /**
   * @param {boolean} open
   * @param {{ focus?: 'close' | 'toggle' }} [opts]
   */
  function setOpen(open, opts = {}) {
    const narrow = mq.matches;
    const on = open && narrow;
    layout.classList.toggle('is-filters-open', on);
    toggle.hidden = !narrow;
    toggle.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (backdrop instanceof HTMLElement) backdrop.hidden = !on;
    rail.inert = narrow && !on;
    if (opts.focus === 'close' && closeBtn instanceof HTMLElement) closeBtn.focus();
    if (opts.focus === 'toggle') toggle.focus();
  }

  const onToggle = () => {
    const next = !isOpen();
    setOpen(next, { focus: next ? 'close' : 'toggle' });
  };
  const onClose = () => setOpen(false, { focus: 'toggle' });
  /** @param {KeyboardEvent} e */
  const onKey = (e) => {
    if (e.key === 'Escape' && isOpen()) onClose();
  };
  const onMq = () => setOpen(false);

  toggle.addEventListener('click', onToggle);
  closeBtn?.addEventListener('click', onClose);
  backdrop?.addEventListener('click', onClose);
  document.addEventListener('keydown', onKey);
  mq.addEventListener('change', onMq);
  setOpen(false);

  /** @type {MutationObserver | null} */
  let obs = null;
  const stop = () => {
    toggle.removeEventListener('click', onToggle);
    closeBtn?.removeEventListener('click', onClose);
    backdrop?.removeEventListener('click', onClose);
    document.removeEventListener('keydown', onKey);
    mq.removeEventListener('change', onMq);
    layout.classList.remove('is-filters-open');
    rail.inert = false;
    toggle.hidden = true;
    obs?.disconnect();
    obs = null;
  };
  const parent = layout.parentElement;
  if (parent) {
    obs = new MutationObserver(() => {
      if (!layout.isConnected) stop();
    });
    obs.observe(parent, { childList: true });
  }
  return stop;
}
