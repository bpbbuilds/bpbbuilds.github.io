import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js?v=footer-presets-20261013a';
import { initCombatSky } from './combat-sky.js';
import { initFeaturedStage } from './featured-stage.js';
import { initHomePromoBand } from './home-promo-band.js?v=home-no-skeleton-20261014a';

/**
 * Mount below-the-fold sections shortly before they enter view. Keeping their
 * initial DOM, fetches, and animations out of startup prevents them from
 * competing with the hero/promo and scroll work on slower phones.
 * @param {string} selector
 * @param {() => unknown} mount
 */
function mountNearViewport(selector, mount) {
  const host = document.querySelector(selector);
  if (!(host instanceof HTMLElement)) return Promise.resolve();
  let mounted = false;
  /** @type {IntersectionObserver | null} */
  let observer = null;
  return new Promise((resolve) => {
    const start = () => {
      if (mounted) return;
      mounted = true;
      observer?.disconnect();
      Promise.resolve(mount())
        .catch((err) => console.error(`[home] deferred mount failed: ${selector}`, err))
        .finally(resolve);
    };
    if (typeof IntersectionObserver === 'undefined') {
      start();
      return;
    }
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) start();
      },
      { rootMargin: '700px 0px' },
    );
    observer.observe(host);
  });
}

/**
 * Register the next observer only after the preceding section has its real
 * height. Empty hosts otherwise stack at the same document position and make
 * every below-fold dynamic import fire during startup.
 */
async function mountDeferredSections() {
  await mountNearViewport('#home-class-showcase', () =>
    import('./home-class-showcase.js?v=home-no-skeleton-20261014a').then(({ initHomeClassShowcase }) =>
      initHomeClassShowcase(),
    ),
  );
  await mountNearViewport('#home-items-explore', () =>
    import('./home-items-explore.js?v=home-no-skeleton-20261014a').then(({ initHomeItemsExplore }) =>
      initHomeItemsExplore(),
    ),
  );
  await mountNearViewport('#home-builds-vault', () =>
    import('./home-builds-vault.js?v=home-loadout-meta-20261014a').then(({ initHomeBuildsVault }) =>
      initHomeBuildsVault(),
    ),
  );
}

async function boot() {
  // Paint the time-of-day combat scene immediately. Navigation performs
  // auth/access work and can wait on Supabase; the first-paint shell must not
  // remain a bare fallback while that asynchronous gate resolves.
  initCombatSky();
  if (!(await initNav())) return;
  initFooter({ preset: 'regular' });
  initFeaturedStage();

  // First-view sections mount immediately. Lower sections mount with a generous
  // viewport lead so they are ready when reached without paying their DOM,
  // network, and animation cost during initial render.
  initHomePromoBand('#home-promo-band', { variant: 'create', launcher: 'player' });
  void mountDeferredSections();
}

void boot();
