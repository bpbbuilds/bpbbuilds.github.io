import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import { initCombatSky } from './combat-sky.js';
import { initFeaturedStage } from './featured-stage.js';
import { initHomePromoBand } from './home-promo-band.js';

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
    import('./home-class-showcase.js').then(({ initHomeClassShowcase }) =>
      initHomeClassShowcase(),
    ),
  );
  await mountNearViewport('#home-items-explore', () =>
    import('./home-items-explore.js').then(({ initHomeItemsExplore }) =>
      initHomeItemsExplore(),
    ),
  );
  await mountNearViewport('#home-builds-vault', () =>
    import('./home-builds-vault.js').then(({ initHomeBuildsVault }) =>
      initHomeBuildsVault(),
    ),
  );
}

async function boot() {
  if (!(await initNav())) return;
  initCombatSky();
  initFooter();
  initFeaturedStage();

  // First-view sections mount immediately. Lower sections mount with a generous
  // viewport lead so they are ready when reached without paying their DOM,
  // network, and animation cost during initial render.
  initHomePromoBand('#home-promo-band', { variant: 'create' });
  void mountDeferredSections();
}

void boot();
