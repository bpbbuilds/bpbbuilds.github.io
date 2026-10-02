/**
 * Profile persona scroll — big header scrolls away; mini card appears in the
 * sticky tab column. Only one is visible at a time (big hides when mini shows).
 */

function navSpacePx() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--bpb-nav-space')
    .trim();
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 76;
}

/**
 * @param {HTMLElement} persona big header
 * @param {HTMLElement} mini mini card at top of the tab column
 * @returns {() => void}
 */
export function bindProfilePersonaScroll(persona, mini) {
  if (!(persona instanceof HTMLElement) || !(mini instanceof HTMLElement)) return () => {};

  const mobile = window.matchMedia('(max-width: 720px)');
  let shown = false;
  let raf = 0;
  /** @type {IntersectionObserver | null} */
  let io = null;

  const apply = (next) => {
    if (next === shown) return;
    shown = next;
    mini.classList.toggle('is-shown', next);
    mini.setAttribute('aria-hidden', next ? 'false' : 'true');
    // Hide the big header so it never sits next to the mini.
    persona.classList.toggle('is-away', next);
    persona.setAttribute('aria-hidden', next ? 'true' : 'false');
  };

  const syncFromRect = () => {
    if (mobile.matches) {
      apply(false);
      return;
    }
    const nav = navSpacePx();
    const rect = persona.getBoundingClientRect();
    // Mini only after the whole big header has cleared under the nav.
    apply(rect.bottom <= nav + 4);
  };

  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      syncFromRect();
    });
  };

  const bindIo = () => {
    io?.disconnect();
    io = null;
    if (mobile.matches || typeof IntersectionObserver !== 'function') return;
    const nav = navSpacePx();
    io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        // Not intersecting the area below the nav → swap to mini.
        apply(!entry.isIntersecting);
      },
      {
        root: null,
        // Shrink the top of the viewport by the nav so “visible” means below it.
        rootMargin: `-${nav + 4}px 0px 0px 0px`,
        threshold: 0,
      },
    );
    io.observe(persona);
  };

  const onResize = () => {
    bindIo();
    syncFromRect();
  };

  syncFromRect();
  bindIo();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });

  return () => {
    if (raf) cancelAnimationFrame(raf);
    io?.disconnect();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    persona.classList.remove('is-away');
    persona.removeAttribute('aria-hidden');
    mini.classList.remove('is-shown');
    mini.setAttribute('aria-hidden', 'true');
  };
}
