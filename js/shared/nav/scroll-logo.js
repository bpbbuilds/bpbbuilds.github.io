/**
 * Compact BPB mark when scrolled. Box size snaps; a FLIP scale keeps the
 * morph on the compositor so width/height no longer layout-animate.
 */

const LOGO_FLIP_MS = 200;

/**
 * In-flow spacer after the fixed nav so content isn’t covered (VH pattern).
 * @param {Element} host
 */
export function ensureNavSpace(host) {
  if (!(host instanceof HTMLElement)) return;
  let space = document.getElementById('site-nav-space');
  if (!(space instanceof HTMLElement)) {
    space = document.createElement('div');
    space.id = 'site-nav-space';
    space.setAttribute('aria-hidden', 'true');
    host.insertAdjacentElement('afterend', space);
  }
}

/**
 * Lock spacer to the *expanded* nav height so compact logo doesn’t change page height.
 * Skips while scrolled so we don’t flash the full logo to measure.
 * @param {Element} host
 */
export function syncNavSpace(host) {
  if (!(host instanceof HTMLElement)) return;
  if (host.classList.contains('is-scrolled')) return;

  const space = document.getElementById('site-nav-space');
  if (!(space instanceof HTMLElement)) return;

  const h = Math.ceil(host.getBoundingClientRect().height);
  if (h > 0) {
    document.documentElement.style.setProperty('--bpb-nav-space', `${h}px`);
    space.style.height = `${h}px`;
  }
}

function pageScrollY() {
  const winY = window.scrollY || document.documentElement.scrollTop || 0;
  const main = document.getElementById('main');
  const mainY = main instanceof HTMLElement ? main.scrollTop : 0;
  return Math.max(winY, mainY);
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

/**
 * @param {HTMLElement} swap
 */
function clearLogoFlip(swap) {
  swap.classList.remove('site-nav__logo-swap--anim');
  swap.style.transition = '';
  swap.style.transform = '';
}

/**
 * Invert the snapped box with scale, then play back to 1 (same visual as the
 * old width/height tween, without per-frame flex layout).
 * @param {HTMLElement} swap
 * @param {DOMRect} first
 * @param {number} gen
 * @param {() => number} genOf
 */
function playLogoFlip(swap, first, gen, genOf) {
  const last = swap.getBoundingClientRect();
  if (last.width < 2 || last.height < 2) return;
  const sx = first.width / last.width;
  const sy = first.height / last.height;
  if (Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;

  swap.style.transition = 'none';
  swap.style.transform = `scale(${sx}, ${sy})`;
  // Force invert before the play frame — only once per compact/expand.
  void swap.offsetWidth;
  if (genOf() !== gen) return;
  swap.style.transition = '';
  swap.classList.add('site-nav__logo-swap--anim');
  swap.style.transform = 'scale(1)';

  let done = false;
  const finish = () => {
    if (done || genOf() !== gen) return;
    done = true;
    window.clearTimeout(timer);
    swap.removeEventListener('transitionend', onEnd);
    clearLogoFlip(swap);
  };
  const onEnd = (e) => {
    if (e.target === swap && e.propertyName === 'transform') finish();
  };
  const timer = window.setTimeout(finish, LOGO_FLIP_MS + 80);
  swap.addEventListener('transitionend', onEnd);
}

/**
 * Swap to compact BPB mark when scrolled (VH: scrollY > 0).
 * @param {Element} host
 */
export function bindNavScrollLogo(host) {
  if (!(host instanceof HTMLElement)) return;
  const full = host.querySelector('.site-nav__logo--full');
  const compact = host.querySelector('.site-nav__logo--compact');
  const swap = host.querySelector('.site-nav__logo-swap');
  if (!(full instanceof HTMLImageElement) || !(compact instanceof HTMLImageElement)) {
    return;
  }

  let scrolled = host.classList.contains('is-scrolled');
  let raf = 0;
  let flipGen = 0;

  const stamp = (next) => {
    host.classList.toggle('is-scrolled', next);
    full.alt = next ? '' : 'Backpack Battles';
    full.setAttribute('aria-hidden', next ? 'true' : 'false');
    compact.alt = next ? 'Backpack Battles' : '';
    compact.setAttribute('aria-hidden', next ? 'false' : 'true');
  };

  const apply = (next) => {
    if (next === scrolled) return;
    flipGen += 1;
    if (swap instanceof HTMLElement) clearLogoFlip(swap);
    const reduce = prefersReducedMotion();
    const canFlip = !reduce && swap instanceof HTMLElement;
    const first = canFlip ? swap.getBoundingClientRect() : null;
    scrolled = next;
    stamp(next);
    if (canFlip && first) playLogoFlip(swap, first, flipGen, () => flipGen);
  };

  const sync = () => {
    apply(pageScrollY() > 0);
  };

  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      sync();
    });
  };

  sync();
  window.addEventListener('scroll', onScroll, { passive: true });
  const main = document.getElementById('main');
  if (main instanceof HTMLElement) {
    main.addEventListener('scroll', onScroll, { passive: true });
  }
}
