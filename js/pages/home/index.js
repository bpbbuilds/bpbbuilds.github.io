import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import { initCombatSky } from './combat-sky.js';
import { initFeaturedStage } from './featured-stage.js';
import { initHomePromoBand } from './home-promo-band.js';
import { initHomeClassShowcase } from './home-class-showcase.js';
import { initHomeItemsExplore } from './home-items-explore.js';
import { initHomeBuildsVault } from './home-builds-vault.js';

/**
 * Mount below-the-fold sections shortly before they enter view. Keeping their
 * initial DOM, fetches, and animations out of startup prevents them from
 * competing with the hero/promo and scroll work on slower phones.
 * @param {string} selector
 * @param {() => unknown} mount
 */
function mountNearViewport(selector, mount) {
  const host = document.querySelector(selector);
  if (!(host instanceof HTMLElement)) return;
  let mounted = false;
  /** @type {IntersectionObserver | null} */
  let observer = null;
  const start = () => {
    if (mounted) return;
    mounted = true;
    observer?.disconnect();
    mount();
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
  mountNearViewport('#home-class-showcase', initHomeClassShowcase);
  mountNearViewport('#home-items-explore', initHomeItemsExplore);
  mountNearViewport('#home-builds-vault', initHomeBuildsVault);
}

void boot();
