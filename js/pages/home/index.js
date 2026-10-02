import { initNav } from '../../shared/nav.js';
import { initFooter } from '../../shared/footer.js';
import { initCombatSky } from './combat-sky.js';
import { initFeaturedStage } from './featured-stage.js';
import { initHomePromoBand } from './home-promo-band.js';
import { initHomeClassShowcase } from './home-class-showcase.js';
import { initHomeItemsExplore } from './home-items-explore.js';
import { initHomeBuildsVault } from './home-builds-vault.js';

initCombatSky();
initNav();
initFooter();
initFeaturedStage();

const initBelowFold = () => {
  initHomePromoBand('#home-promo-band', { variant: 'create' });
  initHomeClassShowcase();
  initHomeItemsExplore();
  initHomeBuildsVault();
};
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(initBelowFold, { timeout: 900 });
} else {
  window.setTimeout(initBelowFold, 1);
}
