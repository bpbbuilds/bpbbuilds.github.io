/**
 * Mobile side drawer. The header stays logo-only under this breakpoint.
 */

const MOBILE_NAV_MQ = '(max-width: 1100px)';
const NAV_DRAWER_ANIMATION_MS = 220;

/**
 * @param {ParentNode} root
 * @returns {HTMLElement[]}
 */
function focusable(root) {
  return [...root.querySelectorAll('a[href], button:not([disabled])')].filter(
    (el) => el instanceof HTMLElement && !el.closest('[hidden]'),
  );
}

/**
 * @param {HTMLElement} host
 */
export function bindNavDrawer(host) {
  const button = host.querySelector('[data-nav-menu]');
  const shell = host.querySelector('.site-nav-shell');
  const drawer = host.querySelector('[data-nav-drawer]');
  const backdrop = host.querySelector('[data-nav-backdrop]');
  const closeBtn = host.querySelector('[data-nav-drawer-close]');
  if (
    !(button instanceof HTMLButtonElement) ||
    !(shell instanceof HTMLElement) ||
    !(drawer instanceof HTMLElement) ||
    !(backdrop instanceof HTMLElement)
  ) {
    return;
  }

  markCurrent(drawer);

  const mq = window.matchMedia(MOBILE_NAV_MQ);
  let open = false;
  let closeTimer = 0;

  function clearCloseTimer() {
    if (!closeTimer) return;
    window.clearTimeout(closeTimer);
    closeTimer = 0;
  }

  const setOpen = (next) => {
    clearCloseTimer();
    open = Boolean(next && mq.matches);
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.documentElement.classList.toggle('is-nav-drawer-open', open);
    if (open) {
      // Let the closed transform paint before adding the open class.
      shell.classList.remove('is-nav-open');
      drawer.hidden = false;
      backdrop.hidden = false;
      requestAnimationFrame(() => {
        if (open) shell.classList.add('is-nav-open');
      });
      const first = focusable(drawer)[0];
      if (first instanceof HTMLElement) first.focus();
    } else if (document.activeElement instanceof HTMLElement && drawer.contains(document.activeElement)) {
      shell.classList.remove('is-nav-open');
      button.focus();
      closeTimer = window.setTimeout(() => {
        closeTimer = 0;
        if (!open) {
          drawer.hidden = true;
          backdrop.hidden = true;
        }
      }, NAV_DRAWER_ANIMATION_MS);
    } else {
      shell.classList.remove('is-nav-open');
      closeTimer = window.setTimeout(() => {
        closeTimer = 0;
        if (!open) {
          drawer.hidden = true;
          backdrop.hidden = true;
        }
      }, NAV_DRAWER_ANIMATION_MS);
    }
  };

  button.addEventListener('click', () => setOpen(!open));
  backdrop.addEventListener('click', () => setOpen(false));
  closeBtn?.addEventListener('click', () => setOpen(false));
  drawer.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('a')) setOpen(false);
  });

  drawer.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !open) return;
    const items = focusable(drawer);
    const first = items[0];
    const last = items[items.length - 1];
    if (!(first instanceof HTMLElement) || !(last instanceof HTMLElement)) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) setOpen(false);
  });

  mq.addEventListener('change', () => {
    if (!mq.matches) setOpen(false);
  });
}

/**
 * @param {HTMLElement} drawer
 */
function markCurrent(drawer) {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  drawer.querySelectorAll('a[data-nav-path]').forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    const key = link.dataset.navPath || '';
    if (!key) return;
    const target = new URL(link.href, location.href).pathname.replace(/\/+$/, '') || '/';
    const onPage = path === target || path.startsWith(`${target}/`);
    if (onPage) link.setAttribute('aria-current', 'page');
  });
}
