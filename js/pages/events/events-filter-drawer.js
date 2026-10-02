/**
 * Narrow events catalog — filters open from the right. Desktop keeps the rail.
 */

const NARROW_MQ = '(max-width: 1240px)';

/**
 * @param {Element | null} layout
 * @returns {() => void}
 */
export function bindEventsFilterDrawer(layout) {
  const toggle = layout?.querySelector('[data-events-filters-open]');
  const rail = layout?.querySelector('.events-filters');
  const closeBtn = rail?.querySelector('[data-events-filters-close]');
  const backdrop = layout?.querySelector('[data-events-filters-backdrop]');
  if (
    !(layout instanceof HTMLElement) ||
    !(toggle instanceof HTMLButtonElement) ||
    !(rail instanceof HTMLElement)
  ) {
    return () => {};
  }

  const mq = window.matchMedia(NARROW_MQ);

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
    toggle.hidden = !narrow || on;
    toggle.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (backdrop instanceof HTMLElement) backdrop.hidden = !on;
    rail.inert = narrow && !on;
    if (opts.focus === 'close' && closeBtn instanceof HTMLElement) closeBtn.focus();
    if (opts.focus === 'toggle') toggle.focus();
  }

  /** @param {MouseEvent} event */
  const onToggle = (event) => {
    event.preventDefault();
    event.stopPropagation();
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

  return () => {
    toggle.removeEventListener('click', onToggle);
    closeBtn?.removeEventListener('click', onClose);
    backdrop?.removeEventListener('click', onClose);
    document.removeEventListener('keydown', onKey);
    mq.removeEventListener('change', onMq);
    layout.classList.remove('is-filters-open');
    rail.inert = false;
    toggle.hidden = true;
  };
}
